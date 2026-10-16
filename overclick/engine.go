package main

import (
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

// Backend does the real clicking. Click returns how many clicks really happened:
// 0 when it skipped (the spot is on OVERCLICK itself), 2 for a double click.
type Backend interface {
	Click(c *ClickerCfg, returnMouse bool) int
}

type runConfig struct {
	clickers    []ClickerCfg
	main        Speed
	returnMouse bool
}

func newRunConfig(st *Settings) *runConfig {
	rc := &runConfig{main: st.Main, returnMouse: st.ReturnMouse}
	for _, c := range st.Clickers {
		if c.On {
			rc.clickers = append(rc.clickers, c)
		}
	}
	return rc
}

type runClicker struct {
	cfg      ClickerCfg
	interval time.Duration
	next     time.Time
}

type Engine struct {
	backend  Backend
	onFinish func() // runs in its own goroutine when a stop rule ends the run

	mu      sync.Mutex
	running bool
	stopCh  chan struct{}
	doneCh  chan struct{}
	started time.Time

	pending atomic.Pointer[runConfig]
	wake    chan struct{}
	total   atomic.Int64
}

func NewEngine(b Backend) *Engine {
	return &Engine{backend: b, wake: make(chan struct{}, 1)}
}

func (e *Engine) Start(rc *runConfig, stop StopRule) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.running {
		return false
	}
	e.running = true
	e.total.Store(0)
	e.started = time.Now()
	e.stopCh = make(chan struct{})
	e.doneCh = make(chan struct{})
	e.pending.Store(rc)
	select { // drop a stale wake-up from the last run
	case <-e.wake:
	default:
	}
	go e.loop(e.stopCh, e.doneCh, stop, e.started)
	return true
}

// Stop ends the run and waits until the click loop has really quit, so no
// click can sneak out after it returns. It reports the clicks done this run.
func (e *Engine) Stop() (int64, bool) {
	e.mu.Lock()
	if !e.running {
		e.mu.Unlock()
		return 0, false
	}
	e.running = false
	close(e.stopCh)
	done := e.doneCh
	e.mu.Unlock()
	<-done
	return e.total.Load(), true
}

// Update swaps in new clickers/speeds while running, without restarting the run.
func (e *Engine) Update(rc *runConfig) {
	e.pending.Store(rc)
	select {
	case e.wake <- struct{}{}:
	default:
	}
}

func (e *Engine) Running() bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.running
}

func (e *Engine) Total() int64 { return e.total.Load() }

func (e *Engine) Elapsed() time.Duration {
	e.mu.Lock()
	defer e.mu.Unlock()
	if !e.running {
		return 0
	}
	return time.Since(e.started)
}

func buildList(rc *runConfig, now time.Time, old []*runClicker) []*runClicker {
	prev := map[int]*runClicker{}
	for _, r := range old {
		prev[r.cfg.ID] = r
	}
	list := make([]*runClicker, 0, len(rc.clickers))
	for _, c := range rc.clickers {
		r := &runClicker{cfg: c, interval: c.EffectiveSpeed(rc.main).Interval(), next: now}
		// Keep the rhythm of clickers whose speed didn't change.
		if p, ok := prev[c.ID]; ok && p.interval == r.interval {
			r.next = p.next
		}
		list = append(list, r)
	}
	return list
}

const (
	waitReached = iota
	waitStopped
	waitWoken
)

// waitUntil sleeps until t. It sleeps most of the way, then spins the last
// millisecond, because Windows timers alone are too rough for 100+ clicks/s.
func waitUntil(t time.Time, stop, wake <-chan struct{}) int {
	for {
		d := time.Until(t)
		if d <= 0 {
			return waitReached
		}
		if d > 2*time.Millisecond {
			timer := time.NewTimer(d - time.Millisecond)
			select {
			case <-stop:
				timer.Stop()
				return waitStopped
			case <-wake:
				timer.Stop()
				return waitWoken
			case <-timer.C:
			}
			continue
		}
		select {
		case <-stop:
			return waitStopped
		case <-wake:
			return waitWoken
		default:
		}
		runtime.Gosched()
	}
}

func (e *Engine) loop(stopCh, done chan struct{}, stop StopRule, start time.Time) {
	finished := false
	defer func() {
		close(done)
		if finished && e.onFinish != nil {
			go e.onFinish()
		}
	}()

	var deadline time.Time
	if stop.Mode == "time" {
		deadline = start.Add(time.Duration(stop.Seconds * float64(time.Second)))
	}
	var cur *runConfig
	var list []*runClicker
	spins := 0
	for {
		if p := e.pending.Load(); p != cur {
			cur = p
			list = buildList(cur, time.Now(), list)
		}
		select {
		case <-stopCh:
			return
		default:
		}

		// Nothing switched on: just idle until something changes or time runs out.
		var nx *runClicker
		for _, r := range list {
			if nx == nil || r.next.Before(nx.next) {
				nx = r
			}
		}
		target := time.Now().Add(time.Hour)
		if nx != nil {
			target = nx.next
		}
		if !deadline.IsZero() && deadline.Before(target) {
			target = deadline
		}
		switch waitUntil(target, stopCh, e.wake) {
		case waitStopped:
			return
		case waitWoken:
			continue
		}
		now := time.Now()
		if !deadline.IsZero() && !now.Before(deadline) {
			finished = true
			return
		}
		if nx == nil || now.Before(nx.next) {
			continue
		}

		n := e.backend.Click(&nx.cfg, cur.returnMouse)
		total := e.total.Add(int64(n))

		now = time.Now()
		switch {
		case n == 0 && nx.interval < time.Millisecond:
			nx.next = now.Add(time.Millisecond) // skipped: don't burn the CPU retrying
		case nx.interval == 0:
			nx.next = now
		default:
			nx.next = nx.next.Add(nx.interval)
			// Fell way behind (PC busy)? Carry on from now instead of a burst of catch-up clicks.
			if now.Sub(nx.next) > 50*time.Millisecond {
				nx.next = now
			}
		}

		if stop.Mode == "clicks" && total >= stop.Clicks {
			finished = true
			return
		}
		if nx.interval < time.Millisecond {
			if spins++; spins%32 == 0 {
				runtime.Gosched()
			}
		}
	}
}

// cpsMeter turns the running click total into clicks per second over the last ~1s.
type cpsMeter struct {
	samples []cpsSample
}

type cpsSample struct {
	t     time.Time
	total int64
}

func (m *cpsMeter) Reset() { m.samples = m.samples[:0] }

func (m *cpsMeter) Add(t time.Time, total int64) float64 {
	m.samples = append(m.samples, cpsSample{t, total})
	for len(m.samples) > 2 && t.Sub(m.samples[1].t) >= time.Second {
		m.samples = m.samples[1:]
	}
	first := m.samples[0]
	dt := t.Sub(first.t).Seconds()
	if dt <= 0 {
		return 0
	}
	return float64(total-first.total) / dt
}

// fastestSpeed is the wildest mode among the switched-on clickers (for the HUD badge).
func fastestSpeed(st *Settings) (Speed, bool) {
	var best Speed
	found := false
	for _, c := range st.Clickers {
		if !c.On {
			continue
		}
		s := c.EffectiveSpeed(st.Main)
		if !found || s.rank() > best.rank() || (s.rank() == best.rank() && s.Interval() < best.Interval()) {
			best, found = s, true
		}
	}
	return best, found
}
