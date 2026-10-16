package main

import (
	"math"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type fakeBackend struct {
	mu     sync.Mutex
	clicks map[int]int
	calls  atomic.Int64
	skip   bool
}

func newFake() *fakeBackend { return &fakeBackend{clicks: map[int]int{}} }

func (f *fakeBackend) Click(c *ClickerCfg, _ bool) int {
	f.calls.Add(1)
	if f.skip {
		return 0
	}
	n := 1
	if c.Double {
		n = 2
	}
	f.mu.Lock()
	f.clicks[c.ID] += n
	f.mu.Unlock()
	return n
}

func (f *fakeBackend) count(id int) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.clicks[id]
}

func cfg(id int, s Speed) ClickerCfg {
	return ClickerCfg{ID: id, On: true, Follow: true, Button: "left", OwnSpeed: true, Speed: s}
}

func TestIntervals(t *testing.T) {
	cases := []struct {
		s    Speed
		want time.Duration
	}{
		{Speed{Mode: "normal"}, 100 * time.Millisecond},
		{Speed{Mode: "fast"}, 40 * time.Millisecond},
		{Speed{Mode: "turbo"}, 20 * time.Millisecond},
		{Speed{Mode: "insane"}, 10 * time.Millisecond},
		{Speed{Mode: "max", Value: 0, Unit: "ms"}, 0},
		{Speed{Mode: "max", Value: 0.5, Unit: "ms"}, 500 * time.Microsecond},
		{Speed{Mode: "max", Value: 0.1, Unit: "s"}, 100 * time.Millisecond},
		{Speed{Mode: "max", Value: 1000, Unit: "cps"}, time.Millisecond},
		{Speed{Mode: "max", Value: 0, Unit: "cps"}, maxInterval},
		{Speed{Mode: "max", Value: 2, Unit: "min"}, 2 * time.Minute},
		{Speed{Mode: "max", Value: 1e300, Unit: "min"}, maxInterval},
		{Speed{Mode: "max", Value: math.NaN(), Unit: "ms"}, 0},
		{Speed{Mode: "max", Value: -5, Unit: "ms"}, 0},
		{Speed{Mode: "custom", Value: 0, Unit: "ms"}, customMinInterval},
		{Speed{Mode: "custom", Value: 1, Unit: "s"}, time.Second},
		{Speed{Mode: "custom", Value: 5000, Unit: "cps"}, customMinInterval},
	}
	for _, c := range cases {
		if got := c.s.Interval(); got != c.want {
			t.Errorf("%+v: got %v want %v", c.s, got, c.want)
		}
	}
}

func TestSteadySpeed(t *testing.T) {
	f := newFake()
	e := NewEngine(f)
	e.Start(&runConfig{clickers: []ClickerCfg{cfg(1, Speed{Mode: "insane"})}}, StopRule{Mode: "never"})
	time.Sleep(500 * time.Millisecond)
	total, ok := e.Stop()
	if !ok {
		t.Fatal("stop failed")
	}
	if total < 40 || total > 55 {
		t.Errorf("insane for 0.5s: got %d clicks, want ~50", total)
	}
}

func TestTwoClickersOwnSpeeds(t *testing.T) {
	f := newFake()
	e := NewEngine(f)
	rc := &runConfig{clickers: []ClickerCfg{
		cfg(1, Speed{Mode: "max", Value: 5, Unit: "ms"}),
		cfg(2, Speed{Mode: "custom", Value: 50, Unit: "ms"}),
	}}
	e.Start(rc, StopRule{Mode: "never"})
	time.Sleep(500 * time.Millisecond)
	e.Stop()
	a, b := f.count(1), f.count(2)
	if a < 80 || a > 110 {
		t.Errorf("5ms clicker: got %d, want ~100", a)
	}
	if b < 8 || b > 12 {
		t.Errorf("50ms clicker: got %d, want ~10", b)
	}
}

func TestMainSpeedAndDouble(t *testing.T) {
	f := newFake()
	e := NewEngine(f)
	c := ClickerCfg{ID: 7, On: true, Double: true}
	e.Start(&runConfig{clickers: []ClickerCfg{c}, main: Speed{Mode: "turbo"}}, StopRule{Mode: "never"})
	time.Sleep(300 * time.Millisecond)
	total, _ := e.Stop()
	// turbo = 50 actions/s, double = 2 clicks each -> ~30 in 0.3s
	if total < 24 || total > 34 || total%2 != 0 {
		t.Errorf("double click on main turbo: got %d, want ~30 and even", total)
	}
}

func TestStopAfterClicks(t *testing.T) {
	f := newFake()
	e := NewEngine(f)
	finished := make(chan struct{})
	e.onFinish = func() { e.Stop(); close(finished) }
	e.Start(&runConfig{clickers: []ClickerCfg{cfg(1, Speed{Mode: "max", Value: 0})}}, StopRule{Mode: "clicks", Clicks: 25})
	select {
	case <-finished:
	case <-time.After(2 * time.Second):
		t.Fatal("stop-after-clicks never finished")
	}
	if got := f.count(1); got != 25 {
		t.Errorf("got %d clicks, want exactly 25", got)
	}
	if e.Running() {
		t.Error("still running")
	}
}

func TestStopAfterTime(t *testing.T) {
	f := newFake()
	e := NewEngine(f)
	finished := make(chan struct{})
	e.onFinish = func() { e.Stop(); close(finished) }
	start := time.Now()
	// 1 click per minute: the time limit must still end it on time, not after a minute
	e.Start(&runConfig{clickers: []ClickerCfg{cfg(1, Speed{Mode: "max", Value: 1, Unit: "min"})}}, StopRule{Mode: "time", Seconds: 0.2})
	select {
	case <-finished:
	case <-time.After(2 * time.Second):
		t.Fatal("stop-after-time never finished")
	}
	if el := time.Since(start); el < 190*time.Millisecond || el > 400*time.Millisecond {
		t.Errorf("stopped after %v, want ~200ms", el)
	}
	if got := f.count(1); got != 1 {
		t.Errorf("got %d clicks, want 1 (first click is instant)", got)
	}
}

func TestMaxPowerZeroIsFastAndStopsQuick(t *testing.T) {
	f := newFake()
	e := NewEngine(f)
	e.Start(&runConfig{clickers: []ClickerCfg{cfg(1, Speed{Mode: "max", Value: 0})}}, StopRule{Mode: "never"})
	time.Sleep(200 * time.Millisecond)
	t0 := time.Now()
	total, _ := e.Stop()
	if d := time.Since(t0); d > 50*time.Millisecond {
		t.Errorf("stop took %v", d)
	}
	if total < 10000 {
		t.Errorf("0 ms only did %d clicks in 0.2s", total)
	}
	before := f.count(1)
	time.Sleep(30 * time.Millisecond)
	if f.count(1) != before {
		t.Error("clicked after Stop returned")
	}
}

func TestUpdateWhileRunning(t *testing.T) {
	f := newFake()
	e := NewEngine(f)
	e.Start(&runConfig{clickers: []ClickerCfg{cfg(1, Speed{Mode: "max", Value: 1, Unit: "min"})}}, StopRule{Mode: "never"})
	time.Sleep(50 * time.Millisecond)
	if f.count(1) != 1 {
		t.Fatalf("want 1 click before update, got %d", f.count(1))
	}
	// Switch to turbo mid-wait: must not keep sleeping for the old minute.
	e.Update(&runConfig{clickers: []ClickerCfg{cfg(1, Speed{Mode: "turbo"})}})
	time.Sleep(300 * time.Millisecond)
	e.Stop()
	if n := f.count(1); n < 12 {
		t.Errorf("after update to turbo got %d clicks in 0.3s", n)
	}
	// Add a second clicker live, then turn all off.
	f2 := newFake()
	e2 := NewEngine(f2)
	e2.Start(&runConfig{clickers: []ClickerCfg{cfg(1, Speed{Mode: "turbo"})}}, StopRule{Mode: "never"})
	time.Sleep(100 * time.Millisecond)
	e2.Update(&runConfig{clickers: []ClickerCfg{cfg(1, Speed{Mode: "turbo"}), cfg(2, Speed{Mode: "turbo"})}})
	time.Sleep(100 * time.Millisecond)
	e2.Update(&runConfig{})
	time.Sleep(20 * time.Millisecond)
	snap := f2.count(1) + f2.count(2)
	time.Sleep(100 * time.Millisecond)
	if f2.count(2) == 0 {
		t.Error("clicker added live never clicked")
	}
	if f2.count(1)+f2.count(2) != snap {
		t.Error("kept clicking with no clickers on")
	}
	e2.Stop()
}

func TestSkippedClicksDontSpin(t *testing.T) {
	f := newFake()
	f.skip = true
	e := NewEngine(f)
	e.Start(&runConfig{clickers: []ClickerCfg{cfg(1, Speed{Mode: "max", Value: 0})}}, StopRule{Mode: "never"})
	time.Sleep(100 * time.Millisecond)
	total, _ := e.Stop()
	if total != 0 {
		t.Errorf("skipped clicks counted: %d", total)
	}
	if c := f.calls.Load(); c > 150 {
		t.Errorf("retried a skipped spot %d times in 0.1s", c)
	}
}

func TestRestartAfterStop(t *testing.T) {
	f := newFake()
	e := NewEngine(f)
	for i := 0; i < 3; i++ {
		if !e.Start(&runConfig{clickers: []ClickerCfg{cfg(1, Speed{Mode: "insane"})}}, StopRule{Mode: "never"}) {
			t.Fatal("start refused")
		}
		if e.Start(&runConfig{}, StopRule{}) {
			t.Fatal("double start allowed")
		}
		time.Sleep(30 * time.Millisecond)
		if _, ok := e.Stop(); !ok {
			t.Fatal("stop failed")
		}
		if _, ok := e.Stop(); ok {
			t.Fatal("double stop reported ok")
		}
	}
}

func TestNormalize(t *testing.T) {
	st := Settings{
		Main:   Speed{Mode: "warp", Value: math.Inf(1), Unit: "parsecs"},
		Hotkey: "ESC",
		Stop:   StopRule{Mode: "?", Clicks: -3, Seconds: math.NaN()},
		Clickers: []ClickerCfg{
			{ID: 3, Name: "  "},
			{ID: 3, Name: "a very very very long clicker name here", Button: "side"},
			{ID: -1},
		},
	}
	st.Normalize()
	if st.Main.Mode != "normal" || st.Main.Unit != "ms" || st.Main.Value != 0 {
		t.Errorf("main speed not fixed: %+v", st.Main)
	}
	if st.Hotkey != "F6" || st.Stop.Mode != "never" || st.Stop.Clicks != 1 || st.Stop.Seconds != 0.1 {
		t.Errorf("fields not fixed: %q %+v", st.Hotkey, st.Stop)
	}
	ids := map[int]bool{}
	for _, c := range st.Clickers {
		if ids[c.ID] || c.ID <= 0 {
			t.Errorf("bad/duplicate id %d", c.ID)
		}
		ids[c.ID] = true
		if c.Name == "" || len([]rune(c.Name)) > 24 || c.Button != "left" {
			t.Errorf("clicker not fixed: %+v", c)
		}
	}
	if st.NextID <= 5 || st.Warned == nil {
		t.Errorf("nextId %d", st.NextID)
	}

	big := defaultSettings()
	for i := 0; i < 50; i++ {
		big.Clickers = append(big.Clickers, ClickerCfg{ID: 100 + i})
	}
	big.Normalize()
	if len(big.Clickers) != maxClickers {
		t.Errorf("clickers not capped: %d", len(big.Clickers))
	}

	empty := Settings{}
	empty.Normalize()
	if len(empty.Clickers) != 1 {
		t.Error("empty settings didn't get a clicker")
	}
}

func TestSaveLoad(t *testing.T) {
	p := filepath.Join(t.TempDir(), "x", "settings.json")
	st := defaultSettings()
	st.Main = Speed{Mode: "max", Value: 0.5, Unit: "ms"}
	st.Warned["max"] = true
	st.AllTime = 12345
	if err := saveSettings(p, st); err != nil {
		t.Fatal(err)
	}
	got := loadSettings(p)
	if got.Main != st.Main || !got.Warned["max"] || got.AllTime != 12345 {
		t.Errorf("round trip lost data: %+v", got)
	}
	os.WriteFile(p, []byte("{broken"), 0o644)
	if got := loadSettings(p); len(got.Clickers) != 1 || got.Hotkey != "F6" {
		t.Error("broken file didn't fall back to defaults")
	}
}

func TestCPSMeter(t *testing.T) {
	var m cpsMeter
	t0 := time.Now()
	var cps float64
	for i := 0; i <= 20; i++ {
		cps = m.Add(t0.Add(time.Duration(i)*200*time.Millisecond), int64(i*100))
	}
	if math.Abs(cps-500) > 1 {
		t.Errorf("cps %v want 500", cps)
	}
}

func TestFastestSpeed(t *testing.T) {
	st := defaultSettings()
	st.Main = Speed{Mode: "turbo"}
	st.Clickers = []ClickerCfg{
		{ID: 1, On: true},
		{ID: 2, On: false, OwnSpeed: true, Speed: Speed{Mode: "max"}},
		{ID: 3, On: true, OwnSpeed: true, Speed: Speed{Mode: "insane"}},
	}
	if s, ok := fastestSpeed(&st); !ok || s.Mode != "insane" {
		t.Errorf("got %+v", s)
	}
}
