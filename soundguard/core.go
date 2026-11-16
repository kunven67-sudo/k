package main

// core.go = SOUNDGUARD's brain. It never talks to Windows itself: it asks a
// Backend (the real PC in win_*.go, or the fake PC in fake.go for tests).
// Rules: fix it live, never restart the PC by itself, never touch games. A stuck driver only gets a "restart when you're done" popup.

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const appVersion = "1.0.0"

// ErrStuck = Windows audio didn't answer in time (hung driver / service).
var ErrStuck = errors.New("windows audio is not answering")

// Dev = one sound device (Windows calls it an endpoint).
type Dev struct {
	ID        string  `json:"id"`
	Flow      string  `json:"flow"`    // "out" (you hear) or "in" (mic)
	Name      string  `json:"name"`    // "Speakers / Headphones"
	Adapter   string  `json:"adapter"` // "Realtek Audio"
	State     string  `json:"state"`   // active, unplugged, disabled
	Form      int     `json:"form"`    // Windows form factor (3 headphones, 5 headset, 9 TV/HDMI ...)
	Bus       string  `json:"bus"`     // hda, usb, hdmi, bt, virtual, other
	Realtek   bool    `json:"realtek"`
	Volume    float64 `json:"volume"` // 0..1
	Muted     bool    `json:"muted"`
	JackKnown bool    `json:"jackKnown"` // the driver tells us about its jacks
	JackIn    bool    `json:"jackIn"`    // a plug is in a real jack (not the built-in speaker)
	Front     bool    `json:"front"`     // ...in a front jack
}

func (d *Dev) active() bool { return d != nil && d.State == "active" }

// plugged = something you wear is connected to this device right now.
func (d *Dev) plugged() bool {
	if !d.active() {
		return false
	}
	if d.JackKnown {
		return d.JackIn
	}
	return true
}

// headphoneish = a device you wear (front/back jack plug, USB adapter, headset, BT).
func (d *Dev) headphoneish() bool {
	if d == nil {
		return false
	}
	if d.JackKnown && d.JackIn {
		return true
	}
	return d.Bus == "usb" || d.Bus == "bt" || d.Form == 3 || d.Form == 5
}

func (d *Dev) isTV() bool { return d != nil && (d.Bus == "hdmi" || d.Form == 9) }

func isStereoMix(d *Dev) bool {
	if d == nil {
		return false
	}
	n := strings.ToLower(d.Name)
	return strings.Contains(n, "stereo mix") || strings.Contains(n, "what u hear") || strings.Contains(n, "wave out mix")
}

// Snap = what the PC looks like right now.
type Snap struct {
	Devs          []Dev
	DefOut        string // default device for normal sound
	DefOutComm    string // default device for calls (Discord etc)
	DefIn         string
	DefInComm     string
	OutPeak       float64 // how loud Windows is sending sound to DefOut right now (0..1)
	OthersPlaying bool    // some app has an open, running sound stream on DefOut
	SvcRunning    bool    // Windows Audio service
	MicBlocked    bool    // Windows privacy switch blocks apps from the mic
	Busy          bool    // full screen game / presentation: don't pop windows
}

func (s *Snap) dev(id string) *Dev {
	if id == "" {
		return nil
	}
	for i := range s.Devs {
		if s.Devs[i].ID == id {
			return &s.Devs[i]
		}
	}
	return nil
}

type ProbeResult int

const (
	ProbeOK    ProbeResult = iota // Windows is moving sound to the device
	ProbeStuck                    // the device froze (driver stuck)
	ProbeBusy                     // a game owns the device (exclusive mode) - can't tell, leave it
	ProbeErr                      // something else went wrong
)

// SoundTest = result of "Play test sound".
type SoundTest struct {
	Sent  bool    `json:"sent"`  // Windows really sent the sound to the device
	Peak  float64 `json:"peak"`  // loudest level Windows saw
	Error string  `json:"error"` // why it failed
}

// MicTest = result of "Test my mic" (records, then plays it back).
type MicTest struct {
	Peak     float64 `json:"peak"`
	Avg      float64 `json:"avg"`
	Played   bool    `json:"played"`
	Error    string  `json:"error"`
	Blocked  bool    `json:"blocked"`
	NoDevice bool    `json:"noDevice"`
}

type DriverInfo struct {
	Name     string `json:"name"`
	Version  string `json:"version"`
	Date     string `json:"date"`
	Provider string `json:"provider"`
	Inf      string `json:"inf"`
	HWID     string `json:"hwid"`
	Model    string `json:"model"` // PC maker + model (from the BIOS)
}

// dellNewest = the newest Realtek audio driver Dell ever released for some older Dell PCs
// (from Dell's own driver pages). "" = we don't know this PC.
func dellNewest(model string) string {
	m := strings.ToLower(model)
	for k, v := range map[string]string{"optiplex 7040": "6.0.1.6122"} {
		if strings.Contains(m, k) {
			return v
		}
	}
	return ""
}

type DriverUpdate struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Version string `json:"version"`
	Date    string `json:"date"`
}

// Backend = the PC. Everything here must give up instead of hanging forever.
type Backend interface {
	Snapshot() (Snap, error)
	SetMute(id string, mute bool) error
	SetVolume(id string, v float64) error
	SetDefault(id string) error // console + multimedia + communications
	CanSetDefault() bool
	Probe(id string) ProbeResult // silent check: does the device take sound
	RestartAudio() error         // restart (or start) the Windows Audio service = 2 s blip
	FixMicPrivacy() error
	PlayTest(id string) SoundTest
	RecordTest(inID, outID string, secs float64, level func(float64)) MicTest
	LivePeaks(outID, inID string, mic bool) (out, in float64)
	StopLive()
	RebootPC() error
	Driver() DriverInfo
	DriverSearch() ([]DriverUpdate, error)
	DriverInstall(id string) (reboot bool, err error)
	OpenSoundSettings() error
}

// UIHooks = tray icon, Windows notifications, popups.
type UIHooks interface {
	Notify(title, body string)
	Popup(kind string) // "restart"
	Tray(level string) // ok, warn, bad
}

type Event struct {
	T    int64  `json:"t"`    // unix ms
	Kind string `json:"kind"` // fix, good, info, warn, bad
	Text string `json:"text"`
}

type Settings struct {
	AutoFix     bool `json:"autoFix"`     // fix things by itself
	PlugSwitch  bool `json:"plugSwitch"`  // plug headphones in = sound + calls go to them
	MicReminder bool `json:"micReminder"` // "push the plug all the way in" reminder
	LiveMic     bool `json:"liveMic"`     // show the live mic level while the window is open
}

func defaultSettings() Settings {
	return Settings{AutoFix: true, PlugSwitch: true, MicReminder: true, LiveMic: true}
}

// ---------- published state (what the window shows) ----------

type Status struct {
	Level string `json:"level"` // ok, fixing, warn, bad
	Title string `json:"title"`
	Sub   string `json:"sub"`
}

type TestState struct {
	Running bool       `json:"running"`
	Done    bool       `json:"done"`
	At      int64      `json:"at"`
	Sound   *SoundTest `json:"sound,omitempty"`
	Mic     *MicTest   `json:"mic,omitempty"`
	Level   float64    `json:"level"` // live level while the mic test records
	Phase   string     `json:"phase"` // record, play
	Answer  string     `json:"answer"`
}

type DriverState struct {
	Info       DriverInfo     `json:"info"`
	DellNewest string         `json:"dellNewest"`
	Checking   bool           `json:"checking"`
	Checked    bool           `json:"checked"`
	CheckedAt  int64          `json:"checkedAt"`
	Found      []DriverUpdate `json:"found"`
	Error      string         `json:"error"`
	Installing bool           `json:"installing"`
	Installed  bool           `json:"installed"`
	Reboot     bool           `json:"reboot"`
}

type PubState struct {
	Version     string      `json:"version"`
	Mode        string      `json:"mode"` // guard, setup, demo
	Status      Status      `json:"status"`
	Out         *Dev        `json:"out"`
	OutComm     *Dev        `json:"outComm"`
	In          *Dev        `json:"in"`
	Devs        []Dev       `json:"devs"`
	TV          *Dev        `json:"tv"`
	MicMissing  bool        `json:"micMissing"`
	MicBlocked  bool        `json:"micBlocked"`
	OutFrozen   bool        `json:"outFrozen"`
	NeedRestart bool        `json:"needRestart"`
	Stuck       bool        `json:"stuck"`
	CanDefault  bool        `json:"canDefault"`
	Events      []Event     `json:"events"`
	Settings    Settings    `json:"settings"`
	SoundTest   TestState   `json:"soundTest"`
	MicTest     TestState   `json:"micTest"`
	Driver      DriverState `json:"driver"`
	Busy        bool        `json:"busy"`
	Fixing      bool        `json:"fixing"`
	StartsWithW bool        `json:"startsWithWindows"`
}

// ---------- the guardian ----------

type Guardian struct {
	b    Backend
	ui   UIHooks
	now  func() time.Time
	dir  string // where settings + events are saved ("" = don't save)
	cmds chan func()

	// owned by the loop goroutine
	snap       Snap
	have       bool
	respect    map[string]bool
	fixedAt    map[string]time.Time
	pairFixed  map[string]bool
	warned     map[string]time.Time
	svcAt      time.Time
	privacyAt  time.Time
	zeroSince  time.Time
	lastProbe  time.Time
	probeGap   time.Duration
	recheckAt  time.Time
	needSince  time.Time
	snooze     time.Time
	popupOpen  bool
	stuckN     int
	micSince   time.Time
	micWarned  bool
	lastTickAt time.Time
	firstTick  time.Time // Windows may still be starting its sound stuff right after logon

	// shared with the web server (under mu)
	mu          sync.Mutex
	set         Settings
	events      []Event
	pub         PubState
	needRestart bool
	stuck       bool
	frozen      bool
	micMissing  bool
	soundTest   TestState
	micTest     TestState
	driver      DriverState
	fixingUntil time.Time
	liveAt      time.Time
	startsWithW func() bool
}

func NewGuardian(b Backend, ui UIHooks, dir string) *Guardian {
	g := &Guardian{
		b: b, ui: ui, now: time.Now, dir: dir, cmds: make(chan func(), 32),
		respect: map[string]bool{}, fixedAt: map[string]time.Time{}, pairFixed: map[string]bool{},
		warned: map[string]time.Time{}, probeGap: 0, set: defaultSettings(),
	}
	g.load()
	return g
}

func (g *Guardian) load() {
	if g.dir == "" {
		return
	}
	if b, err := os.ReadFile(filepath.Join(g.dir, "settings.json")); err == nil {
		s := defaultSettings()
		if json.Unmarshal(b, &s) == nil {
			g.set = s
		}
	}
	if b, err := os.ReadFile(filepath.Join(g.dir, "events.json")); err == nil {
		var ev []Event
		if json.Unmarshal(b, &ev) == nil {
			g.events = ev
		}
	}
}

func (g *Guardian) saveLocked() {
	if g.dir == "" {
		return
	}
	os.MkdirAll(g.dir, 0o755)
	if b, err := json.MarshalIndent(g.set, "", " "); err == nil {
		writeFileAtomic(filepath.Join(g.dir, "settings.json"), b)
	}
	if b, err := json.Marshal(g.events); err == nil {
		writeFileAtomic(filepath.Join(g.dir, "events.json"), b)
	}
}

func writeFileAtomic(path string, b []byte) {
	tmp := path + ".tmp"
	if os.WriteFile(tmp, b, 0o644) == nil {
		if os.Rename(tmp, path) != nil {
			os.Remove(tmp)
		}
	}
}

func (g *Guardian) event(kind, text string) {
	g.mu.Lock()
	g.events = append(g.events, Event{T: g.now().UnixMilli(), Kind: kind, Text: text})
	if len(g.events) > 150 {
		g.events = append([]Event(nil), g.events[len(g.events)-150:]...)
	}
	if kind == "fix" {
		g.fixingUntil = g.now().Add(5 * time.Second)
	}
	g.saveLocked()
	g.mu.Unlock()
	logf("event %s: %s", kind, text)
}

// warnOnce = same warning at most every 10 minutes.
func (g *Guardian) warnOnce(key, kind, text string) {
	now := g.now()
	if t, ok := g.warned[key]; ok && now.Sub(t) < 10*time.Minute {
		return
	}
	g.warned[key] = now
	g.event(kind, text)
}

func (g *Guardian) settings() Settings {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.set
}

// Run = the loop. One tick per second. UI commands run between ticks.
func (g *Guardian) Run(stop <-chan struct{}) {
	t := time.NewTicker(time.Second)
	defer t.Stop()
	g.RefreshDriver()
	g.safeTick()
	for {
		select {
		case <-stop:
			return
		case <-t.C:
			g.safeTick()
		case c := <-g.cmds:
			g.safe(c)
			g.publish()
		}
	}
}

func (g *Guardian) safe(f func()) {
	defer func() {
		if r := recover(); r != nil {
			logf("PANIC (kept going): %v\n%s", r, stack())
		}
	}()
	f()
}

func (g *Guardian) safeTick() { g.safe(g.Tick) }

// Do = run f on the loop goroutine (from the web server).
func (g *Guardian) Do(f func()) {
	select {
	case g.cmds <- f:
	default:
		logf("command queue full, dropped one")
	}
}

// Tick = look at the PC once and fix what's broken.
func (g *Guardian) Tick() {
	now := g.now()
	g.lastTickAt = now
	if g.firstTick.IsZero() {
		g.firstTick = now
	}
	g.LiveIdle()
	s, err := g.b.Snapshot()
	if err != nil {
		g.snapFail(err, now)
		g.publish()
		return
	}
	if g.stuckN > 0 {
		g.stuckN = 0
		g.mu.Lock()
		g.stuck = false
		g.mu.Unlock()
	}
	first := !g.have
	prev := g.snap
	g.snap, g.have = s, true
	set := g.settings()
	auto := set.AutoFix

	// 0. Windows Audio service off -> turn it on (not in the first 45 s: right after logon it may still be starting)
	if !s.SvcRunning {
		if auto && now.Sub(g.svcAt) > time.Minute && now.Sub(g.firstTick) >= 45*time.Second {
			g.svcAt = now
			if err := g.b.RestartAudio(); err == nil {
				g.event("fix", "The Windows sound service was off. Turned it back on.")
			} else {
				g.warnOnce("svc", "bad", "The Windows sound service is off and I couldn't turn it on: "+err.Error())
			}
		}
		g.publish()
		return
	}

	// 1. plug in / unplug
	if !first {
		for i := range s.Devs {
			d := &s.Devs[i]
			if d.Flow != "out" {
				continue
			}
			p := prev.dev(d.ID)
			was := p != nil && p.plugged() && p.headphoneish()
			is := d.plugged() && d.headphoneish()
			if is && !was {
				g.onPlug(&s, d, set)
			} else if was && !is {
				g.event("info", d.short()+" unplugged.")
				g.micWarned = false
				g.micSince = time.Time{}
			}
		}
	}

	out := s.dev(s.DefOut)
	in := s.dev(s.DefIn)

	if auto && g.b.CanSetDefault() {
		// 2a. calls go somewhere else than your headphones (e.g. calls went to a TV)
		if out.headphoneish() && out.plugged() && s.DefOutComm != s.DefOut {
			key := "out|" + s.DefOut + "|" + s.DefOutComm
			if !g.pairFixed[key] {
				g.pairFixed[key] = true
				was := s.dev(s.DefOutComm)
				if err := g.b.SetDefault(out.ID); err == nil {
					txt := "Calls (Discord, games' voice chat) were going to " + was.short() + ". Moved them to " + out.short() + "."
					if was == nil {
						txt = "Calls had no sound device. Moved them to " + out.short() + "."
					}
					g.event("fix", txt)
					s.DefOutComm = out.ID
				}
			}
		}
		// 2b. Stereo Mix is the mic (records your PC sound, not your voice)
		if isStereoMix(in) {
			if real := bestMic(&s, out); real != nil {
				key := "stereomix|" + in.ID + "|" + real.ID
				if !g.pairFixed[key] {
					g.pairFixed[key] = true
					if err := g.b.SetDefault(real.ID); err == nil {
						g.event("fix", "Your mic was set to Stereo Mix (that records your PC sound, not your voice). Switched it to "+real.short()+".")
						s.DefIn, s.DefInComm = real.ID, real.ID
						in = s.dev(real.ID)
					}
				}
			}
		}
		// 2c. calls use a different mic than normal
		if in.active() && !isStereoMix(in) && s.DefInComm != s.DefIn {
			key := "in|" + s.DefIn + "|" + s.DefInComm
			if !g.pairFixed[key] {
				g.pairFixed[key] = true
				if err := g.b.SetDefault(in.ID); err == nil {
					g.event("fix", "Calls were using a different mic. Now they use "+in.short()+" too.")
					s.DefInComm = in.ID
				}
			}
		}
	}

	// 3. sound muted / volume at zero
	if auto && out.active() {
		g.fixMute(out, "sound")
		g.fixVol(out, "sound", 0.02, 0.25)
	}
	// 4. mic muted / volume way down
	if auto && in.active() && !isStereoMix(in) {
		g.fixMute(in, "mic")
		g.fixVol(in, "mic", 0.15, 1.0)
	}

	// 5. headphones in, but the Realtek mic says "unplugged" (plug not all the way in)
	missing := micMissing(&s)
	if missing {
		if g.micSince.IsZero() {
			g.micSince = now
		}
		if now.Sub(g.micSince) >= 4*time.Second && !g.micWarned {
			g.micWarned = true
			g.event("warn", "Your headphones are plugged in but your mic isn't detected. Pull the plug out and push it all the way back in.")
			if set.MicReminder {
				g.ui.Notify("Mic not detected", "Pull your headphone plug out and push it all the way back in.")
			}
		}
	} else {
		if g.micWarned && in.active() {
			g.event("good", "Your mic is back.")
		}
		g.micWarned = false
		g.micSince = time.Time{}
	}

	// 6. Windows privacy switch blocks the mic
	if s.MicBlocked && auto && now.Sub(g.privacyAt) > 10*time.Minute {
		g.privacyAt = now
		if err := g.b.FixMicPrivacy(); err == nil {
			g.event("fix", "Windows was blocking apps from using your mic (privacy switch). Turned it back on.")
		} else {
			g.warnOnce("privacy", "warn", "Windows is blocking apps from your mic (Settings > Privacy > Microphone).")
		}
	}

	// 7. frozen sound driver
	g.checkFlow(&s, out, now, auto)

	g.mu.Lock()
	g.micMissing = missing
	g.mu.Unlock()
	g.maybePopup(now)
	g.publish()
}

func (d *Dev) short() string {
	if d == nil {
		return "nothing"
	}
	n := d.Name
	if d.isTV() && d.Name != "" {
		return d.Name
	}
	if d.Adapter != "" && !strings.Contains(n, d.Adapter) {
		n += " (" + d.Adapter + ")"
	}
	return n
}

// bestMic = the real mic to use (same adapter as your headphones first, then USB, then anything).
func bestMic(s *Snap, out *Dev) *Dev {
	var best *Dev
	score := -1
	for i := range s.Devs {
		d := &s.Devs[i]
		if d.Flow != "in" || !d.active() || isStereoMix(d) {
			continue
		}
		sc := 1
		if out != nil && d.Adapter == out.Adapter {
			sc += 4
		}
		if d.Bus == "usb" {
			sc += 2
		}
		if d.Form == 4 || d.Form == 5 {
			sc++
		}
		if sc > score {
			best, score = d, sc
		}
	}
	return best
}

// micMissing = a Realtek jack has headphones in it, but the Realtek mic is "unplugged".
func micMissing(s *Snap) bool {
	for i := range s.Devs {
		o := &s.Devs[i]
		if o.Flow != "out" || !o.Realtek || !o.JackKnown || !o.JackIn || !o.active() {
			continue
		}
		unpl, act := false, false
		for j := range s.Devs {
			m := &s.Devs[j]
			if m.Flow != "in" || !m.Realtek || isStereoMix(m) || m.Adapter != o.Adapter {
				continue
			}
			if m.State == "unplugged" {
				unpl = true
			}
			if m.active() && m.Form != 2 { // ignore line-in
				act = true
			}
		}
		if unpl && !act {
			return true
		}
	}
	return false
}

func (g *Guardian) onPlug(s *Snap, d *Dev, set Settings) {
	g.micWarned = false
	g.micSince = time.Time{}
	if !set.PlugSwitch || !set.AutoFix || !g.b.CanSetDefault() {
		g.event("info", d.short()+" plugged in.")
		return
	}
	changed := false
	if s.DefOut != d.ID || s.DefOutComm != d.ID {
		if err := g.b.SetDefault(d.ID); err == nil {
			s.DefOut, s.DefOutComm = d.ID, d.ID
			changed = true
		}
	}
	// a USB adapter / headset has its own mic: use it too
	if d.Bus == "usb" || d.Bus == "bt" {
		for i := range s.Devs {
			m := &s.Devs[i]
			if m.Flow == "in" && m.active() && m.Adapter == d.Adapter && m.Bus == d.Bus {
				if s.DefIn != m.ID || s.DefInComm != m.ID {
					if g.b.SetDefault(m.ID) == nil {
						s.DefIn, s.DefInComm = m.ID, m.ID
						changed = true
					}
				}
				break
			}
		}
	}
	if changed {
		g.event("fix", d.short()+" plugged in. Sound and calls now go to them.")
	} else {
		g.event("info", d.short()+" plugged in.")
	}
}

func (g *Guardian) fixMute(d *Dev, what string) {
	key := d.ID + "|mute"
	now := g.now()
	if !d.Muted {
		delete(g.respect, key)
		return
	}
	if g.respect[key] {
		return
	}
	if t, ok := g.fixedAt[key]; ok && now.Sub(t) < 2*time.Minute {
		g.respect[key] = true
		g.event("info", "You muted your "+what+" again, so I'm leaving it muted.")
		return
	}
	if err := g.b.SetMute(d.ID, false); err == nil {
		g.fixedAt[key] = now
		d.Muted = false
		g.event("fix", "Your "+what+" was muted. Unmuted it.")
	} else {
		g.warnOnce(key, "warn", "Your "+what+" is muted and I couldn't unmute it: "+err.Error())
	}
}

func (g *Guardian) fixVol(d *Dev, what string, min, to float64) {
	key := d.ID + "|vol"
	now := g.now()
	if d.Volume >= min {
		delete(g.respect, key)
		return
	}
	if g.respect[key] {
		return
	}
	if t, ok := g.fixedAt[key]; ok && now.Sub(t) < 2*time.Minute {
		g.respect[key] = true
		g.event("info", "You turned your "+what+" down again, so I'm leaving it.")
		return
	}
	if err := g.b.SetVolume(d.ID, to); err == nil {
		g.fixedAt[key] = now
		g.event("fix", fmt.Sprintf("Your %s volume was at %d%%. Set it to %d%%.", what, pct(d.Volume), pct(to)))
		d.Volume = to
	} else {
		g.warnOnce(key, "warn", "Your "+what+" volume is at 0 and I couldn't change it: "+err.Error())
	}
}

func pct(v float64) int { return int(v*100 + 0.5) }

// checkFlow: apps are playing to your headphones but Windows sends nothing = frozen.
func (g *Guardian) checkFlow(s *Snap, out *Dev, now time.Time, auto bool) {
	if !g.recheckAt.IsZero() && !now.Before(g.recheckAt) {
		g.recheckAt = time.Time{}
		r := ProbeErr
		if out.active() {
			r = g.b.Probe(out.ID)
		}
		switch r {
		case ProbeOK:
			g.setFrozen(false)
			g.zeroSince = time.Time{}
			g.event("good", "Fixed! Sound is moving to "+out.short()+" again.")
		case ProbeStuck:
			g.needRestartNow(now, "Restarting the sound service didn't unfreeze it.")
		default:
			g.setFrozen(false)
		}
		return
	}
	if !out.active() {
		g.zeroSince = time.Time{}
		return
	}
	if s.OutPeak > 0.00001 {
		g.zeroSince = time.Time{}
		g.probeGap = 0
		g.mu.Lock()
		was := g.needRestart
		g.needRestart, g.frozen = false, false
		g.mu.Unlock()
		if was {
			g.event("good", "Sound is working again.")
			g.popupOpen = false
		}
		return
	}
	if !s.OthersPlaying {
		g.zeroSince = time.Time{}
		return
	}
	if g.zeroSince.IsZero() {
		g.zeroSince = now
	}
	if now.Sub(g.zeroSince) < 6*time.Second || now.Sub(g.lastProbe) < g.probeGap {
		return
	}
	g.mu.Lock()
	known := g.needRestart
	g.mu.Unlock()
	if known {
		return
	}
	g.lastProbe = now
	switch g.b.Probe(out.ID) {
	case ProbeOK: // apps are just playing silence
		g.zeroSince = time.Time{}
		g.probeGap = time.Minute
	case ProbeBusy, ProbeErr:
		g.probeGap = time.Minute
	case ProbeStuck:
		g.onStuck(now, out, auto)
	}
}

func (g *Guardian) setFrozen(v bool) {
	g.mu.Lock()
	g.frozen = v
	g.mu.Unlock()
}

func (g *Guardian) onStuck(now time.Time, out *Dev, auto bool) {
	g.setFrozen(true)
	if auto && (g.svcAt.IsZero() || now.Sub(g.svcAt) > 20*time.Minute) {
		g.svcAt = now
		g.event("fix", "Sound froze ("+out.short()+" stopped taking sound). Restarting the Windows sound service, 2 second blip.")
		if err := g.b.RestartAudio(); err != nil {
			g.event("warn", "Couldn't restart the sound service: "+err.Error())
		}
		g.recheckAt = now.Add(5 * time.Second)
		return
	}
	g.needRestartNow(now, "")
}

func (g *Guardian) needRestartNow(now time.Time, why string) {
	g.mu.Lock()
	already := g.needRestart
	g.needRestart, g.frozen = true, true
	g.mu.Unlock()
	if already {
		return
	}
	g.needSince = now
	txt := "Your sound driver is stuck. Only a PC restart fixes this one. Restart when you're done playing."
	if why != "" {
		txt = why + " " + txt
	}
	g.event("bad", txt)
	g.ui.Tray("bad")
}

func (g *Guardian) maybePopup(now time.Time) {
	g.mu.Lock()
	need := g.needRestart
	g.mu.Unlock()
	if !need || g.popupOpen || g.snap.Busy || now.Before(g.snooze) {
		return
	}
	g.popupOpen = true
	g.ui.Popup("restart")
}

// snapFail: Windows audio didn't answer.
func (g *Guardian) snapFail(err error, now time.Time) {
	if now.Sub(g.firstTick) < 45*time.Second {
		return // just started (logon): Windows audio may not be up yet
	}
	if !g.svcAt.IsZero() && now.Sub(g.svcAt) < 25*time.Second {
		return // we just restarted the service on purpose (errors are normal for a few seconds)
	}
	if !errors.Is(err, ErrStuck) {
		g.warnOnce("snap", "warn", "Couldn't read your sound devices: "+err.Error())
		return
	}
	g.stuckN++
	if g.stuckN == 3 {
		g.mu.Lock()
		g.stuck = true
		g.mu.Unlock()
		out := g.snap.dev(g.snap.DefOut)
		if out == nil {
			out = &Dev{Name: "your sound device"}
		}
		g.onStuck(now, out, g.settings().AutoFix)
	}
}

// ---------- actions from the window ----------

// FixNow = the big button: forget "leave it", check everything, probe the sound.
func (g *Guardian) FixNow() {
	g.respect = map[string]bool{}
	g.fixedAt = map[string]time.Time{}
	g.pairFixed = map[string]bool{}
	g.micWarned = false
	g.event("info", "Checking everything...")
	nBefore := g.eventCount()
	set := g.settings()
	if !set.AutoFix { // the button works even with auto-fix off
		g.mu.Lock()
		g.set.AutoFix = true
		g.mu.Unlock()
		defer func() { g.mu.Lock(); g.set.AutoFix = false; g.mu.Unlock() }()
	}
	g.Tick()
	s := g.snap
	out := s.dev(s.DefOut)
	if out.active() {
		switch g.b.Probe(out.ID) {
		case ProbeStuck:
			now := g.now()
			if g.svcAt.IsZero() || now.Sub(g.svcAt) > 2*time.Minute {
				g.svcAt = now
				g.event("fix", "Your sound is frozen. Restarting the Windows sound service, 2 second blip.")
				g.b.RestartAudio()
				time.Sleep(4 * time.Second)
				if g.b.Probe(out.ID) == ProbeOK {
					g.setFrozen(false)
					g.event("good", "Fixed! Sound is moving again.")
				} else {
					g.needRestartNow(now, "Still frozen after restarting the sound service.")
				}
			} else {
				g.needRestartNow(now, "")
			}
		case ProbeOK:
			g.setFrozen(false)
		}
	} else if out == nil {
		g.event("warn", "Windows has no sound device for you right now. Plug your headphones in all the way.")
	}
	if g.eventCount() == nBefore {
		g.event("good", "Everything checks out. Nothing was broken.")
	}
}

func (g *Guardian) eventCount() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return len(g.events)
}

func (g *Guardian) StartSoundTest() {
	g.mu.Lock()
	if g.soundTest.Running {
		g.mu.Unlock()
		return
	}
	g.soundTest = TestState{Running: true, At: g.now().UnixMilli()}
	g.mu.Unlock()
	id := g.snap.DefOut
	go func() {
		defer func() {
			if r := recover(); r != nil {
				logf("PANIC sound test: %v\n%s", r, stack())
			}
		}()
		var r SoundTest
		if id == "" {
			r = SoundTest{Error: "Windows has no sound device right now."}
		} else {
			r = g.b.PlayTest(id)
		}
		g.mu.Lock()
		g.soundTest = TestState{Done: true, At: g.now().UnixMilli(), Sound: &r}
		g.mu.Unlock()
		if !r.Sent && r.Error == "" {
			g.Do(func() { g.event("warn", "Windows didn't send the test sound to your headphones."); g.FixNow() })
		}
		g.publish()
	}()
}

// HeardAnswer = "I heard it" / "I didn't hear it".
func (g *Guardian) HeardAnswer(heard bool) {
	g.mu.Lock()
	g.soundTest.Answer = map[bool]string{true: "yes", false: "no"}[heard]
	r := g.soundTest.Sound
	g.mu.Unlock()
	if heard {
		g.event("good", "Sound test: you heard it. Headphones work.")
		return
	}
	if r != nil && r.Sent {
		g.event("warn", "Windows sent the sound but you didn't hear it, so it's the plug or the headphones. Push the plug all the way in, try the green hole on the back, and check the volume wheel on the cable.")
		return
	}
	g.FixNow()
}

func (g *Guardian) StartMicTest() {
	g.mu.Lock()
	if g.micTest.Running {
		g.mu.Unlock()
		return
	}
	g.micTest = TestState{Running: true, At: g.now().UnixMilli(), Phase: "record"}
	g.mu.Unlock()
	in, out := g.snap.DefIn, g.snap.DefOut
	go func() {
		defer func() {
			if r := recover(); r != nil {
				logf("PANIC mic test: %v\n%s", r, stack())
			}
		}()
		var r MicTest
		if in == "" {
			r = MicTest{NoDevice: true, Error: "Windows doesn't see a mic right now."}
		} else {
			r = g.b.RecordTest(in, out, 4, func(l float64) {
				g.mu.Lock()
				if l < 0 { // -1 = recording done, now playing it back
					g.micTest.Phase = "play"
					g.micTest.Level = 0
				} else {
					g.micTest.Level = l
				}
				g.mu.Unlock()
			})
		}
		g.mu.Lock()
		g.micTest = TestState{Done: true, At: g.now().UnixMilli(), Mic: &r}
		g.mu.Unlock()
		switch {
		case r.Error != "":
			g.event("warn", "Mic test failed: "+r.Error)
		case r.Peak >= 0.05:
			g.event("good", fmt.Sprintf("Mic test: your mic works (loudest %d%%).", pct(r.Peak)))
		case r.Peak >= 0.008:
			g.event("warn", fmt.Sprintf("Mic test: your mic is really quiet (loudest %d%%). Talk closer, or the mic is going bad.", pct(r.Peak)))
		default:
			g.event("bad", "Mic test: your mic heard nothing. Check the mute switch on the cable, push the plug all the way in, or the mic wire is broken.")
		}
		g.publish()
	}()
}

func (g *Guardian) SetSetting(k string, v bool) {
	g.mu.Lock()
	switch k {
	case "autoFix":
		g.set.AutoFix = v
	case "plugSwitch":
		g.set.PlugSwitch = v
	case "micReminder":
		g.set.MicReminder = v
	case "liveMic":
		g.set.LiveMic = v
	}
	g.saveLocked()
	g.mu.Unlock()
}

func (g *Guardian) RestartLater() {
	g.snooze = g.now().Add(45 * time.Minute)
	g.popupOpen = false
	g.event("info", "OK, I'll remind you about the restart later.")
}

func (g *Guardian) PopupClosed() { g.popupOpen = false; g.snooze = g.now().Add(45 * time.Minute) }

func (g *Guardian) UseTV() error {
	tv := tvDev(&g.snap)
	if tv == nil {
		return errors.New("no TV sound device")
	}
	if err := g.b.SetDefault(tv.ID); err != nil {
		return err
	}
	g.event("fix", "Sound goes to "+tv.short()+" until you restart.")
	return nil
}

func tvDev(s *Snap) *Dev {
	for i := range s.Devs {
		d := &s.Devs[i]
		if d.Flow == "out" && d.active() && d.isTV() && d.ID != s.DefOut {
			return d
		}
	}
	return nil
}

func (g *Guardian) DriverCheck() {
	g.mu.Lock()
	if g.driver.Checking || g.driver.Installing {
		g.mu.Unlock()
		return
	}
	g.driver.Checking, g.driver.Error = true, ""
	g.mu.Unlock()
	go func() {
		found, err := g.b.DriverSearch()
		g.mu.Lock()
		g.driver.Checking, g.driver.Checked, g.driver.CheckedAt = false, true, g.now().UnixMilli()
		g.driver.Found = found
		if err != nil {
			g.driver.Error = err.Error()
		}
		g.mu.Unlock()
		if err == nil && len(found) == 0 {
			g.event("info", "Checked Windows Update: there's no newer sound driver for your PC.")
		} else if len(found) > 0 {
			g.event("info", "Windows Update has a newer sound driver: "+found[0].Title)
		}
		g.publish()
	}()
}

// RefreshDriver reads the installed sound driver (registry, fast) in the background.
func (g *Guardian) RefreshDriver() {
	go func() {
		defer func() { recover() }()
		i := g.b.Driver()
		g.mu.Lock()
		g.driver.Info = i
		g.driver.DellNewest = dellNewest(i.Model)
		g.mu.Unlock()
	}()
}

func (g *Guardian) DriverInstall(id string) {
	g.mu.Lock()
	if g.driver.Installing {
		g.mu.Unlock()
		return
	}
	g.driver.Installing, g.driver.Error = true, ""
	g.mu.Unlock()
	go func() {
		reboot, err := g.b.DriverInstall(id)
		g.mu.Lock()
		g.driver.Installing = false
		if err != nil {
			g.driver.Error = err.Error()
		} else {
			g.driver.Installed, g.driver.Reboot = true, reboot
		}
		g.mu.Unlock()
		if err != nil {
			g.event("bad", "The new sound driver didn't install: "+err.Error())
		} else if reboot {
			g.RefreshDriver()
			g.event("good", "New sound driver installed. Restart your PC when you're done playing to finish it.")
		} else {
			g.event("good", "New sound driver installed.")
		}
		g.publish()
	}()
}

// Live = meters for the open window (called ~15 times a second).
func (g *Guardian) Live() (out, in float64) {
	g.mu.Lock()
	g.liveAt = g.now()
	mic := g.set.LiveMic && !g.micTest.Running
	var o, i string
	if g.pub.Out != nil {
		o = g.pub.Out.ID
	}
	if g.pub.In != nil {
		i = g.pub.In.ID
	}
	g.mu.Unlock()
	return g.b.LivePeaks(o, i, mic)
}

// LiveIdle stops the live mic stream when the window stopped asking.
func (g *Guardian) LiveIdle() {
	g.mu.Lock()
	at := g.liveAt
	g.mu.Unlock()
	if !at.IsZero() && g.now().Sub(at) > 3*time.Second {
		g.mu.Lock()
		g.liveAt = time.Time{}
		g.mu.Unlock()
		g.b.StopLive()
	}
}

func (g *Guardian) publish() {
	s := g.snap
	g.mu.Lock()
	defer g.mu.Unlock()
	p := PubState{Version: appVersion, Mode: "guard", Settings: g.set, CanDefault: g.b.CanSetDefault(),
		NeedRestart: g.needRestart, Stuck: g.stuck, OutFrozen: g.frozen, MicMissing: g.micMissing,
		MicBlocked: s.MicBlocked, SoundTest: g.soundTest, MicTest: g.micTest, Driver: g.driver, Busy: s.Busy,
		Fixing: g.now().Before(g.fixingUntil)}
	if g.startsWithW != nil {
		p.StartsWithW = g.startsWithW()
	}
	p.Devs = append([]Dev(nil), s.Devs...)
	sort.SliceStable(p.Devs, func(i, j int) bool { return p.Devs[i].State == "active" && p.Devs[j].State != "active" })
	if d := s.dev(s.DefOut); d != nil {
		c := *d
		p.Out = &c
	}
	if d := s.dev(s.DefOutComm); d != nil {
		c := *d
		p.OutComm = &c
	}
	if d := s.dev(s.DefIn); d != nil {
		c := *d
		p.In = &c
	}
	if tv := tvDev(&s); tv != nil {
		c := *tv
		p.TV = &c
	}
	n := len(g.events)
	from := 0
	if n > 60 {
		from = n - 60
	}
	p.Events = append([]Event(nil), g.events[from:]...)
	p.Status = g.status(&p)
	g.pub = p
	if g.ui != nil {
		lvl := p.Status.Level
		if lvl == "fixing" {
			lvl = "ok"
		}
		g.ui.Tray(lvl)
	}
}

func (g *Guardian) status(p *PubState) Status {
	watching := "Watching your headphones and mic."
	if !p.Settings.AutoFix {
		watching = "Auto-fix is off. Press Fix now if something breaks."
	}
	switch {
	case p.NeedRestart:
		return Status{"bad", "Restart needed", "Sound to your headphones froze and the sound service restart didn't bring it back."}
	case p.Stuck:
		return Status{"bad", "Windows audio is stuck", "Windows isn't answering about sound right now. Trying to fix it."}
	case p.OutFrozen:
		return Status{"fixing", "Fixing frozen sound", "Restarting the Windows sound service."}
	case !g.have:
		return Status{"ok", "Starting up", "Looking at your sound devices..."}
	case p.Out == nil:
		return Status{"warn", "No sound device", "Windows has nothing to play sound on. Plug your headphones in all the way."}
	case p.MicMissing:
		return Status{"warn", "Mic not detected", "Pull your headphone plug out and push it all the way back in."}
	case p.Out.Muted:
		return Status{"warn", "Sound is muted", "You muted it, so I'm leaving it. Press Fix now to unmute."}
	case p.In != nil && p.In.Muted:
		return Status{"warn", "Mic is muted", "You muted it, so I'm leaving it. Press Fix now to unmute."}
	case p.MicBlocked:
		return Status{"warn", "Mic blocked by Windows", "Windows privacy settings block apps from your mic."}
	case p.In == nil:
		return Status{"warn", "No mic", "Windows doesn't see a mic. Push the plug all the way in."}
	case p.Fixing:
		return Status{"fixing", "Fixed something", watching}
	}
	return Status{"ok", "All good", watching}
}

// State = copy of what the window shows.
func (g *Guardian) State() PubState {
	g.mu.Lock()
	defer g.mu.Unlock()
	p := g.pub
	if p.Version == "" {
		p = PubState{Version: appVersion, Mode: "guard", Status: Status{"ok", "Starting up", "Looking at your sound devices..."}, Settings: g.set}
	}
	// live parts (change between ticks)
	p.SoundTest, p.MicTest, p.Driver = g.soundTest, g.micTest, g.driver
	n, from := len(g.events), 0
	if n > 60 {
		from = n - 60
	}
	p.Events = append([]Event(nil), g.events[from:]...)
	return p
}
