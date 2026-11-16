//go:build windows

package main

// win_selftest.go = the real Windows test run (GitHub Actions windows runner with a virtual sound card).
// SoundGuard.exe -selftest out.json

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

type stStep struct {
	Name string `json:"name"`
	OK   bool   `json:"ok"`
	Info any    `json:"info,omitempty"`
	Err  string `json:"err,omitempty"`
	Ms   int64  `json:"ms"`
	Must bool   `json:"must"`
}

type stRun struct {
	Steps []stStep `json:"steps"`
	t     time.Time
}

func (r *stRun) add(name string, must, ok bool, info any, err error) {
	s := stStep{Name: name, OK: ok, Info: info, Must: must, Ms: time.Since(r.t).Milliseconds()}
	if err != nil {
		s.Err = err.Error()
	}
	r.Steps = append(r.Steps, s)
	logf("SELFTEST %-28s ok=%v must=%v err=%s info=%v", name, ok, must, s.Err, info)
	r.t = time.Now()
}

func selftest(args []string) int {
	outPath := "selftest.json"
	if len(args) > 0 {
		outPath = args[0]
	}
	outDir := filepath.Dir(outPath)
	R := &stRun{t: time.Now()}
	defer func() {
		if x := recover(); x != nil {
			R.add("PANIC", true, false, fmt.Sprint(x), nil)
			logf("%s", stack())
		}
		j, _ := json.MarshalIndent(R, "", " ")
		os.WriteFile(outPath, j, 0o644)
	}()
	R.add("admin", false, isAdmin(), currentUser(), nil)
	b := newWinBackend()

	s, err := b.Snapshot()
	R.add("snapshot", true, err == nil && len(s.Devs) > 0, s, err)
	out, in := s.dev(s.DefOut), s.dev(s.DefIn)
	R.add("has default output", true, out != nil, out, nil)
	R.add("has default mic", false, in != nil, in, nil)
	R.add("can switch default (IPolicyConfig)", false, b.CanSetDefault(), nil, nil)
	if out == nil {
		return R.fail()
	}

	// mute / volume roundtrip
	origVol, origMute := out.Volume, out.Muted
	err = b.SetMute(out.ID, true)
	s2, _ := b.Snapshot()
	m1 := s2.dev(out.ID) != nil && s2.dev(out.ID).Muted
	b.SetMute(out.ID, false)
	s3, _ := b.Snapshot()
	m2 := s3.dev(out.ID) != nil && !s3.dev(out.ID).Muted
	R.add("mute + unmute", true, err == nil && m1 && m2, map[string]bool{"muted": m1, "unmuted": m2}, err)
	err = b.SetVolume(out.ID, 0.37)
	s4, _ := b.Snapshot()
	v := -1.0
	if d := s4.dev(out.ID); d != nil {
		v = d.Volume
	}
	R.add("set volume 37%", true, err == nil && math.Abs(v-0.37) < 0.02, v, err)
	b.SetVolume(out.ID, origVol)
	b.SetMute(out.ID, origMute)

	// silent probe
	pr := b.Probe(out.ID)
	R.add("silent probe = OK", true, pr == ProbeOK, pr, nil)

	// test chime
	pt := b.PlayTest(out.ID)
	R.add("test sound sent", true, pt.Sent && pt.Peak > 0.01, pt, nil)

	// another app playing: is it seen?
	tone := exec.Command(selfPath(), "-playtone", "6")
	tone.Start()
	time.Sleep(2 * time.Second)
	var others bool
	var pk float64
	b.run(4*time.Second, func(a *audio) error { others = a.othersPlaying(out.ID); pk = a.peak(out.ID); return nil })
	R.add("sees other app playing", true, others && pk > 0.01, map[string]any{"others": others, "peak": pk}, nil)
	// guardian with the real PC: mute it, one tick must unmute it
	tmp := filepath.Join(outDir, "sg-test-data")
	os.RemoveAll(tmp)
	ui := &nopUI{}
	g := NewGuardian(b, ui, tmp)
	g.Tick()
	b.SetMute(out.ID, true)
	g.Tick()
	s5, _ := b.Snapshot()
	R.add("guardian unmutes sound", true, s5.dev(out.ID) != nil && !s5.dev(out.ID).Muted && hasEvent(g, "Your sound was muted. Unmuted it."), eventsText(g), nil)
	tone.Wait()

	if in != nil && in.State == "active" {
		ov, om := in.Volume, in.Muted
		b.SetVolume(in.ID, 0.05)
		b.SetMute(in.ID, true)
		g.Tick()
		s6, _ := b.Snapshot()
		d := s6.dev(in.ID)
		R.add("guardian fixes mic", true, d != nil && !d.Muted && d.Volume > 0.99, eventsText(g), nil)
		b.SetVolume(in.ID, ov)
		b.SetMute(in.ID, om)
	}

	// silence playing for 10 s must NOT count as frozen
	sil := exec.Command(selfPath(), "-playtone", "10")
	sil.Env = append(os.Environ(), "SG_SILENT=1")
	sil.Start()
	for i := 0; i < 11; i++ {
		g.Tick()
		time.Sleep(time.Second)
	}
	sil.Wait()
	R.add("silence is not frozen", true, !hasEvent(g, "froze"), eventsText(g), nil)

	// switch default output and back
	var other *Dev
	for i := range s.Devs {
		d := &s.Devs[i]
		if d.Flow == "out" && d.State == "active" && d.ID != out.ID {
			other = d
			break
		}
	}
	if other != nil {
		err := b.SetDefault(other.ID)
		s7, _ := b.Snapshot()
		ok := err == nil && s7.DefOut == other.ID && s7.DefOutComm == other.ID
		b.SetDefault(out.ID)
		s8, _ := b.Snapshot()
		R.add("switch default + back", true, ok && s8.DefOut == out.ID, map[string]string{"to": other.Name, "after": s7.DefOut}, err)
	} else {
		R.add("switch default + back", false, false, "only one output device", nil)
	}

	// mic test (record 2 s while a tone plays into the virtual cable)
	if in != nil && in.State == "active" {
		blocked := b.micBlocked()
		ferr := b.FixMicPrivacy()
		b.privAt = time.Time{}
		R.add("mic privacy fix", false, ferr == nil && !b.micBlocked(), map[string]bool{"wasBlocked": blocked}, ferr)
		tone2 := exec.Command(selfPath(), "-playtone", "4")
		tone2.Start()
		time.Sleep(300 * time.Millisecond)
		levels := 0
		mt := b.RecordTest(in.ID, out.ID, 2, func(l float64) {
			if l >= 0 {
				levels++
			}
		})
		tone2.Wait()
		info := map[string]any{"result": mt, "levelCalls": levels}
		ok := mt.Error == "" && levels >= 10 && mt.Played && mt.Peak > 0.05
		if mt.Blocked { // this test runs in a hidden Windows session (no mics there): run it on the desktop instead
			ir, ierr := interactiveMicTest(outDir)
			info["desktop"] = ir
			if ierr != nil {
				info["desktopErr"] = ierr.Error()
			}
			ok = ir != nil && ir.Err == "" && ir.Test.Error == "" && ir.Levels >= 10 && ir.Test.Played && ir.Test.Peak > 0.05 && ir.Live > 0.01
		}
		R.add("mic test records + plays back", true, ok, info, nil)
		// live mic level
		for i := 0; i < 12; i++ {
			b.LivePeaks(out.ID, in.ID, true)
			time.Sleep(100 * time.Millisecond)
		}
		_, li := b.LivePeaks(out.ID, in.ID, true)
		b.StopLive()
		R.add("live mic level runs", false, true, li, nil)
	}

	// restart the Windows Audio service (the 2 s blip fix)
	t0 := time.Now()
	err = b.RestartAudio()
	took := time.Since(t0)
	time.Sleep(1500 * time.Millisecond)
	s9, err2 := b.Snapshot()
	if err2 != nil {
		time.Sleep(3 * time.Second)
		s9, err2 = b.Snapshot()
	}
	pr2 := b.Probe(s9.DefOut)
	R.add("restart sound service", true, err == nil && err2 == nil && pr2 == ProbeOK, map[string]any{"ms": took.Milliseconds(), "devs": len(s9.Devs), "probe": pr2}, err)

	R.add("driver info", false, b.Driver().Name != "", b.Driver(), nil)

	// windows: main + popup must render and the popup must not steal focus
	srv := &Server{G: g, Mode: "guard"}
	srv.Start(0)
	g.publish()
	R.add("main window renders", true, windowTest(srv, "main", filepath.Join(outDir, "window-main.b64")), nil, nil)
	g.mu.Lock()
	g.needRestart = true
	g.mu.Unlock()
	g.publish()
	R.add("popup renders, no focus steal", true, windowTest(srv, "popup", filepath.Join(outDir, "window-popup.b64")), nil, nil)

	// install -> start with Windows -> runs -> uninstall
	err = install(false)
	ok := err == nil && taskExists() && taskEnabled()
	_, lerr := os.Stat(shortcutPath())
	R.add("install (task + shortcut)", true, ok && lerr == nil, map[string]any{"task": taskExists(), "enabled": taskEnabled(), "lnk": lerr == nil}, err)
	if ok {
		err = runTask()
		v, port, up := waitGuardian(dataDir(), 25*time.Second)
		R.add("installed guardian starts (task)", false, up, map[string]any{"version": v, "port": port}, err)
		if up {
			postShow(port)
			cls, _ := windows.UTF16PtrFromString(classMain)
			var hw uintptr
			for i := 0; i < 50 && hw == 0; i++ {
				time.Sleep(300 * time.Millisecond)
				hw, _, _ = procFindWindowW.Call(uintptr(unsafe.Pointer(cls)), 0)
			}
			R.add("show request opens window", true, hw != 0, nil, nil)
			setTaskEnabled(false)
			off := !taskEnabled()
			setTaskEnabled(true)
			R.add("startup toggle", true, off && taskEnabled(), nil, nil)
		}
		err = uninstall()
		time.Sleep(5 * time.Second)
		_, derr := os.Stat(installDir())
		R.add("uninstall", true, err == nil && !taskExists() && os.IsNotExist(derr), map[string]any{"task": taskExists(), "dirGone": os.IsNotExist(derr)}, err)
	}

	// Windows Update driver search (slow, informational)
	if os.Getenv("SG_WU") != "" {
		found, err := b.DriverSearch()
		R.add("windows update driver search", false, err == nil, found, err)
	}
	return R.fail()
}

type micResult struct {
	Test   MicTest `json:"test"`
	Levels int     `json:"levels"`
	Live   float64 `json:"live"`
	Err    string  `json:"err"`
}

// micSelftest = SoundGuard.exe -mictest out.json (run on the desktop by a task)
func micSelftest(args []string) int {
	if len(args) == 0 {
		return 2
	}
	var r micResult
	b := newWinBackend()
	s, err := b.Snapshot()
	switch {
	case err != nil:
		r.Err = err.Error()
	case s.DefIn == "":
		r.Err = "no mic"
	default:
		tone := exec.Command(selfPath(), "-playtone", "4")
		tone.Start()
		time.Sleep(300 * time.Millisecond)
		r.Test = b.RecordTest(s.DefIn, s.DefOut, 2, func(l float64) {
			if l >= 0 {
				r.Levels++
			}
		})
		tone.Wait()
		tone2 := exec.Command(selfPath(), "-playtone", "3")
		tone2.Start()
		time.Sleep(300 * time.Millisecond)
		for i := 0; i < 22; i++ {
			if _, li := b.LivePeaks(s.DefOut, s.DefIn, true); li > r.Live {
				r.Live = li
			}
			time.Sleep(100 * time.Millisecond)
		}
		b.StopLive()
		tone2.Wait()
	}
	j, _ := json.Marshal(r)
	os.WriteFile(args[0], j, 0o644)
	return 0
}

func interactiveMicTest(outDir string) (*micResult, error) {
	res := filepath.Join(outDir, "mictest.json")
	os.Remove(res)
	tr := `"` + selfPath() + `" -mictest "` + res + `"`
	if out, err := hidden(exec.Command("schtasks.exe", "/Create", "/TN", "SoundGuardMicTest", "/TR", tr, "/SC", "ONCE", "/ST", "23:59", "/RL", "HIGHEST", "/IT", "/F")).CombinedOutput(); err != nil {
		return nil, fmt.Errorf("create: %v %s", err, strings.TrimSpace(string(out)))
	}
	defer hidden(exec.Command("schtasks.exe", "/Delete", "/TN", "SoundGuardMicTest", "/F")).Run()
	if out, err := hidden(exec.Command("schtasks.exe", "/Run", "/TN", "SoundGuardMicTest")).CombinedOutput(); err != nil {
		return nil, fmt.Errorf("run: %v %s", err, strings.TrimSpace(string(out)))
	}
	for i := 0; i < 80; i++ {
		time.Sleep(500 * time.Millisecond)
		if b, err := os.ReadFile(res); err == nil && len(b) > 0 {
			var r micResult
			if err := json.Unmarshal(b, &r); err != nil {
				return nil, err
			}
			return &r, nil
		}
	}
	return nil, errors.New("no result in 40 s")
}

func (r *stRun) fail() int {
	for _, s := range r.Steps {
		if s.Must && !s.OK {
			return 1
		}
	}
	return 0
}

func hasEvent(g *Guardian, sub string) bool {
	for _, e := range g.State().Events {
		if strings.Contains(e.Text, sub) {
			return true
		}
	}
	return false
}

func eventsText(g *Guardian) []string {
	var out []string
	for _, e := range g.State().Events {
		out = append(out, e.Kind+": "+e.Text)
	}
	return out
}

var (
	procGetForegroundWindow = user32.NewProc("GetForegroundWindow")
	procIsWindowVisible     = user32.NewProc("IsWindowVisible")
	procGetWindowRect       = user32.NewProc("GetWindowRect")
	procPrintWindow         = user32.NewProc("PrintWindow")
	procGetDC               = user32.NewProc("GetDC")
	procReleaseDC           = user32.NewProc("ReleaseDC")
	gdi32                   = windows.NewLazySystemDLL("gdi32.dll")
	procCreateCompatibleDC  = gdi32.NewProc("CreateCompatibleDC")
	procCreateCompatibleBmp = gdi32.NewProc("CreateCompatibleBitmap")
	procSelectObject        = gdi32.NewProc("SelectObject")
	procGetDIBits           = gdi32.NewProc("GetDIBits")
	procDeleteObject        = gdi32.NewProc("DeleteObject")
	procDeleteDC            = gdi32.NewProc("DeleteDC")
	procBitBlt              = gdi32.NewProc("BitBlt")
)

// windowTest opens a window child process, waits until the page asked for state, saves a picture.
func windowTest(srv *Server, kind, picPath string) bool {
	view := ""
	if kind == "popup" {
		view = "popup"
	}
	before := srv.stateHits()
	fg0, _, _ := procGetForegroundWindow.Call()
	c := exec.Command(selfPath(), "--window", kind)
	c.Env = append(os.Environ(), "SG_URL="+srv.URL(view))
	if err := c.Start(); err != nil {
		logf("window test start: %v", err)
		return false
	}
	defer func() { c.Process.Kill(); c.Wait() }()
	cn := classMain
	if kind == "popup" {
		cn = classPopup
	}
	cls, _ := windows.UTF16PtrFromString(cn)
	ok := false
	var hw uintptr
	for i := 0; i < 100; i++ {
		time.Sleep(250 * time.Millisecond)
		hw, _, _ = procFindWindowW.Call(uintptr(unsafe.Pointer(cls)), 0)
		vis, _, _ := procIsWindowVisible.Call(hw)
		if hw != 0 && vis != 0 && srv.stateHits() > before+1 {
			ok = true
			break
		}
	}
	if !ok {
		logf("window test %s: hwnd=%x hits=%d", kind, hw, srv.stateHits()-before)
		return false
	}
	time.Sleep(2500 * time.Millisecond) // let animations settle
	if kind == "popup" {
		fg, _, _ := procGetForegroundWindow.Call()
		if fg == hw {
			logf("popup stole focus (fg before %x)", fg0)
			return false
		}
	}
	if b64 := capture(hw); b64 != "" {
		os.WriteFile(picPath, []byte(b64), 0o644)
	}
	return true
}

func capture(hw uintptr) string {
	var r rect
	procGetWindowRect.Call(hw, uintptr(unsafe.Pointer(&r)))
	w, h := int(r.R-r.L), int(r.B-r.T)
	if w <= 0 || h <= 0 || w > 4000 || h > 4000 {
		return ""
	}
	sdc, _, _ := procGetDC.Call(0)
	defer procReleaseDC.Call(0, sdc)
	mdc, _, _ := procCreateCompatibleDC.Call(sdc)
	defer procDeleteDC.Call(mdc)
	bmp, _, _ := procCreateCompatibleBmp.Call(sdc, uintptr(w), uintptr(h))
	defer procDeleteObject.Call(bmp)
	old, _, _ := procSelectObject.Call(mdc, bmp)
	// copy from the screen (WebView2 draws with DirectComposition; PrintWindow only got the background)
	procSetForegroundWindow.Call(hw)
	time.Sleep(400 * time.Millisecond)
	procBitBlt.Call(mdc, 0, 0, uintptr(w), uintptr(h), sdc, uintptr(r.L), uintptr(r.T), 0x00CC0020|0x40000000 /*SRCCOPY|CAPTUREBLT*/)
	procSelectObject.Call(mdc, old)
	type bih struct {
		Size                          uint32
		W, H                          int32
		Planes, Bits                  uint16
		Compression, SizeImage        uint32
		XPels, YPels, Used, Important int32
	}
	hdr := bih{W: int32(w), H: -int32(h), Planes: 1, Bits: 32}
	hdr.Size = uint32(unsafe.Sizeof(hdr))
	buf := make([]byte, w*h*4)
	procGetDIBits.Call(mdc, bmp, 0, uintptr(h), uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&hdr)), 0)
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for i := 0; i < w*h; i++ {
		img.Pix[i*4], img.Pix[i*4+1], img.Pix[i*4+2], img.Pix[i*4+3] = buf[i*4+2], buf[i*4+1], buf[i*4], 255
	}
	// half size keeps the log small
	sw, sh := w/2, h/2
	small := image.NewRGBA(image.Rect(0, 0, sw, sh))
	for y := 0; y < sh; y++ {
		for x := 0; x < sw; x++ {
			var rr, gg, bb int
			for dy := 0; dy < 2; dy++ {
				for dx := 0; dx < 2; dx++ {
					c := img.RGBAAt(x*2+dx, y*2+dy)
					rr, gg, bb = rr+int(c.R), gg+int(c.G), bb+int(c.B)
				}
			}
			small.SetRGBA(x, y, color.RGBA{uint8(rr / 4), uint8(gg / 4), uint8(bb / 4), 255})
		}
	}
	var jb bytes.Buffer
	jpeg.Encode(&jb, small, &jpeg.Options{Quality: 72})
	return base64.StdEncoding.EncodeToString(jb.Bytes())
}
