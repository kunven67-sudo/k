//go:build windows

package main

// One exe does everything:
//   SoundGuard.exe              -> open the window (first time: "Turn on SOUNDGUARD")
//   SoundGuard.exe --guard      -> the background guardian (started by Windows at logon, as admin)
//   SoundGuard.exe --window X   -> a window (main / popup), started by the guardian
//   SoundGuard.exe --install    -> copy to Program Files + start with Windows (admin)
//   SoundGuard.exe --uninstall  -> remove everything
//   SoundGuard.exe -selftest f  -> Windows test run (CI)

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sys/windows"
)

func main() {
	dir := dataDir()
	setLogFile(dir)
	args := os.Args[1:]
	mode := ""
	if len(args) > 0 {
		mode = args[0]
	}
	defer func() {
		if r := recover(); r != nil {
			logf("PANIC main (%s): %v\n%s", mode, r, stack())
			os.Exit(9)
		}
	}()
	switch mode {
	case "-selftest":
		os.Exit(selftest(args[1:]))
	case "-playtone":
		secs := 4.0
		if len(args) > 1 {
			secs, _ = strconv.ParseFloat(args[1], 64)
		}
		playTone(secs)
	case "--guard":
		guard(dir, hasArg(args, "--show"))
	case "--window":
		kind := "main"
		if len(args) > 1 {
			kind = args[1]
		}
		wv := "wv-user"
		if isAdmin() {
			wv = "wv-admin"
		}
		os.Exit(runWindow(kind, os.Getenv("SG_URL"), filepath.Join(dir, wv)))
	case "--install":
		os.Remove(filepath.Join(dir, "install-error.txt"))
		if err := install(!hasArg(args, "--no-start")); err != nil {
			logf("install failed: %v", err)
			os.MkdirAll(dir, 0o755)
			os.WriteFile(filepath.Join(dir, "install-error.txt"), []byte(err.Error()), 0o644)
			os.Exit(1)
		}
	case "--uninstall":
		if !isAdmin() {
			if err := elevate("--uninstall"); err != nil {
				msgBox("SOUNDGUARD wasn't removed: " + err.Error())
			}
			return
		}
		if err := uninstall(); err != nil {
			msgBox("SOUNDGUARD wasn't fully removed: " + err.Error())
			os.Exit(1)
		}
		if !hasArg(args, "--quiet") {
			msgBox("SOUNDGUARD is removed. Bye bro.")
		}
	default:
		launcher(dir)
	}
}

func hasArg(args []string, a string) bool {
	for _, x := range args {
		if x == a {
			return true
		}
	}
	return false
}

// ---------- talking to a running guardian ----------

func portFile(dir string) string { return filepath.Join(dir, "port.txt") }

func readPort(dir string) int {
	b, err := os.ReadFile(portFile(dir))
	if err != nil {
		return 0
	}
	p, _ := strconv.Atoi(strings.TrimSpace(string(b)))
	return p
}

var localHTTP = &http.Client{Timeout: 3 * time.Second}

func ping(port int) (string, bool) {
	if port <= 0 {
		return "", false
	}
	r, err := localHTTP.Get("http://127.0.0.1:" + strconv.Itoa(port) + "/api/ping")
	if err != nil {
		return "", false
	}
	defer r.Body.Close()
	var p struct{ App, Version, Mode string }
	if json.NewDecoder(r.Body).Decode(&p) != nil || p.App != "soundguard" || p.Mode != "guard" {
		return "", false
	}
	return p.Version, true
}

func postShow(port int) {
	procAllowSetFg.Call(^uintptr(0)) // ASFW_ANY: let the window come to the front
	r, err := localHTTP.Post("http://127.0.0.1:"+strconv.Itoa(port)+"/api/show", "application/json", strings.NewReader("{}"))
	if err == nil {
		r.Body.Close()
	}
}

// newer: is version a newer than b ("1.2.0" > "1.1.9")
func newer(a, b string) bool {
	pa, pb := strings.Split(a, "."), strings.Split(b, ".")
	for i := 0; i < 3; i++ {
		var x, y int
		if i < len(pa) {
			x, _ = strconv.Atoi(pa[i])
		}
		if i < len(pb) {
			y, _ = strconv.Atoi(pb[i])
		}
		if x != y {
			return x > y
		}
	}
	return false
}

func waitGuardian(dir string, d time.Duration) (string, int, bool) {
	end := time.Now().Add(d)
	for time.Now().Before(end) {
		p := readPort(dir)
		if v, ok := ping(p); ok {
			return v, p, true
		}
		time.Sleep(300 * time.Millisecond)
	}
	return "", 0, false
}

// ---------- double-click ----------

func launcher(dir string) {
	if v, p, ok := waitGuardian(dir, 600*time.Millisecond); ok {
		if newer(appVersion, v) && !samePath(selfPath(), installedExe()) {
			setupUI(dir, v)
			return
		}
		postShow(p)
		return
	}
	if taskExists() {
		if err := runTask(); err == nil {
			if v, p, ok := waitGuardian(dir, 15*time.Second); ok {
				if newer(appVersion, v) && !samePath(selfPath(), installedExe()) {
					setupUI(dir, v)
					return
				}
				postShow(p)
				return
			}
		}
		logf("task exists but the guardian didn't start; showing setup")
	}
	setupUI(dir, "")
}

// setupUI = "Turn on SOUNDGUARD" (or "Update") window, not admin.
func setupUI(dir, running string) {
	srv := &Server{Mode: "setup"}
	srv.SetupSt = func() any {
		if running != "" {
			return map[string]any{"update": true, "running": running}
		}
		return map[string]any{}
	}
	var once sync.Once
	srv.Extra = map[string]func(Req) (any, error){
		"install": func(Req) (any, error) {
			var err error
			done := make(chan struct{})
			go func() { defer close(done); withCOMSTA(func() { err = elevate("--install") }) }()
			<-done
			if err != nil {
				return nil, err
			}
			_, p, ok := waitGuardian(dir, 20*time.Second)
			if !ok {
				return nil, errors.New("SOUNDGUARD got installed but didn't start. Restart your PC and it starts by itself.")
			}
			once.Do(func() {
				go func() {
					postShow(p)
					time.Sleep(1500 * time.Millisecond)
					if theHost != nil {
						procPostMessageW.Call(theHost.hwnd, wmClose, 0, 0)
					}
				}()
			})
			return nil, nil
		},
	}
	if _, err := srv.Start(0); err != nil {
		msgBox("SOUNDGUARD couldn't start: " + err.Error())
		return
	}
	runWindow("main", srv.URL(""), filepath.Join(dir, "wv-user"))
}

// ---------- the guardian ----------

type winUI struct {
	t        *tray
	g        *Guardian
	srv      *Server
	mu       sync.Mutex
	mainCmd  *exec.Cmd
	popCmd   *exec.Cmd
	startsOn int32
}

func (u *winUI) Notify(t, b string) { u.t.Notify(t, b) }
func (u *winUI) Tray(l string)      { u.t.Tray(l) }

func (u *winUI) spawn(kind string) (*exec.Cmd, error) {
	view := ""
	if kind == "popup" {
		view = "popup"
	}
	c := exec.Command(selfPath(), "--window", kind)
	c.Env = append(os.Environ(), "SG_URL="+u.srv.URL(view))
	if err := c.Start(); err != nil {
		return nil, err
	}
	procAllowSetFg.Call(uintptr(c.Process.Pid))
	return c, nil
}

func (u *winUI) openMain() {
	if focusMain() {
		return
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	if u.mainCmd != nil {
		return // starting up
	}
	c, err := u.spawn("main")
	if err != nil {
		logf("open window: %v", err)
		return
	}
	u.mainCmd = c
	go func() {
		c.Wait()
		u.mu.Lock()
		u.mainCmd = nil
		u.mu.Unlock()
	}()
}

func (u *winUI) Popup(kind string) {
	u.mu.Lock()
	defer u.mu.Unlock()
	if u.popCmd != nil {
		return
	}
	c, err := u.spawn("popup")
	if err != nil {
		logf("popup: %v", err)
		return
	}
	u.popCmd = c
	go func() {
		c.Wait()
		u.mu.Lock()
		u.popCmd = nil
		u.mu.Unlock()
		u.g.Do(func() {
			if u.g.popupOpen { // closed without a button (killed etc) = Later
				u.g.PopupClosed()
			}
		})
	}()
}

func (u *winUI) closeWindows() {
	u.mu.Lock()
	defer u.mu.Unlock()
	for _, c := range []*exec.Cmd{u.mainCmd, u.popCmd} {
		if c != nil && c.Process != nil {
			c.Process.Kill()
		}
	}
}

func guard(dir string, show bool) {
	name, _ := windows.UTF16PtrFromString(`Local\SoundGuard.Guardian`)
	if _, err := windows.CreateMutex(nil, false, name); err == windows.ERROR_ALREADY_EXISTS {
		if show {
			if _, p, ok := waitGuardian(dir, 5*time.Second); ok {
				postShow(p)
			}
		}
		return
	}
	logf("guardian starting v%s admin=%v exe=%s", appVersion, isAdmin(), selfPath())
	b := newWinBackend()
	t := &tray{ready: make(chan struct{}), level: "ok", tip: trayTips["ok"]}
	u := &winUI{t: t}
	g := NewGuardian(b, u, dir)
	u.g = g
	if taskEnabled() {
		u.startsOn = 1
	}
	g.startsWithW = func() bool { return atomic.LoadInt32(&u.startsOn) == 1 }
	srv := &Server{G: g, Mode: "guard", OnShow: u.openMain}
	u.srv = srv
	stop := make(chan struct{})
	quit := func() {
		logf("guardian quitting")
		u.closeWindows()
		b.StopLive()
		t.quit()
		time.AfterFunc(3*time.Second, func() { os.Exit(0) })
	}
	srv.Extra = map[string]func(Req) (any, error){
		"startup": func(q Req) (any, error) {
			if err := setTaskEnabled(q.On); err != nil {
				return nil, err
			}
			if q.On {
				atomic.StoreInt32(&u.startsOn, 1)
			} else {
				atomic.StoreInt32(&u.startsOn, 0)
			}
			return nil, nil
		},
		"uninstall": func(Req) (any, error) {
			go func() {
				time.Sleep(700 * time.Millisecond)
				u.closeWindows()
				if err := uninstall(); err != nil {
					msgBox("SOUNDGUARD wasn't fully removed: " + err.Error())
				}
				quit()
			}()
			return nil, nil
		},
		"quit": func(Req) (any, error) { go quit(); return nil, nil },
	}
	if _, err := srv.Start(0); err != nil {
		logf("server: %v", err)
		msgBox("SOUNDGUARD couldn't start its window server: " + err.Error())
		return
	}
	os.MkdirAll(dir, 0o755)
	os.WriteFile(portFile(dir), []byte(strconv.Itoa(srv.Port())), 0o644)
	t.onOpen = u.openMain
	t.onFix = func() { g.Do(g.FixNow) }
	t.onQuit = quit
	go g.Run(stop)
	if show {
		go func() { <-t.ready; u.openMain() }()
	}
	t.run() // until Quit
	close(stop)
	logf("guardian stopped")
}

// playTone = test helper: another app playing sound (CI).
func playTone(secs float64) {
	withCOM(func() {
		a := newAudio()
		defer a.reset()
		id := a.defaultID(eRender, 0)
		amp := float32(0.3)
		if os.Getenv("SG_SILENT") != "" {
			amp = 0 // an app playing silence (paused game)
		}
		r := playOn(a, id, func(rate int) []float32 {
			n := int(secs * float64(rate))
			out := make([]float32, n)
			for i := range out {
				out[i] = amp * float32(math.Sin(2*math.Pi*440*float64(i)/float64(rate)))
			}
			return out
		})
		fmt.Println(r)
	})
}
