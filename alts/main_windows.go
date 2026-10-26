//go:build windows

// ALTS: one window, a list of Claude accounts on the left, each one with its own
// separate login (its own WebView2 data folder), all staying logged in at once.
package main

import (
	_ "embed"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
	"unsafe"

	"github.com/jchv/go-webview2/pkg/edge"
	"golang.org/x/sys/windows"
)

//go:embed ui/index.html
var uiHTML string

const (
	appName    = "ALTS"
	mainClass  = "ALTS.Main"
	hostClass  = "ALTS.Host"
	homeURL    = "https://claude.ai/"
	newChatURL = "https://claude.ai/new"
	sideW      = 84 // side list width in normal (96 dpi) pixels, same as #side in the UI
	wmCmd      = wmApp + 1
)

// ICoreWebView2 / ICoreWebView2Controller / event args vtable spots (IUnknown's 3 included).
const (
	wvReload           = 31
	wvGoBack           = 40
	wvGoForward        = 41
	wvAddNewWindowReq  = 44
	ctlClose           = 24
	ctlGetCoreWebView2 = 25
	nwArgsGetURI       = 3
	nwArgsPutHandled   = 6
)

// WebView2 has to live on one OS thread with a message loop.
func init() { runtime.LockOSThread() }

type view struct {
	c  *edge.Chromium
	wv unsafe.Pointer // the account's ICoreWebView2
}

// cmd is one thing to do, from the side list or a key. They all run from the
// window's message loop, never inside a WebView2 event.
type cmd struct {
	T     string `json:"t"`
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
	A     string `json:"a"`
	Dir   int    `json:"dir"`
	On    bool   `json:"on"`
}

type App struct {
	base, cfg           string
	st                  Settings
	main, side, content uintptr
	ui                  *edge.Chromium
	uiReady             bool
	views               map[string]*view
	active              string
	loading             string
	busy                bool // an account is starting up (WebView2 runs its own loop meanwhile)
	wide                bool // a box (new / edit / help) is open over the whole window
	closing             bool
	queue               []cmd
	keep                []any // handlers WebView2 still points at
}

var app *App

func main() {
	if pSetProcessDpiAwareCtx.Find() == nil {
		pSetProcessDpiAwareCtx.Call(^uintptr(3)) // -4 = per monitor v2 (the manifest says so too)
	}
	h, _, err := pCreateMutexW.Call(0, 0, uintptr(unsafe.Pointer(u16(`Local\ALTS-one-window`))))
	if h != 0 && err == windows.ERROR_ALREADY_EXISTS {
		// Already open: bring that window up. Two copies would fight over the same logins.
		if w, _, _ := pFindWindowW.Call(uintptr(unsafe.Pointer(u16(mainClass))), 0); w != 0 {
			if r, _, _ := pIsIconic.Call(w); r != 0 {
				pShowWindow.Call(w, swRestore)
			}
			pSetForegroundWindow.Call(w)
		}
		return
	}
	pCoInitializeEx.Call(0, 2) // single-threaded COM, needed by WebView2

	root, err := os.UserCacheDir() // %LOCALAPPDATA%
	if err != nil {
		msgBox("ALTS can't find your AppData folder.", mbOK|mbIconError)
		return
	}
	base := filepath.Join(root, appName)
	accDir := filepath.Join(base, "accounts")
	if err := os.MkdirAll(accDir, 0o755); err != nil {
		msgBox("ALTS can't make its folder:\n"+base, mbOK|mbIconError)
		return
	}

	a := &App{base: base, cfg: filepath.Join(base, "alts.json"), views: map[string]*view{}}
	app = a
	st, state := loadSettings(a.cfg)
	switch state {
	case fileOK:
		for _, dir := range st.orphans(accDir) {
			go removeLater(dir)
		}
	case fileBroken:
		os.Rename(a.cfg, a.cfg+".broken")
		st.adopt(accDir)
	case fileMissing:
		st.adopt(accDir)
	}
	if len(st.Accounts) == 0 && state != fileOK {
		st.add("Main", palette[0])
	}
	a.st = st
	a.save()

	a.makeWindows()
	if !a.startUI() {
		pShowWindow.Call(a.main, swHide)
		if msgBox("ALTS needs Microsoft Edge WebView2 to show web pages. It's free from Microsoft and most PCs already have it.\n\nPress OK to open the download page.", mbOKCancel|mbIconError) == idOK {
			shellOpen("https://go.microsoft.com/fwlink/p/?LinkId=2124703")
		}
		return
	}
	first := a.st.Last
	if a.st.find(first) < 0 && len(a.st.Accounts) > 0 {
		first = a.st.Accounts[0].ID
	}
	if first != "" {
		a.open(first)
	}

	var m msg
	for {
		r, _, _ := pGetMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if int32(r) <= 0 {
			break
		}
		pTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
		pDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
	}
}

func (a *App) makeWindows() {
	inst, _, _ := pGetModuleHandleW.Call(0)
	icon, _, _ := pLoadImageW.Call(inst, 1, imageIcon, 0, 0, lrDefaultSize|lrShared)
	iconSm, _, _ := pLoadImageW.Call(inst, 1, imageIcon, uintptr(sysMetric(49)), uintptr(sysMetric(50)), lrShared)
	cursor, _, _ := pLoadCursorW.Call(0, idcArrow)
	brush, _, _ := pCreateSolidBrush.Call(0x00161313) // #131316

	for _, c := range []struct {
		name string
		proc uintptr
	}{{mainClass, windows.NewCallback(wndProc)}, {hostClass, windows.NewCallback(hostProc)}} {
		wc := wndClassEx{
			WndProc: c.proc, Instance: inst, Icon: icon, IconSm: iconSm,
			Cursor: cursor, Background: brush, ClassName: u16(c.name),
		}
		wc.Size = uint32(unsafe.Sizeof(wc))
		pRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))
	}

	a.main, _, _ = pCreateWindowExW.Call(0, uintptr(unsafe.Pointer(u16(mainClass))), uintptr(unsafe.Pointer(u16(appName))),
		wsOverlappedWin|wsClipChildren, cwUseDefault, cwUseDefault, cwUseDefault, cwUseDefault, 0, 0, inst, 0)
	darkTitle(a.main)
	child := uintptr(wsChild | wsVisible | wsClipChildren | wsClipSiblings)
	a.content, _, _ = pCreateWindowExW.Call(0, uintptr(unsafe.Pointer(u16(hostClass))), 0, child, 0, 0, 0, 0, a.main, 0, inst, 0)
	a.side, _, _ = pCreateWindowExW.Call(0, uintptr(unsafe.Pointer(u16(hostClass))), 0, child, 0, 0, 0, 0, a.main, 0, inst, 0)
	a.place()
	a.layout()
}

// place puts the window back where it was last time, or in the middle of the screen.
func (a *App) place() {
	if p := a.st.Place; p != nil && p.R-p.L >= 300 && p.B-p.T >= 200 {
		r := rect{p.L, p.T, p.R, p.B}
		if mon, _, _ := pMonitorFromRect.Call(uintptr(unsafe.Pointer(&r)), 0); mon != 0 {
			wp := windowPlacement{ShowCmd: swShowNormal, Normal: r}
			wp.Length = uint32(unsafe.Sizeof(wp))
			if p.Max {
				wp.ShowCmd = swShowMaximized
			}
			pSetWindowPlacement.Call(a.main, uintptr(unsafe.Pointer(&wp)))
			return
		}
	}
	var work rect
	pSystemParametersInfoW.Call(spiGetWorkArea, 0, uintptr(unsafe.Pointer(&work)), 0)
	d := dpiOf(a.main)
	w, h := 1280*d/96, 840*d/96
	if ww, wh := work.R-work.L, work.B-work.T; ww > 400 && wh > 300 {
		w, h = min(w, ww-24), min(h, wh-24)
		pSetWindowPos.Call(a.main, 0, uintptr(work.L+(ww-w)/2), uintptr(work.T+(wh-h)/2), uintptr(w), uintptr(h), swpNoZOrder|swpNoActivate)
	} else {
		pSetWindowPos.Call(a.main, 0, 0, 0, uintptr(w), uintptr(h), swpNoZOrder|swpNoActivate|swpNoMove)
	}
	pShowWindow.Call(a.main, swShowNormal)
}

func (a *App) savePlace() {
	var wp windowPlacement
	wp.Length = uint32(unsafe.Sizeof(wp))
	if r, _, _ := pGetWindowPlacement.Call(a.main, uintptr(unsafe.Pointer(&wp))); r == 0 {
		return
	}
	n := wp.Normal
	maxed := wp.ShowCmd == swShowMaximized || (wp.ShowCmd == 2 && wp.Flags&2 != 0) // 2 = minimized, flag 2 = comes back maximized
	a.st.Place = &Place{L: n.L, T: n.T, R: n.R, B: n.B, Max: maxed}
	a.save()
}

func (a *App) startUI() bool {
	c := edge.NewChromium()
	c.DataPath = filepath.Join(a.base, "ui")
	c.MessageCallback = a.onUIMessage
	c.AcceleratorKeyCallback = a.accel(true)
	a.keep = append(a.keep, c)
	if !c.Embed(a.side) {
		return false
	}
	a.ui = c
	if s, err := c.GetSettings(); err == nil && s != nil {
		s.PutAreDefaultContextMenusEnabled(false)
		s.PutAreDevToolsEnabled(false)
		s.PutIsZoomControlEnabled(false)
		s.PutIsStatusBarEnabled(false)
		s.PutAreBrowserAcceleratorKeysEnabled(false)
	}
	if ctl := c.GetController(); ctl != nil {
		if c2 := ctl.GetICoreWebView2Controller2(); c2 != nil {
			c2.PutDefaultBackgroundColor(edge.COREWEBVIEW2_COLOR{A: 255, R: 0x13, G: 0x13, B: 0x16})
		}
	}
	c.NavigateToString(uiHTML)
	a.layout()
	return true
}

// full: the side list covers the whole window (a box is open, or there are no accounts).
func (a *App) full() bool { return a.wide || len(a.st.Accounts) == 0 }

func (a *App) layout() {
	if a.side == 0 || a.content == 0 {
		return
	}
	var r rect
	pGetClientRect.Call(a.main, uintptr(unsafe.Pointer(&r)))
	if r.R <= 0 || r.B <= 0 {
		return
	}
	sw := min(int32(sideW)*dpiOf(a.main)/96, r.R)
	uiW := sw
	if a.full() {
		uiW = r.R
	}
	pMoveWindow.Call(a.content, uintptr(sw), 0, uintptr(r.R-sw), uintptr(r.B), 1)
	pMoveWindow.Call(a.side, 0, 0, uintptr(uiW), uintptr(r.B), 1)
	if a.full() {
		pSetWindowPos.Call(a.side, 0, 0, 0, 0, 0, swpNoMove|swpNoSize|swpNoActivate) // on top
	}
	if a.ui != nil {
		a.ui.Resize()
	}
	for _, v := range a.views {
		v.c.Resize()
	}
}

func (a *App) save() { saveSettings(a.cfg, a.st) }

func (a *App) title() {
	t := appName
	if i := a.st.find(a.active); i >= 0 {
		t = a.st.Accounts[i].Name + " - " + appName
	}
	pSetWindowTextW.Call(a.main, uintptr(unsafe.Pointer(u16(t))))
}

// push sends the account list to the side list page.
func (a *App) push() {
	if a.ui == nil || !a.uiReady {
		return
	}
	type item struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Color   string `json:"color"`
		Loaded  bool   `json:"loaded"`
		Loading bool   `json:"loading"`
	}
	out := struct {
		Accounts []item `json:"accounts"`
		Active   string `json:"active"`
		Wide     bool   `json:"wide"`
	}{Accounts: []item{}, Active: a.active, Wide: a.full()}
	for _, acc := range a.st.Accounts {
		out.Accounts = append(out.Accounts, item{acc.ID, acc.Name, acc.Color, a.views[acc.ID] != nil, a.loading == acc.ID})
	}
	b, _ := json.Marshal(out)
	a.ui.Eval("window.ALTS&&ALTS.state(" + string(b) + ")")
}

func (a *App) toast(text string) {
	if a.ui == nil || !a.uiReady {
		return
	}
	b, _ := json.Marshal(text)
	a.ui.Eval("window.ALTS&&ALTS.toast(" + string(b) + ")")
}

func (a *App) onUIMessage(s string) {
	var c cmd
	if json.Unmarshal([]byte(s), &c) == nil && c.T != "" {
		a.enqueue(c)
	}
}

func (a *App) enqueue(c cmd) {
	a.queue = append(a.queue, c)
	pPostMessageW.Call(a.main, wmCmd, 0, 0)
}

func (a *App) drain() {
	for len(a.queue) > 0 && !a.busy && !a.closing {
		c := a.queue[0]
		a.queue = a.queue[1:]
		a.do(c)
	}
}

func (a *App) do(c cmd) {
	switch c.T {
	case "ready":
		a.uiReady = true
		a.title()
		a.push()
	case "select":
		a.open(c.ID)
	case "add":
		acc := a.st.add(c.Name, c.Color)
		a.save()
		a.setWide(false)
		a.open(acc.ID)
	case "edit":
		if i := a.st.find(c.ID); i >= 0 {
			acc := &a.st.Accounts[i]
			acc.Name = cleanName(c.Name, acc.Name)
			if col := strings.ToLower(c.Color); colorRe.MatchString(col) {
				acc.Color = col
			}
			a.save()
			a.title()
			a.push()
		}
	case "move":
		if a.st.move(c.ID, c.Dir) {
			a.save()
			a.push()
		}
	case "sleep":
		if c.ID != a.active {
			a.closeView(c.ID)
			a.push()
		}
	case "delete":
		a.deleteAccount(c.ID)
	case "nav":
		a.nav(c.A)
	case "wide":
		a.setWide(c.On)
	case "num":
		if !a.wide {
			if id := a.st.byNumber(c.Dir); id != "" {
				a.open(id)
			}
		}
	case "cycle":
		if !a.wide {
			if id := a.st.cycle(a.active, c.Dir); id != "" && id != a.active {
				a.open(id)
			}
		}
	case "ext":
		if opensOutside(c.A) {
			shellOpen(c.A)
		}
	}
}

// open switches to an account, starting its browser the first time.
func (a *App) open(id string) {
	if a.st.find(id) < 0 {
		return
	}
	if a.views[id] != nil {
		a.show(id)
		return
	}
	prev := a.views[a.active]
	if prev != nil {
		prev.c.Hide() // blank while the new one starts, so it's clear something is happening
	}
	a.busy, a.loading = true, id
	a.push()

	c := edge.NewChromium()
	c.DataPath = filepath.Join(a.base, "accounts", id)
	c.SetPermission(edge.CoreWebView2PermissionKindMicrophone, edge.CoreWebView2PermissionStateAllow)
	c.SetPermission(edge.CoreWebView2PermissionKindClipboardRead, edge.CoreWebView2PermissionStateAllow)
	c.AcceleratorKeyCallback = a.accel(false)
	a.keep = append(a.keep, c)
	ok := c.Embed(a.content) // waits (running the message loop) until it's ready
	a.busy, a.loading = false, ""

	if ok {
		v := &view{c: c}
		if ctl := c.GetController(); ctl != nil {
			comCall(unsafe.Pointer(ctl), ctlGetCoreWebView2, uintptr(unsafe.Pointer(&v.wv)))
		}
		if v.wv != nil {
			h := &newWinHandler{vtbl: &newWinVtbl, app: a}
			a.keep = append(a.keep, h)
			var token int64
			comCall(v.wv, wvAddNewWindowReq, uintptr(unsafe.Pointer(h)), uintptr(unsafe.Pointer(&token)))
		}
		a.views[id] = v
		c.Resize()
		c.Navigate(homeURL)
		a.show(id)
	} else {
		if prev != nil && !a.full() {
			prev.c.Show()
		}
		a.toast("Couldn't open that account. Try again.")
		a.push()
	}
	if a.closing {
		pDestroyWindow.Call(a.main)
		return
	}
	if len(a.queue) > 0 {
		pPostMessageW.Call(a.main, wmCmd, 0, 0)
	}
}

func (a *App) show(id string) {
	v := a.views[id]
	if v == nil {
		return
	}
	for k, o := range a.views {
		if k != id {
			o.c.Hide()
		}
	}
	a.active = id
	if a.full() {
		v.c.Hide()
	} else {
		v.c.Show()
		v.c.Focus()
	}
	a.st.Last = id
	a.save()
	a.title()
	a.push()
}

func (a *App) setWide(on bool) {
	if a.wide != on {
		a.wide = on
		a.layout()
		if v := a.views[a.active]; v != nil {
			if a.full() {
				v.c.Hide()
			} else {
				v.c.Show()
				v.c.Focus()
			}
		}
		if a.full() && a.ui != nil {
			a.ui.Focus()
		}
	}
	a.push()
}

// closeView shuts an account's browser (sleep / delete). Its login stays on disk.
func (a *App) closeView(id string) {
	v := a.views[id]
	if v == nil {
		return
	}
	delete(a.views, id)
	v.c.Hide()
	if ctl := v.c.GetController(); ctl != nil {
		comCall(unsafe.Pointer(ctl), ctlClose)
	}
}

func (a *App) deleteAccount(id string) {
	i := a.st.find(id)
	if i < 0 {
		return
	}
	a.closeView(id)
	a.st.remove(id)
	go removeLater(filepath.Join(a.base, "accounts", id))
	wasActive := a.active == id
	if wasActive {
		a.active = ""
	}
	a.save()
	a.wide = false
	a.layout()
	if wasActive && len(a.st.Accounts) > 0 {
		a.open(a.st.Accounts[min(i, len(a.st.Accounts)-1)].ID)
		return
	}
	if v := a.views[a.active]; v != nil && !a.full() {
		v.c.Show()
		v.c.Focus()
	} else if a.ui != nil {
		a.ui.Focus()
	}
	a.title()
	a.push()
}

// removeLater wipes a deleted account's login folder. WebView2 lets go of it a few
// seconds after its window closes, so keep trying for a while.
func removeLater(dir string) {
	if !validID(filepath.Base(dir)) {
		return
	}
	for try := 0; try < 60; try++ {
		os.RemoveAll(dir)
		if _, err := os.Stat(dir); os.IsNotExist(err) {
			return
		}
		time.Sleep(time.Second)
	}
}

func (a *App) nav(what string) {
	v := a.views[a.active]
	if v == nil {
		return
	}
	switch what {
	case "back":
		comCall(v.wv, wvGoBack)
	case "fwd":
		comCall(v.wv, wvGoForward)
	case "reload":
		comCall(v.wv, wvReload)
	case "home":
		v.c.Navigate(newChatURL)
	}
	if !a.full() {
		v.c.Focus()
	}
}

func (a *App) focusCurrent() {
	if v := a.views[a.active]; v != nil && !a.full() {
		v.c.Focus()
	} else if a.ui != nil {
		a.ui.Focus()
	}
}

// accel handles keys pressed inside a page. true = ALTS used it.
func (a *App) accel(fromUI bool) func(uint) bool {
	return func(vk uint) bool {
		ctrl, shift, alt := keyDown(vkControl), keyDown(vkShift), keyDown(vkMenu)
		switch {
		case ctrl && !alt && vk >= '1' && vk <= '9':
			a.enqueue(cmd{T: "num", Dir: int(vk - '0')})
			return true
		case ctrl && !alt && vk == vkTab:
			d := 1
			if shift {
				d = -1
			}
			a.enqueue(cmd{T: "cycle", Dir: d})
			return true
		}
		if !fromUI {
			return false
		}
		// Keys pressed while the side list has focus act on the account, and the
		// side list page itself can't be reloaded, zoomed, printed or inspected.
		switch {
		case vk == vkF5 || (ctrl && vk == 'R'):
			a.enqueue(cmd{T: "nav", A: "reload"})
			return true
		case (alt && vk == vkLeft) || vk == vkBrowserBack:
			a.enqueue(cmd{T: "nav", A: "back"})
			return true
		case (alt && vk == vkRight) || vk == vkBrowserForward:
			a.enqueue(cmd{T: "nav", A: "fwd"})
			return true
		case vk == vkF12 || vk == 0x72 || (ctrl && shift && vk == 'I'):
			return true
		case ctrl && vk < 0x80 && strings.ContainsRune("PFGSUONWTHJ0", rune(vk)):
			return true
		case ctrl && (vk == 0xBB || vk == 0xBD || vk == 0x6B || vk == 0x6D): // zoom + and -
			return true
		}
		return false
	}
}

func wndProc(h, m, wp, lp uintptr) uintptr {
	a := app
	switch m {
	case wmSize:
		if wp != sizeMinimized {
			a.layout()
		}
		return 0
	case wmMove:
		if a.ui != nil {
			a.ui.NotifyParentWindowPositionChanged()
		}
		for _, v := range a.views {
			v.c.NotifyParentWindowPositionChanged()
		}
	case wmSetFocus:
		a.focusCurrent()
		return 0
	case wmDPIChanged:
		r := (*rect)(unsafe.Pointer(lp))
		pSetWindowPos.Call(h, 0, uintptr(r.L), uintptr(r.T), uintptr(r.R-r.L), uintptr(r.B-r.T), swpNoZOrder|swpNoActivate)
		return 0
	case wmGetMinMaxInfo:
		mm := (*minMaxInfo)(unsafe.Pointer(lp))
		d := dpiOf(h)
		mm.MinTrackSize = point{620 * d / 96, 420 * d / 96}
		return 0
	case wmCmd:
		a.drain()
		return 0
	case wmClose:
		a.savePlace()
		if a.busy {
			// An account is still starting; close as soon as it's done.
			a.closing = true
			pShowWindow.Call(h, swHide)
			return 0
		}
		pDestroyWindow.Call(h)
		return 0
	case wmDestroy:
		pPostQuitMessage.Call(0)
		return 0
	}
	r, _, _ := pDefWindowProcW.Call(h, m, wp, lp)
	return r
}

func hostProc(h, m, wp, lp uintptr) uintptr {
	if m == wmSetFocus && app != nil {
		app.focusCurrent()
		return 0
	}
	r, _, _ := pDefWindowProcW.Call(h, m, wp, lp)
	return r
}

// newWinHandler is a tiny COM object for NewWindowRequested: links to other sites
// open in the PC's normal browser instead of a bare popup window.
type newWinHandler struct {
	vtbl *[4]uintptr
	app  *App
}

var newWinVtbl = [4]uintptr{
	windows.NewCallback(func(this *newWinHandler, iid uintptr, out *uintptr) uintptr {
		if out != nil {
			*out = uintptr(unsafe.Pointer(this))
		}
		return 0
	}),
	windows.NewCallback(func(this *newWinHandler) uintptr { return 1 }),
	windows.NewCallback(func(this *newWinHandler) uintptr { return 1 }),
	windows.NewCallback(func(this *newWinHandler, sender, args unsafe.Pointer) uintptr {
		this.app.onNewWindow(args)
		return 0
	}),
}

func (a *App) onNewWindow(args unsafe.Pointer) {
	var p *uint16
	if comCall(args, nwArgsGetURI, uintptr(unsafe.Pointer(&p))) != 0 || p == nil {
		return
	}
	link := windows.UTF16PtrToString(p)
	pCoTaskMemFree.Call(uintptr(unsafe.Pointer(p)))
	if opensOutside(link) {
		comCall(args, nwArgsPutHandled, 1)
		a.enqueue(cmd{T: "ext", A: link})
	}
}
