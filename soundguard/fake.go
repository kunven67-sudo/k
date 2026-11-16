package main

// fake.go = a pretend PC: Realtek front jack + a TV over HDMI.
// Used by the tests and by the Linux preview build. Never used on Windows for real.

import (
	"errors"
	"math"
	"sync"
	"time"
)

const (
	idHP   = "{0.0.0.00000000}.{realtek-out}"
	idTV   = "{0.0.0.00000000}.{hdmi-tv}"
	idMic  = "{0.0.1.00000000}.{realtek-mic}"
	idMix  = "{0.0.1.00000000}.{stereo-mix}"
	idUSBo = "{0.0.0.00000000}.{usb-out}"
	idUSBi = "{0.0.1.00000000}.{usb-in}"
)

type FakePC struct {
	mu         sync.Mutex
	S          Snap
	Frozen     bool // device stopped taking sound
	HardFrozen bool // ...and a service restart doesn't help (needs a PC restart)
	CanDef     bool
	Playing    bool    // a game/video is playing sound
	Level      float64 // how loud it plays
	Restarts   int
	Reboots    int
	Calls      []string
	FailMute   bool
	StuckSnap  bool
	Demo       bool // animate meters + slow tests (Linux preview)
	t0         time.Time
}

func newFakePC() *FakePC {
	f := &FakePC{CanDef: true, Playing: true, Level: 0.4, t0: time.Now()}
	f.S = Snap{
		Devs: []Dev{
			{ID: idHP, Flow: "out", Name: "Speakers / Headphones", Adapter: "Realtek Audio", State: "active", Form: 1, Bus: "hda", Realtek: true, Volume: 0.45, JackKnown: true, JackIn: true, Front: true},
			{ID: idTV, Flow: "out", Name: "HDMI TV", Adapter: "NVIDIA High Definition Audio", State: "active", Form: 9, Bus: "hdmi", Volume: 1},
			{ID: idMic, Flow: "in", Name: "Jack Mic", Adapter: "Realtek Audio", State: "active", Form: 4, Bus: "hda", Realtek: true, Volume: 1},
			{ID: idMix, Flow: "in", Name: "Stereo Mix", Adapter: "Realtek Audio", State: "disabled", Form: 10, Bus: "hda", Realtek: true, Volume: 1},
		},
		DefOut: idHP, DefOutComm: idHP, DefIn: idMic, DefInComm: idMic, SvcRunning: true,
	}
	return f
}

func (f *FakePC) dev(id string) *Dev { return f.S.dev(id) }

func (f *FakePC) call(s string) { f.Calls = append(f.Calls, s) }

func (f *FakePC) Snapshot() (Snap, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.StuckSnap {
		return Snap{}, ErrStuck
	}
	s := f.S
	s.Devs = append([]Dev(nil), f.S.Devs...)
	s.OthersPlaying = f.Playing
	if f.Playing && !f.Frozen && s.SvcRunning {
		if d := s.dev(s.DefOut); d.active() && !d.Muted {
			s.OutPeak = f.Level
		}
	}
	return s, nil
}

func (f *FakePC) SetMute(id string, m bool) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.call("mute " + id)
	if f.FailMute {
		return errors.New("access denied")
	}
	if d := f.dev(id); d != nil {
		d.Muted = m
		return nil
	}
	return errors.New("no device")
}

func (f *FakePC) SetVolume(id string, v float64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.call("volume " + id)
	if d := f.dev(id); d != nil {
		d.Volume = v
		return nil
	}
	return errors.New("no device")
}

func (f *FakePC) SetDefault(id string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.call("default " + id)
	d := f.dev(id)
	if d == nil || !d.active() {
		return errors.New("device not active")
	}
	if d.Flow == "out" {
		f.S.DefOut, f.S.DefOutComm = id, id
	} else {
		f.S.DefIn, f.S.DefInComm = id, id
	}
	return nil
}

func (f *FakePC) CanSetDefault() bool { return f.CanDef }

func (f *FakePC) Probe(id string) ProbeResult {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.call("probe " + id)
	if f.Frozen {
		return ProbeStuck
	}
	return ProbeOK
}

func (f *FakePC) RestartAudio() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.call("restart-audio")
	f.Restarts++
	f.S.SvcRunning = true
	f.StuckSnap = false
	if !f.HardFrozen {
		f.Frozen = false
	}
	return nil
}

func (f *FakePC) FixMicPrivacy() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.call("privacy")
	f.S.MicBlocked = false
	return nil
}

func (f *FakePC) PlayTest(id string) SoundTest {
	if f.Demo {
		time.Sleep(1500 * time.Millisecond)
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.call("playtest " + id)
	if f.Frozen {
		return SoundTest{Sent: false}
	}
	return SoundTest{Sent: true, Peak: 0.42}
}

func (f *FakePC) RecordTest(in, out string, secs float64, level func(float64)) MicTest {
	steps := 20
	for i := 0; i < steps; i++ {
		if f.Demo {
			time.Sleep(time.Duration(secs*1000/float64(steps)) * time.Millisecond)
		}
		level(0.15 + 0.5*math.Abs(math.Sin(float64(i)/2.3)))
	}
	level(-1)
	if f.Demo {
		time.Sleep(time.Duration(secs*1000) * time.Millisecond)
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.call("rectest " + in)
	if d := f.dev(in); d == nil || !d.active() {
		return MicTest{NoDevice: true, Error: "Windows doesn't see a mic right now."}
	}
	return MicTest{Peak: 0.62, Avg: 0.11, Played: true}
}

func (f *FakePC) LivePeaks(outID, inID string, mic bool) (float64, float64) {
	f.mu.Lock()
	defer f.mu.Unlock()
	t := time.Since(f.t0).Seconds()
	var o, i float64
	if f.Playing && !f.Frozen {
		if d := f.dev(outID); d.active() && !d.Muted {
			o = f.Level * (0.55 + 0.45*math.Abs(math.Sin(t*3.1)*math.Cos(t*1.7)))
		}
	}
	if mic {
		if d := f.dev(inID); d.active() && !d.Muted {
			v := math.Sin(t*0.9) * math.Sin(t*5.3)
			if v > 0.15 {
				i = v * 0.7
			} else {
				i = 0.012 * math.Abs(math.Sin(t*17))
			}
		}
	}
	return o, i
}

func (f *FakePC) StopLive() {}

func (f *FakePC) RebootPC() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.Reboots++
	if f.Demo {
		return errors.New("(preview) this would restart your PC")
	}
	return nil
}

func (f *FakePC) Driver() DriverInfo {
	return DriverInfo{Name: "Realtek Audio", Version: "6.0.1.6122", Date: "2017-03-30", Provider: "Realtek Semiconductor Corp.", Inf: "oem12.inf", Model: "Dell Inc. OptiPlex 7040",
		HWID: `HDAUDIO\FUNC_01&VEN_10EC&DEV_0255&SUBSYS_102806B9`}
}

func (f *FakePC) DriverSearch() ([]DriverUpdate, error) {
	if f.Demo {
		time.Sleep(2500 * time.Millisecond)
	}
	return nil, nil
}

func (f *FakePC) DriverInstall(id string) (bool, error) { return true, nil }
func (f *FakePC) OpenSoundSettings() error             { return nil }

// ---- test helpers ----

func (f *FakePC) Set(fn func(f *FakePC)) {
	f.mu.Lock()
	defer f.mu.Unlock()
	fn(f)
}

func (f *FakePC) addUSB() {
	f.S.Devs = append(f.S.Devs,
		Dev{ID: idUSBo, Flow: "out", Name: "Headphones", Adapter: "USB Audio Device", State: "active", Form: 3, Bus: "usb", Volume: 0.5},
		Dev{ID: idUSBi, Flow: "in", Name: "Microphone", Adapter: "USB Audio Device", State: "active", Form: 4, Bus: "usb", Volume: 0.8},
	)
}

type nopUI struct {
	notes  []string
	popups []string
	tray   string
}

func (u *nopUI) Notify(t, b string) { u.notes = append(u.notes, t+": "+b) }
func (u *nopUI) Popup(k string)     { u.popups = append(u.popups, k) }
func (u *nopUI) Tray(l string)      { u.tray = l }
