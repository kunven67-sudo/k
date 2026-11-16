package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	webview2 "github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
)

func init() { runtime.LockOSThread() }

func arg(name string) (string, bool) {
	for i, a := range os.Args[1:] {
		if strings.EqualFold(a, name) {
			if i+2 < len(os.Args) {
				return os.Args[i+2], true
			}
			return "", true
		}
	}
	return "", false
}

func main() {
	self, _ := os.Executable()
	_, quiet = arg("-quiet")
	if url, ok := arg("-window"); ok {
		runWindow(url)
		return
	}
	if out, ok := arg("-selftest"); ok {
		os.Exit(selftest(out))
	}
	if _, ok := arg("-install"); ok {
		if !isAdmin() {
			msgBox("SoundGuard needs the Yes on the Windows pop-up to set itself up.", true)
			return
		}
		user, _ := arg("-user")
		if err := doInstall(user); err != nil {
			msgBox("SoundGuard couldn't set itself up: "+err.Error(), true)
			return
		}
		if _, ok := arg("-noshow"); ok {
			return
		}
		startInstalled()
		return
	}
	if _, ok := arg("-uninstall"); ok {
		if !isAdmin() {
			runAs(self, "-uninstall")
			return
		}
		if err := uninstallAll(true); err != nil {
			msgBox("Couldn't fully remove SoundGuard: "+err.Error(), true)
			return
		}
		msgBox("SoundGuard is removed. Your sound settings stay how they are.", false)
		return
	}

	_, background := arg("-background")
	_, showFlag := arg("-show")
	show := showFlag || !background

	if bgRunning() {
		if show {
			procAllowFg.Call(uintptr(0xFFFFFFFF))
			if h := waitTray(3 * time.Second); h != 0 {
				procPostMsg.Call(h, uintptr(msgShow), 0, 0)
			}
		}
		return
	}

	if !background {
		iv := installedVersion()
		needInstall := iv == "" || verLess(iv, appVersion)
		switch {
		case needInstall && isAdmin():
			if err := doInstall(userName()); err != nil {
				msgBox("SoundGuard couldn't set itself up: "+err.Error(), true)
			} else {
				startInstalled()
				return
			}
		case needInstall:
			if runAs(self, fmt.Sprintf(`-install -user "%s"`, userName())) {
				return
			}
			msgBox("SoundGuard needs one Yes so it can fix sound by itself and start with Windows.\n\nRunning without it for now: it can still fix mute, volume and which device is used, but not restart Windows Audio.", true)
		case !samePath(self, installedExe()) || !isAdmin():
			// already set up: start the real one (it runs with full rights from the task)
			hidden(sys32("schtasks.exe"), "/Run", "/TN", "SoundGuard").Run()
			procAllowFg.Call(uintptr(0xFFFFFFFF))
			if h := waitTray(6 * time.Second); h != 0 {
				procPostMsg.Call(h, uintptr(msgShow), 0, 0)
				return
			}
			if runAs(installedExe(), "-background -show") {
				return
			}
		}
	}
	runBackground(show)
}

func startInstalled() {
	c := hidden(installedExe(), "-background", "-show")
	c.SysProcAttr.CreationFlags = 0
	c.Start()
}

func dataDir() string {
	d := filepath.Join(os.Getenv("LOCALAPPDATA"), "SoundGuard")
	os.MkdirAll(d, 0o755)
	return d
}

func runBackground(show bool) {
	if _, err := windows.CreateMutex(nil, false, u16(`Local\SoundGuard-bg`)); err == windows.ERROR_ALREADY_EXISTS {
		if h := waitTray(3 * time.Second); h != 0 && show {
			procPostMsg.Call(h, uintptr(msgShow), 0, 0)
		}
		return
	}
	pc := newWinPC()
	app := NewApp(pc, dataDir(), windows.GetCurrentProcessId())
	url, err := app.Serve(0)
	if err != nil {
		msgBox("SoundGuard couldn't start: "+err.Error(), true)
		return
	}
	pc.url = url
	t := newTray(app)
	pc.tray = t
	app.OpenWindow = pc.openWindow
	app.Quit = t.quit
	app.mu.Lock()
	app.addLog("info", "SoundGuard started", fmt.Sprintf("Version %s, full rights: %v", appVersion, pc.admin))
	app.mu.Unlock()
	go app.Run()
	if show {
		go pc.openWindow()
	}
	t.loop()
}

func runWindow(url string) {
	if _, err := windows.CreateMutex(nil, false, u16(`Local\SoundGuard-window`)); err == windows.ERROR_ALREADY_EXISTS {
		if h := findWin("webview", "SoundGuard"); h != 0 {
			bringToFront(h)
		}
		return
	}
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		AutoFocus: true,
		DataPath:  filepath.Join(dataDir(), "webview"),
		WindowOptions: webview2.WindowOptions{
			Title: "SoundGuard", Width: 1240, Height: 820, IconId: 1, Center: true,
		},
	})
	if w == nil {
		msgBox("SoundGuard's window needs Microsoft Edge WebView2 (it comes with Windows 11). SoundGuard keeps fixing sound in the background anyway.", true)
		return
	}
	darkTitle(uintptr(w.Window()))
	w.SetSize(1240, 820, webview2.HintNone)
	w.SetSize(980, 660, webview2.HintMin)
	w.Navigate(url)
	w.Run()
}

// selftest: real checks on a real Windows sound device (used by the Windows test run).
func selftest(out string) int {
	dir, _ := os.MkdirTemp("", "sg")
	pc := newWinPC()
	app := NewApp(pc, dir, windows.GetCurrentProcessId())
	app.set.Popups = false
	res := map[string]any{"version": appVersion, "admin": pc.admin}
	ok := true
	check := func(name string, pass bool, info any) {
		res[name] = map[string]any{"pass": pass, "info": info}
		if !pass {
			ok = false
		}
	}
	devs, err := pc.Devices()
	check("1-devices", err == nil && len(devs) > 0, map[string]any{"err": fmt.Sprint(err), "devices": devs})
	o := pick(devs, true, "")
	if o == nil || o.State != "active" {
		check("2-pick-output", false, "no active output")
		return finish(out, res, false)
	}
	check("2-pick-output", true, o.Label())
	how, err := pc.SetDefault(o.ID)
	check("3-set-default", err == nil, map[string]any{"how": how, "err": fmt.Sprint(err)})

	pc.SetMute(o.ID, true)
	app.Tick()
	d2, _ := pc.Devices()
	o2 := pick(d2, true, o.ID)
	check("4-unmute-fix", o2 != nil && !o2.Muted, o2)

	pc.SetVolume(o.ID, 0)
	time.Sleep(200 * time.Millisecond)
	app.Tick()
	d3, _ := pc.Devices()
	o3 := pick(d3, true, o.ID)
	check("5-volume-fix", o3 != nil && o3.Volume >= 0.19, o3)

	r := pc.EngineTest(o.ID)
	check("6-engine-test", r.OK || r.Busy, r)

	pl, err := pc.PlayTest(o.ID, "left")
	check("7-play-left", err == nil && pl > 0.001, map[string]any{"peak": pl, "err": fmt.Sprint(err)})
	pr, err := pc.PlayTest(o.ID, "right")
	check("8-play-right", err == nil && pr > 0.001, map[string]any{"peak": pr, "err": fmt.Sprint(err)})

	res["9-sessions"] = pc.Sessions(o.ID)
	res["10-services"] = pc.Services()
	res["11-drivers"] = pc.DriverIssues()
	res["12-driver-info"] = pc.DriverInfo()
	p1, p2 := pc.MicPrivacy()
	res["13-privacy"] = []any{p1, p2}
	if in := pick(d3, false, ""); in != nil && in.State == "active" {
		for i := 0; i < 20; i++ {
			pc.MicListen(in.ID)
			time.Sleep(100 * time.Millisecond)
		}
		res["14-mic"] = map[string]any{"dev": in.Label(), "level": pc.MicLevel()}
	}
	url, err := app.Serve(0)
	if err == nil {
		base := strings.Split(url, "/?t=")[0]
		rq, _ := http.NewRequest("GET", base+"/api/state", nil)
		rq.Header.Set("X-SG-Token", app.token)
		resp, err1 := http.DefaultClient.Do(rq)
		good := err1 == nil && resp.StatusCode == 200
		var st map[string]any
		if good {
			b, _ := io.ReadAll(resp.Body)
			good = json.Unmarshal(b, &st) == nil && st["status"] != nil
			resp.Body.Close()
		}
		resp2, err2 := http.Get(base + "/api/state")
		bad := err2 == nil && resp2.StatusCode == 403
		page, err3 := http.Get(base + "/")
		pg := err3 == nil && page.StatusCode == 200
		check("15-http", good && bad && pg, map[string]any{"status": st["status"], "headline": st["headline"]})
	} else {
		check("15-http", false, err.Error())
	}
	app.mu.Lock()
	res["log"] = app.log
	app.mu.Unlock()
	return finish(out, res, ok)
}

func finish(out string, res map[string]any, ok bool) int {
	res["ok"] = ok
	b, _ := json.MarshalIndent(res, "", " ")
	os.WriteFile(out, b, 0o644)
	if ok {
		return 0
	}
	return 1
}
