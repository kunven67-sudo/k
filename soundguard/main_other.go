//go:build !windows

package main

// Not Windows: the same page + guard with a pretend PC, for testing the look and the fixes.
//   go run . [port]   -> prints the URL.  POST /api/fake {"cmd":"..."} breaks things on purpose.

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
)

type fakePC struct {
	mu       sync.Mutex
	devs     []Device
	stuck    bool
	driver   bool
	privacy  bool
	audiosrv string
	talkTill time.Time
	start    time.Time
	notes    []string
	tray     string
}

func newFakePC() *fakePC {
	p := &fakePC{privacy: true, audiosrv: "running", start: time.Now()}
	p.devs = []Device{
		{ID: "out-rt", Name: "Speakers / Headphones", Adapter: "Realtek(R) Audio", Out: true, State: "active", Bus: "HDAUDIO",
			DefMain: true, DefComm: false, Volume: 0.62, Jacks: []Jack{{Where: "back", Color: "#00ff00"}, {Where: "front", Color: "#00ff00", Plugged: true}}},
		{ID: "out-tv", Name: "LG TV", Adapter: "NVIDIA High Definition Audio", Out: true, State: "active", Bus: "HDAUDIO",
			DefComm: true, Volume: 1},
		{ID: "in-rt", Name: "Jack Mic", Adapter: "Realtek(R) Audio", Out: false, State: "active", Bus: "HDAUDIO",
			DefMain: true, DefComm: true, Volume: 1, Jacks: []Jack{{Where: "front", Color: "#ff00ff", Plugged: true}}},
		{ID: "in-mix", Name: "Stereo Mix", Adapter: "Realtek(R) Audio", Out: false, State: "disabled", Bus: "HDAUDIO", Volume: -1},
	}
	return p
}

func (p *fakePC) find(id string) *Device {
	for i := range p.devs {
		if p.devs[i].ID == id {
			return &p.devs[i]
		}
	}
	return nil
}

func (p *fakePC) Devices() ([]Device, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	out := make([]Device, len(p.devs))
	copy(out, p.devs)
	return out, nil
}

func (p *fakePC) playing() float64 {
	t := time.Since(p.start).Seconds()
	return 0.25 + 0.2*math.Abs(math.Sin(t*2.1)) + 0.15*rand.Float64()
}

func (p *fakePC) Peak(id string) float64 {
	p.mu.Lock()
	defer p.mu.Unlock()
	d := p.find(id)
	if d == nil || d.State != "active" || d.Muted || p.stuck {
		return 0
	}
	return p.playing() * math.Min(1, d.Volume*1.4)
}

func (p *fakePC) Sessions(id string) []Session {
	if id != "out-rt" {
		return nil
	}
	pk := p.Peak(id)
	return []Session{{Name: "Game", PID: 4321, Active: true, Peak: pk}, {Name: "Discord", PID: 99, Active: true, Peak: pk * 0.3 * rand.Float64()},
		{Name: "Windows sounds", PID: 0, System: true}}
}

func (p *fakePC) SetVolume(id string, v float64) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if d := p.find(id); d != nil {
		d.Volume = v
		return nil
	}
	return fmt.Errorf("not found")
}

func (p *fakePC) SetMute(id string, m bool) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if d := p.find(id); d != nil {
		d.Muted = m
		return nil
	}
	return fmt.Errorf("not found")
}

func (p *fakePC) SetDefault(id string) (string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	d := p.find(id)
	if d == nil {
		return "", fmt.Errorf("not found")
	}
	for i := range p.devs {
		if p.devs[i].Out == d.Out {
			p.devs[i].DefMain, p.devs[i].DefComm = false, false
		}
	}
	d.DefMain, d.DefComm = true, true
	return "fake", nil
}

func (p *fakePC) Enable(id string) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if d := p.find(id); d != nil {
		d.State = "active"
		if d.Volume < 0 {
			d.Volume = 1
		}
	}
	return nil
}

func (p *fakePC) EngineTest(id string) TestResult {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.stuck {
		return TestResult{Detail: "Windows didn't take any sound in 1.5 s (fake)"}
	}
	return TestResult{OK: true, Detail: "sound moves (fake)"}
}

func (p *fakePC) PlayTest(id, side string) (float64, error) {
	time.Sleep(1200 * time.Millisecond)
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.stuck {
		return 0, nil
	}
	return 0.21, nil
}

func (p *fakePC) MicListen(id string) {}
func (p *fakePC) MicLevel() float64 {
	p.mu.Lock()
	defer p.mu.Unlock()
	d := p.find("in-rt")
	if d == nil || d.State != "active" || d.Muted {
		return 0
	}
	if time.Now().Before(p.talkTill) {
		return (0.2 + 0.5*rand.Float64()) * d.Volume
	}
	return 0.004 * rand.Float64()
}

func (p *fakePC) Admin() bool              { return true }
func (p *fakePC) Installed() bool          { return true }
func (p *fakePC) Startup() bool            { return true }
func (p *fakePC) SetStartup(on bool) error { return nil }
func (p *fakePC) Services() map[string]string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return map[string]string{"Audiosrv": p.audiosrv, "AudioEndpointBuilder": "running"}
}
func (p *fakePC) StartService(name string) error {
	p.mu.Lock()
	p.audiosrv = "running"
	p.mu.Unlock()
	return nil
}
func (p *fakePC) RestartAudio() error { return nil }
func (p *fakePC) DriverIssues() []DriverIssue {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.driver {
		return []DriverIssue{{Name: "Realtek High Definition Audio", NeedRestart: true}}
	}
	return nil
}
func (p *fakePC) DriverInfo() string { return "Realtek High Definition Audio 6.0.1.6122 (6-15-2017)" }
func (p *fakePC) MicPrivacy() (bool, string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.privacy, "Let apps use the mic"
}
func (p *fakePC) FixMicPrivacy() error {
	p.mu.Lock()
	p.privacy = true
	p.mu.Unlock()
	return nil
}
func (p *fakePC) RestartPC() error { p.note("restart PC pressed"); return nil }
func (p *fakePC) Notify(t, s string) { p.note("popup: " + t + " / " + s) }
func (p *fakePC) SetTray(bad bool, tip string) {
	p.mu.Lock()
	p.tray = tip
	p.mu.Unlock()
}
func (p *fakePC) Uninstall() error { p.note("uninstall pressed"); return nil }
func (p *fakePC) note(s string) {
	p.mu.Lock()
	p.notes = append(p.notes, s)
	p.mu.Unlock()
}

func main() {
	pc := newFakePC()
	dir, _ := os.MkdirTemp("", "sg")
	app := NewApp(pc, dir, 1)
	app.OpenWindow = func() {}
	app.Quit = func() {}
	app.extraAPI = func(w http.ResponseWriter, r *http.Request) bool {
		if r.URL.Path != "/api/fake" {
			return false
		}
		var q struct{ Cmd string }
		json.NewDecoder(r.Body).Decode(&q)
		pc.mu.Lock()
		switch q.Cmd {
		case "mute-out":
			pc.find("out-rt").Muted = true
		case "vol0-out":
			pc.find("out-rt").Volume = 0
		case "mute-in":
			pc.find("in-rt").Muted = true
		case "vol-in-low":
			pc.find("in-rt").Volume = 0.1
		case "unplug-out":
			pc.find("out-rt").Jacks[1].Plugged = false
		case "plug-out":
			pc.find("out-rt").Jacks[1].Plugged = true
		case "unplug-in":
			pc.find("in-rt").State = "unplugged"
		case "plug-in":
			pc.find("in-rt").State = "active"
		case "disable-out":
			pc.find("out-rt").State = "disabled"
		case "default-tv":
			for i := range pc.devs {
				if pc.devs[i].Out {
					pc.devs[i].DefMain = pc.devs[i].ID == "out-tv"
					pc.devs[i].DefComm = pc.devs[i].ID == "out-tv"
				}
			}
		case "stuck":
			pc.stuck = true
		case "unstuck":
			pc.stuck = false
		case "driver":
			pc.driver = true
		case "driver-ok":
			pc.driver = false
		case "privacy":
			pc.privacy = false
		case "audiosrv-off":
			pc.audiosrv = "stopped"
		case "talk":
			pc.talkTill = time.Now().Add(4 * time.Second)
		case "usb":
			pc.devs = append(pc.devs, Device{ID: "out-usb", Name: "Headphones", Adapter: "USB Audio Device", Out: true, State: "active", Bus: "USB", Volume: 0.5},
				Device{ID: "in-usb", Name: "Microphone", Adapter: "USB Audio Device", Out: false, State: "active", Bus: "USB", Volume: 0.8})
		}
		notes := pc.notes
		tray := pc.tray
		pc.mu.Unlock()
		writeJSON(w, map[string]any{"notes": notes, "tray": tray})
		return true
	}
	port := 0
	if len(os.Args) > 1 {
		port, _ = strconv.Atoi(os.Args[1])
	}
	url, err := app.Serve(port)
	if err != nil {
		panic(err)
	}
	fmt.Println(url)
	app.Run()
}
