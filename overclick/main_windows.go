//go:build windows

package main

import (
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"maps"
	"math"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
	"unsafe"

	webview2 "github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
)

//go:embed ui/index.html
var indexHTML string

//go:embed ui/fonts/chakra-petch-600.woff2
var font600 []byte

//go:embed ui/fonts/chakra-petch-700.woff2
var font700 []byte

const appVersion = "1.0.0"

// WebView2 must be created and pumped on the main OS thread.
func init() { runtime.LockOSThread() }

type App struct {
	path string
	eng  *Engine
	ui   *winUI
	wv   webview2.WebView
	main uintptr

	runMu sync.Mutex // keeps Start/Stop from overlapping (button + hotkey + stop rule)

	mu        sync.Mutex
	st        Settings
	hotkeyOK  bool
	picking   int
	meter     cpsMeter
	tickStop  chan struct{}
	saveTimer *time.Timer
}

func (s Settings) clone() Settings {
	c := s
	c.Clickers = append([]ClickerCfg(nil), s.Clickers...)
	c.Warned = maps.Clone(s.Warned)
	return c
}

func main() {
	h, _, err := pCreateMutexW.Call(0, 0, uintptr(unsafe.Pointer(u16("Local\\OVERCLICK-one-at-a-time"))))
	if h != 0 && err == windows.ERROR_ALREADY_EXISTS {
		// Already open: bring that window up instead of fighting over the hotkey.
		if w, _, _ := pFindWindowW.Call(uintptr(unsafe.Pointer(u16("webview"))), uintptr(unsafe.Pointer(u16("OVERCLICK")))); w != 0 {
			pShowWindow.Call(w, swRestore)
			pSetForegroundWindow.Call(w)
		}
		return
	}

	app := &App{path: settingsPath()}
	app.st = loadSettings(app.path)
	app.keepSpotsOnScreen()
	app.eng = NewEngine(&winBackend{app: app})
	app.eng.onFinish = func() { app.Stop("done") }
	app.ui = newWinUI(app)
	theUI = app.ui
	go app.ui.run()
	<-app.ui.ready

	os.Setenv("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "FF0B0E14") // no white flash on open
	dataDir := filepath.Join(os.Getenv("LOCALAPPDATA"), "OVERCLICK", "WebView2")
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		DataPath:  dataDir,
		AutoFocus: true,
		WindowOptions: webview2.WindowOptions{
			Title: "OVERCLICK", Width: 460, Height: 820, IconId: 1, Center: true,
		},
	})
	if w == nil {
		messageBox("OVERCLICK needs the Microsoft Edge WebView2 Runtime, and it isn't on this PC.\n\n"+
			"It's free from Microsoft: search \"WebView2 Runtime download\", install the Evergreen version, then open OVERCLICK again.",
			"OVERCLICK", 0x10)
		return
	}
	app.wv = w
	app.main = uintptr(w.Window())
	darkTitleBar(app.main)
	app.placeWindow()

	w.Bind("ocInit", app.initData)
	w.Bind("ocSave", app.save)
	w.Bind("ocToggle", func() { go app.Toggle() })
	w.Bind("ocAdd", app.add)
	w.Bind("ocRemove", app.remove)
	w.Bind("ocPick", app.pick)
	w.SetHtml(buildHTML())

	st := app.snapshot()
	app.ui.do(func() {
		app.ui.syncMarkers(st.Clickers, st.ShowTargets)
		app.hotkeyResult(st.Hotkey, app.ui.setHotkey(st.Hotkey))
	})
	app.setOnTop(st.OnTop)

	w.Run()
	app.shutdown()
}

func buildHTML() string {
	css := "@font-face{font-family:'Chakra Petch';font-weight:600;font-display:block;src:url(data:font/woff2;base64," +
		base64.StdEncoding.EncodeToString(font600) + ") format('woff2')}" +
		"@font-face{font-family:'Chakra Petch';font-weight:700;font-display:block;src:url(data:font/woff2;base64," +
		base64.StdEncoding.EncodeToString(font700) + ") format('woff2')}"
	return strings.Replace(indexHTML, "/*@FONTS*/", css, 1)
}

func (a *App) placeWindow() {
	s := windowScale(a.main)
	wa := workArea()
	w := int32(math.Round(460 * s))
	h := int32(math.Round(820 * s))
	if maxH := wa.B - wa.T - int32(40*s); h > maxH {
		h = maxH
	}
	x := wa.L + (wa.R-wa.L-w)/2
	y := wa.T + (wa.B-wa.T-h)/2
	pSetWindowPos.Call(a.main, 0, uintptr(x), uintptr(y), uintptr(w), uintptr(h), swpNoZOrder|swpNoActivate)
	a.wv.SetSize(int(380*s), int(520*s), webview2.HintMin)
}

func (a *App) setOnTop(on bool) {
	z := hwndNoTopmost
	if on {
		z = hwndTopmost
	}
	pSetWindowPos.Call(a.main, z, 0, 0, 0, 0, swpNoMove|swpNoSize|swpNoActivate)
}

// keepSpotsOnScreen pulls back targets left on a monitor that's gone now.
func (a *App) keepSpotsOnScreen() {
	vx, vy, vw, vh := virtualScreen()
	wa := workArea()
	for i := range a.st.Clickers {
		c := &a.st.Clickers[i]
		if c.X < int(vx) || c.Y < int(vy) || c.X >= int(vx+vw) || c.Y >= int(vy+vh) {
			c.X, c.Y = int(wa.L+wa.R)/2, int(wa.T+wa.B)/2
		}
	}
}

func (a *App) snapshot() Settings {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.st.clone()
}

func (a *App) emit(ev map[string]any) {
	b, err := json.Marshal(ev)
	if err != nil || a.wv == nil {
		return
	}
	js := "window.ocEvent&&window.ocEvent(" + string(b) + ")"
	a.wv.Dispatch(func() { a.wv.Eval(js) })
}

func (a *App) initData() map[string]any {
	a.mu.Lock()
	defer a.mu.Unlock()
	return map[string]any{
		"settings": a.st.clone(), "hotkeyOK": a.hotkeyOK, "version": appVersion,
		"running": a.eng.Running(), "palette": clickerPalette, "colors": modeColors,
	}
}

func (a *App) hotkeyResult(key string, ok bool) {
	a.mu.Lock()
	a.hotkeyOK = ok
	a.mu.Unlock()
	a.emit(map[string]any{"type": "hotkey", "ok": ok, "key": key})
}

// save takes the whole settings object from the screen, cleans it, and applies it.
func (a *App) save(in Settings) Settings {
	a.mu.Lock()
	old := a.st
	in.AllTime = old.AllTime // the click counter is ours, not the page's
	in.Normalize()
	a.st = in
	st := a.st.clone()
	a.mu.Unlock()

	a.scheduleSave()
	a.ui.do(func() { a.ui.syncMarkers(st.Clickers, st.ShowTargets) })
	if st.Hotkey != old.Hotkey {
		a.ui.do(func() { a.hotkeyResult(st.Hotkey, a.ui.setHotkey(st.Hotkey)) })
	}
	if st.OnTop != old.OnTop {
		a.setOnTop(st.OnTop)
	}
	if a.eng.Running() {
		a.eng.Update(newRunConfig(&st))
	}
	return st
}

func (a *App) add() Settings {
	a.mu.Lock()
	if len(a.st.Clickers) < maxClickers {
		n := len(a.st.Clickers)
		s := windowScale(a.main)
		r := windowRect(a.main)
		wa := workArea()
		// New targets show up right next to the window so they're easy to find.
		x := r.L - int32(110*s)
		if x < wa.L+int32(40*s) {
			x = r.R + int32(110*s)
		}
		y := r.T + int32((150+float64(n%8)*56)*s)
		if y > wa.B-int32(40*s) {
			y = (wa.T + wa.B) / 2
		}
		id := a.st.NextID
		a.st.NextID++
		a.st.Clickers = append(a.st.Clickers, ClickerCfg{
			ID: id, Name: fmt.Sprintf("Clicker %d", id), On: true, Follow: false,
			X: int(x), Y: int(y), Button: "left", Speed: Speed{Mode: "normal", Value: 1, Unit: "ms"},
		})
		a.st.Normalize()
	}
	st := a.st.clone()
	a.mu.Unlock()
	return a.save(st)
}

func (a *App) remove(id int) Settings {
	a.mu.Lock()
	st := a.st.clone()
	a.mu.Unlock()
	if len(st.Clickers) > 1 {
		out := st.Clickers[:0]
		for _, c := range st.Clickers {
			if c.ID != id {
				out = append(out, c)
			}
		}
		st.Clickers = out
	}
	return a.save(st)
}

func (a *App) pick(id int) {
	if a.eng.Running() {
		return
	}
	a.mu.Lock()
	name := ""
	for _, c := range a.st.Clickers {
		if c.ID == id {
			name = c.Name
		}
	}
	if name == "" || a.picking != 0 {
		a.mu.Unlock()
		return
	}
	a.picking = id
	a.mu.Unlock()
	a.ui.do(func() { a.ui.startPick(id, name) })
}

// pickDone runs on the overlay thread when the "click to place" screen closes.
func (a *App) pickDone(id int, ok bool, p point) {
	a.mu.Lock()
	a.picking = 0
	if ok {
		for i := range a.st.Clickers {
			if a.st.Clickers[i].ID == id {
				a.st.Clickers[i].X, a.st.Clickers[i].Y = int(p.X), int(p.Y)
				a.st.Clickers[i].Follow = false
			}
		}
	}
	st := a.st.clone()
	a.mu.Unlock()

	pShowWindowAsync.Call(a.main, swRestore)
	pSetForegroundWindow.Call(a.main)
	if ok {
		a.ui.syncMarkers(st.Clickers, st.ShowTargets)
		a.scheduleSave()
		a.emit(map[string]any{"type": "picked", "id": id, "x": p.X, "y": p.Y})
	} else {
		a.emit(map[string]any{"type": "pickCancel", "id": id})
	}
}

// markerMoved runs on the overlay thread while a target is dragged.
func (a *App) markerMoved(id, x, y int, final bool) {
	a.mu.Lock()
	for i := range a.st.Clickers {
		if a.st.Clickers[i].ID == id {
			a.st.Clickers[i].X, a.st.Clickers[i].Y = x, y
		}
	}
	a.mu.Unlock()
	a.emit(map[string]any{"type": "moved", "id": id, "x": x, "y": y})
	if final {
		a.scheduleSave()
	}
}

func (a *App) Toggle() {
	a.runMu.Lock()
	defer a.runMu.Unlock()
	if a.eng.Running() {
		a.stopLocked("user")
	} else {
		a.startLocked()
	}
}

func (a *App) Stop(reason string) {
	a.runMu.Lock()
	defer a.runMu.Unlock()
	a.stopLocked(reason)
}

func (a *App) startLocked() {
	a.mu.Lock()
	picking := a.picking != 0
	st := a.st.clone()
	a.mu.Unlock()
	if picking {
		a.ui.do(a.ui.cancelPick)
	}
	rc := newRunConfig(&st)
	if len(rc.clickers) == 0 {
		a.emit(map[string]any{"type": "toast", "text": "Turn on at least one auto clicker first."})
		return
	}
	if !a.eng.Start(rc, st.Stop) {
		return
	}

	// A target under this window would just get skipped, so get out of the way.
	if r := windowRect(a.main); !a.minimized() {
		for _, c := range rc.clickers {
			if !c.Follow && int32(c.X) >= r.L && int32(c.X) < r.R && int32(c.Y) >= r.T && int32(c.Y) < r.B {
				pShowWindowAsync.Call(a.main, swMinimize)
				break
			}
		}
	}

	stop := make(chan struct{})
	a.mu.Lock()
	a.meter.Reset()
	a.tickStop = stop
	a.mu.Unlock()
	a.ui.do(func() {
		a.ui.setEsc(true)
		a.ui.setClickThrough(true)
	})
	a.tick(time.Now(), stop)
	go func() {
		t := time.NewTicker(200 * time.Millisecond)
		defer t.Stop()
		for {
			select {
			case <-stop:
				return
			case now := <-t.C:
				a.tick(now, stop)
			}
		}
	}()
}

func (a *App) minimized() bool {
	r, _, _ := pIsIconic.Call(a.main)
	return r != 0
}

// tick pushes live stats to the window and the on-screen badge. It sends
// while holding a.mu and only if this run is still the current one, so a late
// tick can never land after the "stopped" update and show CLICKING again.
func (a *App) tick(now time.Time, run chan struct{}) {
	total := a.eng.Total()
	elapsed := a.eng.Elapsed().Seconds()
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.tickStop != run {
		return
	}
	cps := a.meter.Add(now, total)
	fast, _ := fastestSpeed(&a.st)
	a.emit(map[string]any{"type": "status", "running": true, "total": total, "cps": cps,
		"elapsed": elapsed, "allTime": a.st.AllTime + total})
	text, color := "", ""
	if a.st.ShowBadge {
		text = fmt.Sprintf("%s  ·  %s clicks/s  ·  %s or Esc to stop", fast.Name(), commas(int64(math.Round(cps))), a.st.Hotkey)
		color = modeColors[fast.Mode]
	}
	a.ui.do(func() { a.ui.setHUD(text, color) })
}

func (a *App) stopLocked(reason string) {
	total, ok := a.eng.Stop()
	if !ok {
		return
	}
	a.mu.Lock()
	if a.tickStop != nil {
		close(a.tickStop)
		a.tickStop = nil
	}
	a.st.AllTime += total
	a.emit(map[string]any{"type": "status", "running": false, "total": total, "cps": 0, "elapsed": 0, "allTime": a.st.AllTime})
	a.emit(map[string]any{"type": "stopped", "reason": reason, "total": total})
	a.ui.do(func() {
		a.ui.setEsc(false)
		a.ui.setClickThrough(false)
		a.ui.setHUD("", "")
	})
	a.mu.Unlock()
	a.scheduleSave()
}

func (a *App) scheduleSave() {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.saveTimer != nil {
		a.saveTimer.Stop()
	}
	a.saveTimer = time.AfterFunc(400*time.Millisecond, a.saveNow)
}

func (a *App) saveNow() {
	st := a.snapshot()
	saveSettings(a.path, st)
}

func (a *App) shutdown() {
	a.Stop("exit")
	a.mu.Lock()
	if a.saveTimer != nil {
		a.saveTimer.Stop()
	}
	a.mu.Unlock()
	a.saveNow()
}

func commas(n int64) string {
	s := fmt.Sprint(n)
	if n < 0 {
		return "-" + commas(-n)
	}
	for i := len(s) - 3; i > 0; i -= 3 {
		s = s[:i] + "," + s[i:]
	}
	return s
}

// winBackend clicks for real with SendInput.
type winBackend struct {
	app *App
	buf []input
}

func (b *winBackend) Click(c *ClickerCfg, returnMouse bool) int {
	cur := getCursorPos()
	spot := cur
	if !c.Follow {
		spot = point{int32(c.X), int32(c.Y)}
	}
	// Never click OVERCLICK itself, so the Stop button always works.
	if b.app.main != 0 && rootWindowAt(spot) == b.app.main {
		return 0
	}
	vx, vy, vw, vh := virtualScreen()
	in, reps := clickInputs(b.buf, c, cur, vx, vy, vw, vh, returnMouse)
	b.buf = in
	if sendInputs(in) == 0 {
		return 0
	}
	return reps
}
