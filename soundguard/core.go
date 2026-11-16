package main

// SoundGuard core: picks the headphones + mic, watches them every second and fixes
// what it can live (never restarts the PC, never touches games).

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const appVersion = "1.0.0"

type Jack struct {
	Where   string `json:"where"` // front / back / ""
	Color   string `json:"color"` // #rrggbb or ""
	Plugged bool   `json:"plugged"`
}

type Device struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`    // "Speakers / Headphones"
	Adapter string  `json:"adapter"` // "Realtek(R) Audio"
	Out     bool    `json:"out"`
	State   string  `json:"state"` // active / disabled / unplugged
	Bus     string  `json:"bus"`   // HDAUDIO / USB / BTHENUM ...
	DefMain bool    `json:"defMain"`
	DefComm bool    `json:"defComm"`
	Volume  float64 `json:"volume"` // 0..1, -1 = unknown
	Muted   bool    `json:"muted"`
	Jacks   []Jack  `json:"jacks"`
}

func (d *Device) USB() bool { return strings.EqualFold(d.Bus, "USB") }
func (d *Device) Label() string {
	if d.Adapter != "" {
		return d.Name + " (" + d.Adapter + ")"
	}
	return d.Name
}

type Session struct {
	Name   string  `json:"name"`
	PID    uint32  `json:"pid"`
	Active bool    `json:"active"`
	Peak   float64 `json:"peak"`
	System bool    `json:"system"`
}

type DriverIssue struct {
	Name        string `json:"name"`
	Problem     uint32 `json:"problem"`
	NeedRestart bool   `json:"needRestart"`
	Missing     bool   `json:"missing"`
}

type TestResult struct {
	OK     bool   `json:"ok"`
	Busy   bool   `json:"busy"` // another app holds it in exclusive mode
	Hung   bool   `json:"hung"`
	Detail string `json:"detail"`
}

// PC = the Windows side (real), or a pretend PC for tests on Linux.
type PC interface {
	Devices() ([]Device, error)
	Peak(id string) float64
	Sessions(id string) []Session
	SetVolume(id string, v float64) error
	SetMute(id string, m bool) error
	SetDefault(id string) (string, error)
	Enable(id string) error
	EngineTest(id string) TestResult
	PlayTest(id, side string) (float64, error)
	MicListen(id string)
	MicLevel() float64

	Admin() bool
	Installed() bool
	Startup() bool
	SetStartup(on bool) error
	Services() map[string]string
	StartService(name string) error
	RestartAudio() error
	DriverIssues() []DriverIssue
	DriverInfo() string
	MicPrivacy() (bool, string)
	FixMicPrivacy() error
	RestartPC() error
	Notify(title, text string)
	SetTray(bad bool, tip string)
	Uninstall() error
}

type Settings struct {
	FixOut      bool    `json:"fixOut"`
	FixIn       bool    `json:"fixIn"`
	KeepDefault bool    `json:"keepDefault"`
	MicLevel    float64 `json:"micLevel"`
	Popups      bool    `json:"popups"`
	OutID       string  `json:"outId"`
	InID        string  `json:"inId"`
	LastVol     float64 `json:"lastVol"`
}

type LogEntry struct {
	T    int64  `json:"t"`
	Kind string `json:"kind"` // fix / info / problem
	What string `json:"what"`
	Did  string `json:"did"`
}

type Alert struct {
	Kind   string `json:"kind"`
	Title  string `json:"title"`
	Text   string `json:"text"`
	Since  int64  `json:"since"`
	snooze time.Time
	told   bool
}

type fixer struct {
	last   time.Time
	count  int
	paused time.Time
}

type App struct {
	PC    PC
	dir   string
	token string
	pid   uint32

	OpenWindow func()
	Quit       func()
	extraAPI   func(http.ResponseWriter, *http.Request) bool

	mu         sync.Mutex
	set        Settings
	devs       []Device
	out, in    *Device
	outPlugged bool
	inPlugged  bool
	sessions   []Session
	log        []LogEntry
	alerts     map[string]*Alert
	fixers     map[string]*fixer
	pausedAll  time.Time
	services   map[string]string
	drivers    []DriverIssue
	driverInfo string
	privacyOK  bool
	privacyAt  string
	engine     string
	engineWhy  string
	fixesToday int
	day        string
	started    time.Time
	lastNotify time.Time
	audioErr   string
	busy       string

	// engine watch (guard goroutine only)
	lastSound    time.Time
	lastTest     time.Time
	retestAt     time.Time
	failCount    int
	lastRestart  time.Time
	prevOutPlug  int // -1 unknown, 0 no, 1 yes
	prevInPlug   int
	seenUSB      map[string]bool
	firstTick    bool
	tickN        int
	lastSaveVol  float64
	sessionsTime time.Time
}

func NewApp(pc PC, dir string, pid uint32) *App {
	a := &App{PC: pc, dir: dir, pid: pid, alerts: map[string]*Alert{}, fixers: map[string]*fixer{},
		started: time.Now(), prevOutPlug: -1, prevInPlug: -1, seenUSB: map[string]bool{}, firstTick: true,
		privacyOK: true}
	a.set = Settings{FixOut: true, FixIn: true, KeepDefault: true, MicLevel: 1, Popups: true, LastVol: 0.5}
	if b, err := os.ReadFile(filepath.Join(dir, "settings.json")); err == nil {
		json.Unmarshal(b, &a.set)
	}
	if b, err := os.ReadFile(filepath.Join(dir, "log.json")); err == nil {
		json.Unmarshal(b, &a.log)
	}
	a.day = time.Now().Format("2006-01-02")
	for _, e := range a.log {
		if e.Kind == "fix" && time.UnixMilli(e.T).Format("2006-01-02") == a.day {
			a.fixesToday++
		}
	}
	return a
}

func (a *App) saveSettings() {
	b, _ := json.MarshalIndent(a.set, "", " ")
	os.WriteFile(filepath.Join(a.dir, "settings.json"), b, 0o644)
}

// text log for checking later (PC Helper can read it)
func (a *App) textLog(s string) {
	p := filepath.Join(a.dir, "soundguard.log")
	if st, err := os.Stat(p); err == nil && st.Size() > 1<<20 {
		os.Rename(p, p+".old")
	}
	f, err := os.OpenFile(p, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	fmt.Fprintf(f, "%s %s\n", time.Now().Format("2006-01-02 15:04:05"), s)
	f.Close()
}

// addLog: caller holds a.mu
func (a *App) addLog(kind, what, did string) {
	now := time.Now()
	if d := now.Format("2006-01-02"); d != a.day {
		a.day, a.fixesToday = d, 0
	}
	if kind == "fix" {
		a.fixesToday++
	}
	a.log = append(a.log, LogEntry{T: now.UnixMilli(), Kind: kind, What: what, Did: did})
	if len(a.log) > 150 {
		a.log = a.log[len(a.log)-150:]
	}
	b, _ := json.Marshal(a.log)
	os.WriteFile(filepath.Join(a.dir, "log.json"), b, 0o644)
	a.textLog(kind + ": " + what + " -> " + did)
}

func (a *App) notify(title, text string, force bool) {
	a.mu.Lock()
	ok := a.set.Popups && (force || time.Since(a.lastNotify) > 12*time.Second)
	if ok {
		a.lastNotify = time.Now()
	}
	a.mu.Unlock()
	if ok {
		a.PC.Notify(title, text)
	}
}

// ---------- picking the headphones + mic ----------

func has(s string, words ...string) bool {
	s = strings.ToLower(s)
	for _, w := range words {
		if strings.Contains(s, w) {
			return true
		}
	}
	return false
}

func scoreOut(d *Device) int {
	n := d.Name + " " + d.Adapter
	s := 0
	if d.USB() {
		s += 80
		if has(n, "headset", "headphone", "usb audio", "audio adapter") {
			s += 20
		}
	}
	if has(n, "headphone", "headset") {
		s += 40
	}
	if has(n, "realtek") {
		s += 30
	}
	if has(n, "hdmi", "nvidia", "display", "tv", "monitor", "digital output", "spdif", "s/pdif") || has(d.Bus, "display") {
		s -= 60
	}
	if strings.EqualFold(d.Bus, "BTHENUM") || strings.EqualFold(d.Bus, "BTHHFENUM") {
		s += 10
	}
	if d.State == "active" {
		s += 20
	}
	if d.DefMain {
		s += 5
	}
	return s
}

func scoreIn(d *Device) int {
	n := d.Name + " " + d.Adapter
	s := 0
	if has(n, "stereo mix", "what u hear", "wave out", "loopback") {
		return -1000
	}
	if d.USB() {
		s += 80
	}
	if has(n, "headset", "jack mic", "microphone", "mic") {
		s += 40
	}
	if has(n, "line in") {
		s -= 20
	}
	if has(n, "realtek") {
		s += 20
	}
	if d.State == "active" {
		s += 30
	}
	if d.DefMain {
		s += 5
	}
	return s
}

func pick(devs []Device, out bool, want string) *Device {
	var best *Device
	bs := -1 << 30
	for i := range devs {
		d := &devs[i]
		if d.Out != out {
			continue
		}
		if want != "" && d.ID == want {
			c := *d
			return &c
		}
		var s int
		if out {
			s = scoreOut(d)
		} else {
			s = scoreIn(d)
		}
		if s > bs && s > -500 {
			best, bs = d, s
		}
	}
	if best == nil {
		return nil
	}
	c := *best
	return &c
}

// plugged: headphones in the jack (jack info), or the device just being on (no jack info / USB).
func plugged(d *Device) bool {
	if d == nil || d.State != "active" {
		return false
	}
	if len(d.Jacks) == 0 || d.USB() {
		return true
	}
	front := false
	for _, j := range d.Jacks {
		if j.Where == "front" {
			front = true
		}
	}
	for _, j := range d.Jacks {
		if j.Plugged && (!front || j.Where == "front" || len(d.Jacks) == 1) {
			return true
		}
	}
	// some drivers report every jack as empty even with something in it
	allEmpty := true
	for _, j := range d.Jacks {
		if j.Plugged {
			allEmpty = false
		}
	}
	return allEmpty && !front
}

func defName(devs []Device, out, comm bool) string {
	for _, d := range devs {
		if d.Out == out && ((comm && d.DefComm) || (!comm && d.DefMain)) {
			return d.Name
		}
	}
	return "nothing"
}

// ---------- the guard ----------

// tryFix runs a fix unless it keeps getting undone (= on purpose): then it backs off 1 hour.
func (a *App) tryFix(key, what, did string, do func() error) bool {
	a.mu.Lock()
	f := a.fixers[key]
	if f == nil {
		f = &fixer{}
		a.fixers[key] = f
	}
	now := time.Now()
	if now.Before(f.paused) {
		a.mu.Unlock()
		return false
	}
	if !f.last.IsZero() && now.Sub(f.last) < 2*time.Minute {
		f.count++
	} else {
		f.count = 1
	}
	if f.count >= 3 {
		f.paused = now.Add(time.Hour)
		f.count = 0
		a.addLog("info", what+" again", "Looks like you're doing that on purpose, so I'll leave it alone for 1 hour")
		a.mu.Unlock()
		return false
	}
	f.last = now
	a.mu.Unlock()
	err := do()
	a.mu.Lock()
	if err != nil {
		a.addLog("problem", what, "Couldn't fix it: "+err.Error())
		f.paused = now.Add(10 * time.Minute) // don't spam the same failure
		a.mu.Unlock()
		return false
	}
	a.addLog("fix", what, did)
	a.mu.Unlock()
	a.notify(what, did, false)
	return true
}

func (a *App) setAlert(kind, title, text string) {
	a.mu.Lock()
	al := a.alerts[kind]
	if al == nil {
		al = &Alert{Kind: kind, Since: time.Now().UnixMilli()}
		a.alerts[kind] = al
		a.addLog("problem", title, text)
	}
	al.Title, al.Text = title, text
	tell := !al.told && time.Now().After(al.snooze)
	if tell {
		al.told = true
	}
	a.mu.Unlock()
	if tell {
		a.notify(title, text, true)
	}
}

func (a *App) clearAlert(kind, msg string) {
	a.mu.Lock()
	if a.alerts[kind] != nil {
		delete(a.alerts, kind)
		if msg != "" {
			a.addLog("info", msg, "All good again")
		}
	}
	a.mu.Unlock()
}

func (a *App) paused() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return time.Now().Before(a.pausedAll)
}

func (a *App) Run() {
	for {
		a.Tick()
		time.Sleep(time.Second)
	}
}

func (a *App) Tick() {
	a.tickN++
	n := a.tickN
	devs, err := a.PC.Devices()
	a.mu.Lock()
	set := a.set
	a.mu.Unlock()
	out := pick(devs, true, set.OutID)
	in := pick(devs, false, set.InID)
	var sess []Session
	if out != nil && out.State == "active" {
		sess = a.PC.Sessions(out.ID)
	}
	slow := n%5 == 1
	var svcs map[string]string
	var drv []DriverIssue
	var privOK bool
	var privAt string
	if slow {
		svcs = a.PC.Services()
		drv = a.PC.DriverIssues()
		privOK, privAt = a.PC.MicPrivacy()
	}
	info := ""
	if n%60 == 1 {
		info = a.PC.DriverInfo()
	}

	a.mu.Lock()
	if err != nil {
		a.audioErr = err.Error()
	} else {
		a.audioErr = ""
	}
	a.devs, a.out, a.in, a.sessions = devs, out, in, sess
	a.outPlugged, a.inPlugged = plugged(out), in != nil && in.State == "active"
	if slow {
		a.services, a.drivers, a.privacyOK, a.privacyAt = svcs, drv, privOK, privAt
	}
	if info != "" {
		a.driverInfo = info
	}
	outPlug, inPlug := a.outPlugged, a.inPlugged
	a.mu.Unlock()

	a.events(devs, out, in, outPlug, inPlug)
	if !a.paused() {
		if slow {
			a.fixServices(svcs)
		}
		if set.FixOut && out != nil {
			a.fixOut(devs, out, outPlug, set)
		}
		if set.FixIn && in != nil {
			a.fixIn(devs, in, set)
		}
		if set.FixIn && slow && !privOK {
			a.tryFix("micPrivacy", "Windows was blocking apps from using the mic", "Allowed the mic again", a.PC.FixMicPrivacy)
		}
	}
	a.engineWatch(out, sess)
	if slow {
		a.driverWatch(drv)
	}
	a.firstTick = false
	st, head, _ := a.Status()
	a.PC.SetTray(st == "bad", "SoundGuard: "+head)
}

func (a *App) events(devs []Device, out, in *Device, outPlug, inPlug bool) {
	b2i := func(b bool) int {
		if b {
			return 1
		}
		return 0
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if out != nil && a.prevOutPlug != -1 && b2i(outPlug) != a.prevOutPlug {
		if outPlug {
			a.addLog("info", "Headphones plugged in", out.Name)
		} else {
			a.addLog("info", "Headphones unplugged", out.Name)
		}
	}
	if in != nil && a.prevInPlug != -1 && b2i(inPlug) != a.prevInPlug {
		if inPlug {
			a.addLog("info", "Mic plugged in", in.Name)
		} else {
			a.addLog("info", "Mic unplugged", in.Name)
		}
	}
	if out != nil {
		a.prevOutPlug = b2i(outPlug)
	}
	if in != nil {
		a.prevInPlug = b2i(inPlug)
	}
	for _, d := range devs {
		if d.USB() && d.State == "active" && !a.seenUSB[d.ID] {
			a.seenUSB[d.ID] = true
			if !a.firstTick {
				a.addLog("info", "USB sound device found: "+d.Name, "Using it for sound + mic when it's picked (Auto picks USB first)")
			}
		}
	}
}

func (a *App) fixServices(svcs map[string]string) {
	for _, s := range []string{"AudioEndpointBuilder", "Audiosrv"} {
		if st, ok := svcs[s]; ok && st == "stopped" {
			name := map[string]string{"Audiosrv": "Windows Audio", "AudioEndpointBuilder": "Windows Audio Endpoint Builder"}[s]
			a.tryFix("svc-"+s, name+" was off", "Started it", func() error { return a.PC.StartService(s) })
		}
	}
}

func (a *App) fixOut(devs []Device, out *Device, plug bool, set Settings) {
	if out.State == "disabled" {
		a.tryFix("outEnable", out.Name+" was turned off in Windows", "Turned it back on", func() error { return a.PC.Enable(out.ID) })
		return
	}
	if out.State != "active" {
		return
	}
	if out.Muted {
		a.tryFix("outMute", "Your headphones were muted", "Unmuted them", func() error { return a.PC.SetMute(out.ID, false) })
	}
	if out.Volume >= 0 && out.Volume < 0.03 {
		v := set.LastVol
		if v < 0.2 {
			v = 0.5
		}
		a.tryFix("outVol", fmt.Sprintf("Headphone volume was %d%%", pct(out.Volume)), fmt.Sprintf("Put it back to %d%%", pct(v)),
			func() error { return a.PC.SetVolume(out.ID, v) })
	} else if out.Volume >= 0.1 && abs(out.Volume-set.LastVol) > 0.02 {
		a.mu.Lock()
		a.set.LastVol = out.Volume
		a.mu.Unlock()
		if abs(out.Volume-a.lastSaveVol) > 0.05 {
			a.lastSaveVol = out.Volume
			a.mu.Lock()
			a.saveSettings()
			a.mu.Unlock()
		}
	}
	if set.KeepDefault && plug && (!out.DefMain || !out.DefComm) {
		what := "Sound was going to " + defName(devs, true, false)
		if out.DefMain {
			what = "Calls/Discord sound was going to " + defName(devs, true, true)
		}
		a.tryFix("outDefault", what, "Switched it to "+out.Name, func() error { _, err := a.PC.SetDefault(out.ID); return err })
	}
}

func (a *App) fixIn(devs []Device, in *Device, set Settings) {
	if in.State == "disabled" {
		a.tryFix("inEnable", in.Name+" was turned off in Windows", "Turned it back on", func() error { return a.PC.Enable(in.ID) })
		return
	}
	if in.State != "active" {
		return
	}
	if in.Muted {
		a.tryFix("inMute", "Your mic was muted", "Unmuted it", func() error { return a.PC.SetMute(in.ID, false) })
	}
	target := set.MicLevel
	if target < 0.3 {
		target = 0.3
	}
	if in.Volume >= 0 && in.Volume < target-0.15 {
		a.tryFix("inVol", fmt.Sprintf("Mic volume dropped to %d%%", pct(in.Volume)), fmt.Sprintf("Set it back to %d%%", pct(target)),
			func() error { return a.PC.SetVolume(in.ID, target) })
	}
	if set.KeepDefault && (!in.DefMain || !in.DefComm) {
		what := "Apps were using " + defName(devs, false, false) + " as the mic"
		if in.DefMain {
			what = "Calls/Discord were using " + defName(devs, false, true) + " as the mic"
		}
		a.tryFix("inDefault", what, "Switched it to "+in.Name, func() error { _, err := a.PC.SetDefault(in.ID); return err })
	}
}

// engineWatch: is Windows really pushing sound to the headphones? Silent test, no sound played.
func (a *App) engineWatch(out *Device, sess []Session) {
	if out == nil || out.State != "active" {
		return
	}
	now := time.Now()
	if a.PC.Peak(out.ID) > 0.0005 {
		a.lastSound = now
	}
	active := 0
	for _, s := range sess {
		if s.Active && s.PID != a.pid {
			active++
		}
	}
	due := now.Sub(a.lastTest) > 3*time.Minute ||
		(active > 0 && now.Sub(a.lastSound) > 12*time.Second && now.Sub(a.lastTest) > 45*time.Second) ||
		(!a.retestAt.IsZero() && now.After(a.retestAt))
	if !due {
		return
	}
	a.lastTest, a.retestAt = now, time.Time{}
	r := a.PC.EngineTest(out.ID)
	a.mu.Lock()
	a.engineWhy = r.Detail
	a.mu.Unlock()
	if r.OK || r.Busy {
		a.failCount = 0
		a.mu.Lock()
		wasStuck := a.engine == "stuck"
		if r.Busy {
			a.engine = "busy"
		} else {
			a.engine = "ok"
		}
		a.mu.Unlock()
		if wasStuck {
			a.clearAlert("stuck", "Sound engine works again")
		}
		return
	}
	a.failCount++
	a.textLog(fmt.Sprintf("engine test failed (%d): %s", a.failCount, r.Detail))
	if a.failCount < 3 && !r.Hung {
		a.retestAt = now.Add(4 * time.Second)
		return
	}
	if now.Sub(a.lastRestart) > 30*time.Minute && a.PC.Admin() && !r.Hung {
		a.lastRestart = now
		a.failCount = 2 // one more failed check after the restart = stuck for real
		a.tryFix("restartAudio", "Windows wasn't pushing sound to your headphones", "Restarted Windows Audio (2 second blip)", a.PC.RestartAudio)
		a.retestAt = time.Now().Add(5 * time.Second)
		return
	}
	a.mu.Lock()
	a.engine = "stuck"
	a.mu.Unlock()
	a.setAlert("stuck", "Your sound driver is stuck", "Restart your PC when you're done playing. That unsticks it. I won't restart anything by myself.")
	a.retestAt = now.Add(30 * time.Second)
}

func (a *App) driverWatch(drv []DriverIssue) {
	var bad []string
	for _, d := range drv {
		if d.NeedRestart || d.Missing || d.Problem != 0 {
			bad = append(bad, d.Name)
		}
	}
	if len(bad) > 0 {
		a.setAlert("driver", "Sound driver needs a restart", strings.Join(bad, ", ")+": Windows says it needs a PC restart. Do it when you're done playing.")
	} else {
		a.clearAlert("driver", "Sound driver")
	}
}

func pct(v float64) int { return int(v*100 + 0.5) }
func abs(v float64) float64 {
	if v < 0 {
		return -v
	}
	return v
}

// Status: ok / warn / bad + the big line + the small line.
func (a *App) Status() (string, string, string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, k := range []string{"stuck", "driver"} {
		if al := a.alerts[k]; al != nil {
			return "bad", al.Title, al.Text
		}
	}
	if a.audioErr != "" {
		return "bad", "Windows sound isn't answering", a.audioErr
	}
	if a.out == nil {
		return "warn", "No headphones found", "Plug your headphones in. I'll set them up by myself."
	}
	if a.out.State == "disabled" {
		return "warn", "Headphones are turned off in Windows", "Turn on auto-fix for headphones and I'll turn them back on."
	}
	if !a.outPlugged {
		return "warn", "Headphones not plugged in", "Push the plug all the way into the front jack."
	}
	if a.in == nil || a.in.State != "active" {
		return "warn", "Mic not plugged in", "Your headphones work. Plug in a mic (or a headset) to talk."
	}
	if time.Now().Before(a.pausedAll) {
		return "warn", "Fixes paused", "I'm only watching right now. Turn fixes back on whenever."
	}
	return "ok", "All good", "You can hear and talk. I'm watching your headphones and mic."
}
