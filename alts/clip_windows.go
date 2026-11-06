//go:build windows && clip

package main

// ALTS Clipboard (its own app: ALTS-Clip.exe, built with -tags clip). Runs in the background, starts
// with Windows, opens with Win+V (asked from Windows the normal way, RegisterHotKey) or Ctrl+Alt+V when
// Windows keeps Win+V for itself: everything you copy (text + pictures), pins, stickers and emoji, then
// pastes the one you pick into the app you were in. It never watches the keyboard.

import (
	"bytes"

	"encoding/base64"
	"encoding/json"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"

	"strings"
	"sync"
	"time"
	"unsafe"

	"github.com/jchv/go-webview2/pkg/edge"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

var (
	pAddClipListener   = user32.NewProc("AddClipboardFormatListener")
	pOpenClipboard     = user32.NewProc("OpenClipboard")
	pCloseClipboard    = user32.NewProc("CloseClipboard")
	pEmptyClipboard    = user32.NewProc("EmptyClipboard")
	pGetClipboardData  = user32.NewProc("GetClipboardData")
	pSetClipboardData  = user32.NewProc("SetClipboardData")
	pIsClipFmtAvail    = user32.NewProc("IsClipboardFormatAvailable")
	pRegisterClipFmt   = user32.NewProc("RegisterClipboardFormatW")
	pGetOpenClipWindow = user32.NewProc("GetOpenClipboardWindow")
	pSendInput         = user32.NewProc("SendInput")
	pRegisterHotKey    = user32.NewProc("RegisterHotKey")
	pGetForegroundWin  = user32.NewProc("GetForegroundWindow")
	pGetWindowThreadID = user32.NewProc("GetWindowThreadProcessId")
	pGetGUIThreadInfo  = user32.NewProc("GetGUIThreadInfo")
	pClientToScreen    = user32.NewProc("ClientToScreen")
	pGetCursorPos      = user32.NewProc("GetCursorPos")
	pMonitorFromPoint  = user32.NewProc("MonitorFromPoint")
	pGetMonitorInfoW   = user32.NewProc("GetMonitorInfoW")
	pSetTimer          = user32.NewProc("SetTimer")
	pKillTimer         = user32.NewProc("KillTimer")
	pBringWindowToTop  = user32.NewProc("BringWindowToTop")
	pIsWindow          = user32.NewProc("IsWindow")
	pGlobalAlloc       = kernel32.NewProc("GlobalAlloc")
	pGlobalLock        = kernel32.NewProc("GlobalLock")
	pGlobalUnlock      = kernel32.NewProc("GlobalUnlock")
	pGlobalSize        = kernel32.NewProc("GlobalSize")
	pGlobalFree        = kernel32.NewProc("GlobalFree")
)

const (
	clipClass    = "ALTS.Clip"
	runKey       = `Software\Microsoft\Windows\CurrentVersion\Run`
	runName      = "ALTS Clipboard"
	wmActivate   = 0x0006
	wmTimer      = 0x0113
	wmClipUpdate = 0x031D
	wmKeyDown    = 0x0100
	wmKeyUp      = 0x0101
	wmSysKeyDown = 0x0104
	wmSysKeyUp   = 0x0105
	wmClipShow   = wmApp + 10
	wmClipRun    = wmApp + 11

	vkLWin         = 0x5B
	vkRWin         = 0x5C
	wmHotkey       = 0x0312
	modAlt         = 0x0001
	modControl     = 0x0002
	modWin         = 0x0008
	modNoRepeat    = 0x4000
	cfUnicodeText  = 13
	cfDIB          = 8
	cfDIBV5        = 17
	gmemMoveable   = 2
	wsPopup        = 0x80000000
	wsExToolWindow = 0x00000080
	wsExTopmost    = 0x00000008
	swShow         = 5
	timerRead      = 1
	timerHide      = 2
	timerPaste     = 3
	timerWatch     = 4
	keyeventfKeyUp = 0x0002
	inputKeyboard  = 1
	clipW, clipH   = 380, 500 // normal (96 dpi) pixels
	monitorNearest = 2
)

type keyInput struct { // INPUT with a KEYBDINPUT inside (40 bytes on 64-bit)
	Type  uint32
	_     uint32
	Vk    uint16
	Scan  uint16
	Flags uint32
	Time  uint32
	_     uint32
	Extra uintptr
	_     [8]byte
}

type guiThreadInfo struct {
	Size                                               uint32
	Flags                                              uint32
	Active, Focus, Capture, MenuOwner, MoveSize, Caret uintptr
	RCaret                                             rect
}

type monitorInfo struct {
	Size          uint32
	Monitor, Work rect
	Flags         uint32
}

type clipApp struct {
	dir, picDir, mineDir, json               string
	st                                       clipStore
	win                                      uintptr
	ui                                       *edge.Chromium
	uiReady                                  bool
	prev                                     uintptr // the window you were in when Win+V came
	keyName                                  string  // "Win+V" or "Ctrl+Alt+V"
	tellKey                                  bool
	shownAt                                  time.Time
	grace                                    time.Duration // how long it may stay up without being the window you use
	pasteTries                               int
	fmtPNG, fmtNoWatch, fmtNoHist, fmtIgnore uintptr
	keep                                     []any
}

var clip *clipApp

// WebView2 has to stay on one OS thread with its message loop (ALTS does the same in main_windows.go,
// which isn't part of this app). Without this the Clipboard window stays black.
func init() { runtime.LockOSThread() }

func main() { runClip() }

func runClip() {
	h, _, err := pCreateMutexW.Call(0, 0, uintptr(unsafe.Pointer(u16(`Local\ALTS-clip`))))
	if h != 0 && err == windows.ERROR_ALREADY_EXISTS {
		// Another ALTS Clipboard is running (an older one, or a stuck one): opening this one replaces it.
		if !replaceRunning() {
			return
		}
	}
	if pSetProcessDpiAwareCtx.Find() == nil {
		pSetProcessDpiAwareCtx.Call(^uintptr(3))
	}
	pCoInitializeEx.Call(0, 2)
	root, err := os.UserCacheDir()
	if err != nil {
		return
	}
	c := &clipApp{dir: filepath.Join(root, "ALTS", "clip")}
	clip = c
	c.picDir = filepath.Join(c.dir, "pics")
	c.mineDir = filepath.Join(c.dir, "stickers")
	c.json = filepath.Join(c.dir, "clip.json")
	for _, d := range []string{c.picDir, c.mineDir, filepath.Join(c.dir, "builtin")} {
		os.MkdirAll(d, 0o755)
	}
	c.writeFiles()
	c.st = loadClip(c.json)
	c.autostart(!c.st.NoStart)
	c.fmtPNG = clipFormat("PNG")
	c.fmtNoWatch = clipFormat("ExcludeClipboardContentFromMonitorProcessing")
	c.fmtNoHist = clipFormat("CanIncludeInClipboardHistory")
	c.fmtIgnore = clipFormat("Clipboard Viewer Ignore")

	inst, _, _ := pGetModuleHandleW.Call(0)
	icon, _, _ := pLoadImageW.Call(inst, 1, imageIcon, 0, 0, lrDefaultSize|lrShared)
	cursor, _, _ := pLoadCursorW.Call(0, idcArrow)
	brush, _, _ := pCreateSolidBrush.Call(0x00161313)
	wc := wndClassEx{WndProc: windows.NewCallback(clipProc), Instance: inst, Icon: icon, IconSm: icon, Cursor: cursor, Background: brush, ClassName: u16(clipClass)}
	wc.Size = uint32(unsafe.Sizeof(wc))
	pRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))
	c.win, _, _ = pCreateWindowExW.Call(wsExToolWindow|wsExTopmost, uintptr(unsafe.Pointer(u16(clipClass))), uintptr(unsafe.Pointer(u16("ALTS Clipboard"))),
		wsPopup|wsClipChildren, 0, 0, clipW, clipH, 0, 0, inst, 0)
	if c.win == 0 {
		return
	}
	darkTitle(c.win)
	pAddClipListener.Call(c.win)
	// Win+V if Windows lets go of it, else Ctrl+Alt+V. Both asked from Windows the normal way.
	if r, _, _ := pRegisterHotKey.Call(c.win, 1, modWin|modNoRepeat, 'V'); r != 0 {
		c.keyName = "Win+V"
	} else if r, _, _ := pRegisterHotKey.Call(c.win, 2, modControl|modAlt|modNoRepeat, 'V'); r != 0 {
		c.keyName = "Ctrl+Alt+V"
	}
	c.startUI()

	if c.st.KeyTold != c.keyName { // say once which key opens it
		c.st.KeyTold = c.keyName
		c.save()
		c.tellKey = true // shown once the popup page is ready
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

func clipFormat(name string) uintptr {
	r, _, _ := pRegisterClipFmt.Call(uintptr(unsafe.Pointer(u16(name))))
	return r
}

// writeFiles puts the popup page, the emoji list and the starter stickers in the clip folder
// (the popup loads them from there as https://clip.alts/...).
func (c *clipApp) writeFiles() {
	for _, n := range []string{"clip.html", "emoji.txt"} {
		if b, err := clipUI.ReadFile("ui/" + n); err == nil {
			writeFileAtomic(filepath.Join(c.dir, n), b)
		}
	}
	fs.WalkDir(builtinStickers, "ui/stickers", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		out := filepath.Join(c.dir, "builtin", d.Name())
		if st, e := os.Stat(out); e == nil && st.Size() > 0 {
			return nil
		}
		if b, e := builtinStickers.ReadFile(p); e == nil {
			os.WriteFile(out, b, 0o644)
		}
		return nil
	})
}

func (c *clipApp) autostart(on bool) {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, runKey, registry.SET_VALUE)
	if err != nil {
		return
	}
	defer k.Close()
	if !on {
		k.DeleteValue(runName)
		return
	}
	if exe, err := os.Executable(); err == nil {
		k.SetStringValue(runName, `"`+exe+`"`)
	}
}

func (c *clipApp) startUI() {
	w := edge.NewChromium()
	w.DataPath = filepath.Join(c.dir, "webview")
	w.MessageCallback = c.onMessage
	w.AcceleratorKeyCallback = func(vk uint) bool {
		return vk == vkF5 || vk == vkF12 || (keyDown(vkControl) && strings.ContainsRune("PFRSUOGJ", rune(vk)))
	}
	c.keep = append(c.keep, w)
	if !w.Embed(c.win) {
		return
	}
	c.ui = w
	if s, err := w.GetSettings(); err == nil && s != nil {
		s.PutAreDefaultContextMenusEnabled(false)
		s.PutAreDevToolsEnabled(false)
		s.PutIsZoomControlEnabled(false)
		s.PutIsStatusBarEnabled(false)
	}
	if ctl := w.GetController(); ctl != nil {
		if c2 := ctl.GetICoreWebView2Controller2(); c2 != nil {
			c2.PutDefaultBackgroundColor(edge.COREWEBVIEW2_COLOR{A: 255, R: 0x16, G: 0x16, B: 0x1a})
		}
	}
	w.Resize()
	// The page comes straight from inside the app (same way ALTS shows its side list); pictures are sent to it.
	page, _ := clipUI.ReadFile("ui/clip.html")
	w.NavigateToString(string(page))
}

func (c *clipApp) call(fn string, v any) {
	if c.ui != nil && c.uiReady {
		b, _ := json.Marshal(v)
		c.ui.Eval("window.clip&&clip." + fn + "(" + string(b) + ")")
	}
}

// push sends the whole list to the popup (pictures as data: links, kept in memory once read).
func (c *clipApp) push() {
	type pic struct {
		File string `json:"file"`
		Src  string `json:"src"`
	}
	type row struct {
		clipItem
		Thumb string `json:"thumb,omitempty"`
	}
	items := make([]row, 0, len(c.st.Items))
	for _, it := range c.st.Items {
		r := row{clipItem: it}
		if it.Kind == "pic" {
			r.Thumb = c.dataURL(filepath.Join(c.picDir, strings.TrimSuffix(it.File, ".png")+".thumb.png"))
		}
		items = append(items, r)
	}
	mine := []pic{}
	for _, f := range c.st.Stickers {
		if d := c.dataURL(filepath.Join(c.mineDir, f)); d != "" {
			mine = append(mine, pic{f, d})
		}
	}
	c.call("load", map[string]any{"items": items, "mine": mine, "start": !c.st.NoStart, "key": c.keyName})
}

// assets: the starter stickers + emoji list, once when the popup page is ready.
func (c *clipApp) assets() {
	type pic struct {
		File string `json:"file"`
		Src  string `json:"src"`
	}
	var built []pic
	if es, err := builtinStickers.ReadDir("ui/stickers"); err == nil {
		for _, e := range es {
			if b, err := builtinStickers.ReadFile("ui/stickers/" + e.Name()); err == nil {
				built = append(built, pic{e.Name(), "data:image/png;base64," + base64.StdEncoding.EncodeToString(b)})
			}
		}
	}
	em, _ := clipUI.ReadFile("ui/emoji.txt")
	c.call("assets", map[string]any{"builtin": built, "emoji": string(em)})
}

var dataCache = map[string]string{}

func (c *clipApp) dataURL(path string) string {
	if d, ok := dataCache[path]; ok {
		return d
	}
	b, err := os.ReadFile(path)
	if err != nil || len(b) > 8<<20 {
		return ""
	}
	d := "data:image/png;base64," + base64.StdEncoding.EncodeToString(b)
	if len(dataCache) > 300 {
		clear(dataCache)
	}
	dataCache[path] = d
	return d
}

func (c *clipApp) save() { saveClip(c.json, c.st) }

type clipMsg struct {
	T    string `json:"t"`
	ID   string `json:"id"`
	File string `json:"file"`
	Text string `json:"text"`
	On   bool   `json:"on"`
	Mine bool   `json:"mine"`
}

func (c *clipApp) onMessage(s string) {
	var m clipMsg
	if json.Unmarshal([]byte(s), &m) != nil {
		return
	}
	// run it from the message loop, not inside the WebView2 event
	c.later(func() { c.do(m) })
}

var (
	clipQueue []func()
	clipMu    sync.Mutex
)

// later runs f on the window's thread (safe from any thread).
func (c *clipApp) later(f func()) {
	clipMu.Lock()
	clipQueue = append(clipQueue, f)
	clipMu.Unlock()
	pPostMessageW.Call(c.win, wmClipRun, 0, 0)
}

func (c *clipApp) do(m clipMsg) {
	switch m.T {
	case "ready":
		c.uiReady = true
		c.assets()
		c.push()
		if c.tellKey {
			c.show()
		}
	case "hide":
		c.hide()
	case "paste":
		if i := c.st.find(m.ID); i >= 0 {
			it := c.st.Items[i]
			c.pasteWith(func() bool {
				if it.Kind == "pic" {
					return c.setPicFile(filepath.Join(c.picDir, it.File))
				}
				return c.setText(it.Text)
			})
		}
	case "emoji":
		if m.Text != "" && len(m.Text) < 64 {
			t := m.Text
			c.pasteWith(func() bool { return c.setText(t) })
		}
	case "sticker":
		name, ok := stickerName(m.File)
		if !ok {
			return
		}
		dir := filepath.Join(c.dir, "builtin")
		if m.Mine {
			dir = c.mineDir
		}
		p := filepath.Join(dir, name)
		c.pasteWith(func() bool { return c.setPicFile(p) })
	case "pin":
		if i := c.st.find(m.ID); i >= 0 {
			c.st.Items[i].Pinned = m.On
			c.save()
			c.push()
		}
	case "del":
		removePic(c.picDir, c.st.remove(m.ID))
		c.save()
		c.push()
	case "clear":
		for _, f := range c.st.clear() {
			removePic(c.picDir, f)
		}
		c.save()
		c.push()
	case "star": // a copied picture -> my stickers
		if i := c.st.find(m.ID); i >= 0 && c.st.Items[i].Kind == "pic" {
			src := filepath.Join(c.picDir, c.st.Items[i].File)
			name := "s" + itoa(int(time.Now().Unix())) + ".png"
			if b, err := os.ReadFile(src); err == nil && os.WriteFile(filepath.Join(c.mineDir, name), b, 0o644) == nil {
				c.st.Stickers = append([]string{name}, c.st.Stickers...)
				c.save()
				c.push()
			}
		}
	case "unsticker":
		if name, ok := stickerName(m.File); ok {
			for i, s := range c.st.Stickers {
				if s == name {
					c.st.Stickers = append(c.st.Stickers[:i], c.st.Stickers[i+1:]...)
					os.Remove(filepath.Join(c.mineDir, name))
					break
				}
			}
			c.save()
			c.push()
		}
	case "start":
		c.st.NoStart = !m.On
		c.autostart(m.On)
		c.save()
		c.push()
	case "stuck":
		c.call("stuck", c.whoHoldsIt())
	case "quit":
		c.autostart(!c.st.NoStart)
		pDestroyWindow.Call(c.win)
	}
}

// whoHoldsIt: when copying "doesn't work", it's usually another app keeping the clipboard open.
func (c *clipApp) whoHoldsIt() string {
	w, _, _ := pGetOpenClipWindow.Call()
	if w == 0 {
		if r, _, _ := pOpenClipboard.Call(c.win); r != 0 {
			pCloseClipboard.Call()
			return ""
		}
		return "?"
	}
	var pid uint32
	pGetWindowThreadID.Call(w, uintptr(unsafe.Pointer(&pid)))
	h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
	if err != nil {
		return "an app (number " + itoa(int(pid)) + ")"
	}
	defer windows.CloseHandle(h)
	buf := make([]uint16, 520)
	n := uint32(len(buf))
	if windows.QueryFullProcessImageName(h, 0, &buf[0], &n) != nil {
		return "an app (number " + itoa(int(pid)) + ")"
	}
	return filepath.Base(windows.UTF16ToString(buf[:n]))
}

// ---------- Win+V ----------

func sendKeys(keys ...keyInput) {
	if len(keys) > 0 {
		pSendInput.Call(uintptr(len(keys)), uintptr(unsafe.Pointer(&keys[0])), unsafe.Sizeof(keys[0]))
	}
}

func key(vk uint16, up bool) keyInput {
	k := keyInput{Type: inputKeyboard, Vk: vk}
	if up {
		k.Flags = keyeventfKeyUp
	}
	return k
}

func (c *clipApp) show() {
	fg, _, _ := pGetForegroundWin.Call()
	if fg == c.win {
		return
	}
	c.prev = fg

	// where: next to the text cursor if the app shows one, else next to the mouse
	var at point
	ok := false
	if fg != 0 {
		tid, _, _ := pGetWindowThreadID.Call(fg, 0)
		gi := guiThreadInfo{}
		gi.Size = uint32(unsafe.Sizeof(gi))
		if r, _, _ := pGetGUIThreadInfo.Call(tid, uintptr(unsafe.Pointer(&gi))); r != 0 && gi.Caret != 0 {
			at = point{gi.RCaret.L, gi.RCaret.B}
			pClientToScreen.Call(gi.Caret, uintptr(unsafe.Pointer(&at)))
			ok = true
		}
	}
	if !ok {
		pGetCursorPos.Call(uintptr(unsafe.Pointer(&at)))
	}
	mon, _, _ := pMonitorFromPoint.Call(uintptr(uint32(at.X))|uintptr(uint32(at.Y))<<32, monitorNearest)
	mi := monitorInfo{}
	mi.Size = uint32(unsafe.Sizeof(mi))
	pGetMonitorInfoW.Call(mon, uintptr(unsafe.Pointer(&mi)))
	pSetWindowPos.Call(c.win, 0, uintptr(mi.Work.L), uintptr(mi.Work.T), 10, 10, swpNoZOrder|swpNoActivate) // so the dpi below is this screen's
	d := dpiOf(c.win)
	w, h := int32(clipW)*d/96, int32(clipH)*d/96
	x, y := at.X, at.Y+6
	if x+w > mi.Work.R {
		x = mi.Work.R - w - 8
	}
	if y+h > mi.Work.B {
		y = at.Y - h - 26
	}
	x, y = max(x, mi.Work.L+8), max(y, mi.Work.T+8)
	pSetWindowPos.Call(c.win, ^uintptr(0) /* HWND_TOPMOST */, uintptr(x), uintptr(y), uintptr(w), uintptr(h), 0)
	if c.ui != nil {
		c.ui.Resize()
	}

	// a hotkey from Windows lets this app come to the front
	c.shownAt, c.grace = time.Now(), 1200*time.Millisecond
	if c.tellKey {
		c.grace = 9 * time.Second // the "which key opens it" note: it popped up by itself, give time to read
	}
	pSetTimer.Call(c.win, timerWatch, 400, 0)
	pShowWindow.Call(c.win, swShow)
	if c.ui != nil {
		if ctl := c.ui.GetController(); ctl != nil {
			ctl.PutIsVisible(true)
		}
		c.ui.Resize()
	}
	pBringWindowToTop.Call(c.win)
	pSetForegroundWindow.Call(c.win)
	if c.ui != nil {
		c.ui.Focus()
	}
	c.call("shown", nil)
	if c.tellKey {
		c.tellKey = false
		if c.keyName == "Win+V" {
			c.call("toast", "ALTS Clipboard is on. Press Win+V anywhere to open it.")
		} else if c.keyName != "" {
			c.call("toast", "Windows keeps Win+V for itself, so ALTS Clipboard opens with Ctrl+Alt+V.")
		} else {
			c.call("toast", "Another app took both Win+V and Ctrl+Alt+V. Close it and restart ALTS Clipboard.")
		}
	}
}

func (c *clipApp) hide() {
	pKillTimer.Call(c.win, timerHide)
	pKillTimer.Call(c.win, timerWatch)
	pShowWindow.Call(c.win, swHide)
	if c.ui != nil {
		if ctl := c.ui.GetController(); ctl != nil {
			ctl.PutIsVisible(false) // nothing to draw while hidden
		}
	}
}

// pasteWith puts the thing on the clipboard, goes back to your app and presses Ctrl+V there.
func (c *clipApp) pasteWith(set func() bool) {
	if !set() {
		c.call("toast", "Couldn't put that on the clipboard (another app is holding it).")
		return
	}
	c.hide()
	if c.prev != 0 {
		if r, _, _ := pIsWindow.Call(c.prev); r != 0 {
			pSetForegroundWindow.Call(c.prev)
		}
	}
	c.pasteTries = 0
	pSetTimer.Call(c.win, timerPaste, 70, 0)
}

// pressPaste presses Ctrl+V in your app once you've let go of the shortcut keys (so it's a plain Ctrl+V).
func (c *clipApp) pressPaste() {
	held := keyDown(vkLWin) || keyDown(vkRWin) || keyDown(vkMenu) || keyDown(vkShift) || keyDown(vkControl)
	if held && c.pasteTries < 30 {
		c.pasteTries++
		pSetTimer.Call(c.win, timerPaste, 40, 0)
		return
	}
	sendKeys(key(vkControl, false), key('V', false), key('V', true), key(vkControl, true))
}

// ---------- reading + writing the clipboard ----------

func openClip(h uintptr) bool {
	for i := 0; i < 12; i++ {
		if r, _, _ := pOpenClipboard.Call(h); r != 0 {
			return true
		}
		time.Sleep(25 * time.Millisecond)
	}
	return false
}

func clipBytes(f uintptr) []byte {
	h, _, _ := pGetClipboardData.Call(f)
	if h == 0 {
		return nil
	}
	n, _, _ := pGlobalSize.Call(h)
	p, _, _ := pGlobalLock.Call(h)
	if p == 0 || n == 0 || n > 400<<20 {
		if p != 0 {
			pGlobalUnlock.Call(h)
		}
		return nil
	}
	b := make([]byte, n)
	copy(b, unsafe.Slice((*byte)(unsafe.Pointer(p)), n))
	pGlobalUnlock.Call(h)
	return b
}

func has(f uintptr) bool { r, _, _ := pIsClipFmtAvail.Call(f); return f != 0 && r != 0 }

// read: something new was copied. Password apps mark theirs "don't keep": those are skipped.
func (c *clipApp) read() {
	if !openClip(c.win) {
		return
	}
	var text string
	var raw []byte
	var img image.Image
	skip := has(c.fmtNoWatch) || has(c.fmtIgnore)
	if !skip && has(c.fmtNoHist) {
		if b := clipBytes(c.fmtNoHist); len(b) >= 4 && b[0] == 0 && b[1] == 0 && b[2] == 0 && b[3] == 0 {
			skip = true
		}
	}
	if !skip {
		if has(cfUnicodeText) {
			if b := clipBytes(cfUnicodeText); len(b) >= 2 {
				u := unsafe.Slice((*uint16)(unsafe.Pointer(&b[0])), len(b)/2)
				text = windows.UTF16ToString(u)
			}
		} else if has(c.fmtPNG) {
			raw = clipBytes(c.fmtPNG)
		} else if has(cfDIBV5) {
			img, _ = dibToImage(clipBytes(cfDIBV5))
		} else if has(cfDIB) {
			img, _ = dibToImage(clipBytes(cfDIB))
		}
	}
	pCloseClipboard.Call() // always, right away: a clipboard left open is what breaks copying for every app
	if skip {
		return
	}
	if t, ok := cleanClipText(text); ok {
		c.addItem(clipItem{ID: newClipID(), Kind: "text", Text: t, Hash: hashOf("text", []byte(t)), At: time.Now().Unix()})
		return
	}
	if raw == nil && img == nil {
		return
	}
	go func() { // pictures can be big: decode + save off the window's thread
		if raw != nil {
			if img, _ = png.Decode(bytes.NewReader(raw)); img == nil {
				return
			}
		}
		it, err := savePic(c.picDir, img, raw)
		if err != nil {
			return
		}
		c.later(func() {
			for _, old := range c.st.Items {
				if old.Hash == it.Hash { // same picture again: keep the old file
					removePic(c.picDir, it.File)
					it.File = old.File
					break
				}
			}
			c.addItem(it)
		})
	}()
}

func (c *clipApp) addItem(it clipItem) {
	for _, f := range c.st.add(it) {
		removePic(c.picDir, f)
	}
	c.save()
	c.push()
}

func setClip(f uintptr, b []byte) bool {
	h, _, _ := pGlobalAlloc.Call(gmemMoveable, uintptr(len(b)))
	if h == 0 {
		return false
	}
	p, _, _ := pGlobalLock.Call(h)
	if p == 0 {
		pGlobalFree.Call(h)
		return false
	}
	copy(unsafe.Slice((*byte)(unsafe.Pointer(p)), len(b)), b)
	pGlobalUnlock.Call(h)
	if r, _, _ := pSetClipboardData.Call(f, h); r == 0 {
		pGlobalFree.Call(h)
		return false
	}
	return true // Windows owns it now
}

func (c *clipApp) setText(t string) bool {
	u, err := windows.UTF16FromString(t)
	if err != nil {
		return false
	}
	b := unsafe.Slice((*byte)(unsafe.Pointer(&u[0])), len(u)*2)
	if !openClip(c.win) {
		return false
	}
	pEmptyClipboard.Call()
	ok := setClip(cfUnicodeText, b)
	pCloseClipboard.Call()
	return ok
}

// setPicFile: PNG (keeps see-through, what browsers + Discord read) plus a normal bitmap for older apps.
func (c *clipApp) setPicFile(path string) bool {
	raw, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return false
	}
	if !bytes.HasPrefix(raw, []byte("\x89PNG")) {
		raw = encodePNG(img)
	}
	dib := imageToDIB(img)
	if !openClip(c.win) {
		return false
	}
	pEmptyClipboard.Call()
	ok := setClip(c.fmtPNG, raw)
	ok = setClip(cfDIB, dib) || ok
	pCloseClipboard.Call()
	return ok
}

func clipProc(h, m, wp, lp uintptr) uintptr {
	c := clip
	switch m {
	case wmHotkey:
		if c != nil {
			if fg, _, _ := pGetForegroundWin.Call(); fg == h {
				c.hide() // the shortcut again closes it
			} else {
				c.show()
			}
		}
		return 0
	case wmClipShow:
		if c != nil {
			c.show()
		}
		return 0
	case wmClipRun:
		clipMu.Lock()
		q := clipQueue
		clipQueue = nil
		clipMu.Unlock()
		for _, f := range q {
			f()
		}
		return 0
	case wmClipUpdate:
		pSetTimer.Call(h, timerRead, 90, 0) // apps put their formats on one by one; read once they're done
		return 0
	case wmTimer:
		if wp == timerWatch { // closes it once you're clearly somewhere else (even if Windows never gave it focus)
			if fg, _, _ := pGetForegroundWin.Call(); fg != h && time.Since(c.shownAt) > c.grace {
				c.hide()
			}
			return 0
		}
		pKillTimer.Call(h, wp)
		switch wp {
		case timerRead:
			c.read()
		case timerHide:
			if fg, _, _ := pGetForegroundWin.Call(); fg != h {
				c.hide()
			}
		case timerPaste:
			c.pressPaste()
		}
		return 0
	case wmActivate:
		if wp&0xFFFF == 0 { // lost focus: close once it's clear you went somewhere else
			pSetTimer.Call(h, timerHide, 150, 0)
		}
	case wmSize:
		if c != nil && c.ui != nil {
			c.ui.Resize()
		}
		return 0
	case wmSetFocus:
		if c != nil && c.ui != nil {
			c.ui.Focus()
		}
		return 0
	case wmClose:
		c.hide()
		return 0
	case wmDestroy:
		pPostQuitMessage.Call(0)
		return 0
	}
	r, _, _ := pDefWindowProcW.Call(h, m, wp, lp)
	return r
}

// replaceRunning ends the ALTS Clipboard that's already running (only that app: found by its own window),
// so a newer or fixed one can take over. false = couldn't, leave it be.
func replaceRunning() bool {
	for i := 0; i < 3; i++ {
		w, _, _ := pFindWindowW.Call(uintptr(unsafe.Pointer(u16(clipClass))), 0)
		if w == 0 {
			return true // it's already gone
		}
		var pid uint32
		pGetWindowThreadID.Call(w, uintptr(unsafe.Pointer(&pid)))
		if pid == 0 || pid == windows.GetCurrentProcessId() {
			return false
		}
		p, err := windows.OpenProcess(windows.PROCESS_TERMINATE|windows.SYNCHRONIZE, false, pid)
		if err != nil {
			return false
		}
		windows.TerminateProcess(p, 0)
		windows.WaitForSingleObject(p, 3000)
		windows.CloseHandle(p)
		time.Sleep(200 * time.Millisecond)
	}
	w, _, _ := pFindWindowW.Call(uintptr(unsafe.Pointer(u16(clipClass))), 0)
	return w == 0
}
