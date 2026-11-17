package main

// OVERDRIVE's own windows: a plain Win32 window with WebView2 inside (no browser around it).

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"unsafe"

	"github.com/jchv/go-webview2/pkg/edge"
	"golang.org/x/sys/windows"
)

var (
	user32   = windows.NewLazySystemDLL("user32.dll")
	kernel32 = windows.NewLazySystemDLL("kernel32.dll")
	dwmapi   = windows.NewLazySystemDLL("dwmapi.dll")
	shell32  = windows.NewLazySystemDLL("shell32.dll")

	procMessageBoxW              = user32.NewProc("MessageBoxW")
	procRegisterClassExW         = user32.NewProc("RegisterClassExW")
	procCreateWindowExW          = user32.NewProc("CreateWindowExW")
	procDefWindowProcW           = user32.NewProc("DefWindowProcW")
	procShowWindow               = user32.NewProc("ShowWindow")
	procUpdateWindow             = user32.NewProc("UpdateWindow")
	procSetForegroundWindow      = user32.NewProc("SetForegroundWindow")
	procFindWindowW              = user32.NewProc("FindWindowW")
	procIsIconic                 = user32.NewProc("IsIconic")
	procIsZoomed                 = user32.NewProc("IsZoomed")
	procIsWindowVisible          = user32.NewProc("IsWindowVisible")
	procGetWindowRect            = user32.NewProc("GetWindowRect")
	procPostQuitMessage          = user32.NewProc("PostQuitMessage")
	procDestroyWindow            = user32.NewProc("DestroyWindow")
	procGetMessageW              = user32.NewProc("GetMessageW")
	procTranslateMessage         = user32.NewProc("TranslateMessage")
	procDispatchMessageW         = user32.NewProc("DispatchMessageW")
	procPostMessageW             = user32.NewProc("PostMessageW")
	procSendMessageW             = user32.NewProc("SendMessageW")
	procLoadImageW               = user32.NewProc("LoadImageW")
	procLoadCursorW              = user32.NewProc("LoadCursorW")
	procGetSystemMetrics         = user32.NewProc("GetSystemMetrics")
	procSetWindowPos             = user32.NewProc("SetWindowPos")
	procRegisterHotKey           = user32.NewProc("RegisterHotKey")
	procUnregisterHotKey         = user32.NewProc("UnregisterHotKey")
	procFlashWindowEx            = user32.NewProc("FlashWindowEx")
	procGetForegroundWindow      = user32.NewProc("GetForegroundWindow")
	procAllowSetForegroundWindow = user32.NewProc("AllowSetForegroundWindow")
	procMonitorFromRect          = user32.NewProc("MonitorFromRect")
	procMonitorFromWindow        = user32.NewProc("MonitorFromWindow")
	procGetMonitorInfoW          = user32.NewProc("GetMonitorInfoW")
	procSetWindowLongPtrW        = user32.NewProc("SetWindowLongPtrW")
	procGetWindowLongPtrW        = user32.NewProc("GetWindowLongPtrW")
	procSetTimer                 = user32.NewProc("SetTimer")
	procKillTimer                = user32.NewProc("KillTimer")
	procSetWindowTextW           = user32.NewProc("SetWindowTextW")
	procGetModuleHandleW         = kernel32.NewProc("GetModuleHandleW")
	procCreateMutexW             = kernel32.NewProc("CreateMutexW")
	procDwmSetWindowAttribute    = dwmapi.NewProc("DwmSetWindowAttribute")
	procShellExecuteW            = shell32.NewProc("ShellExecuteW")
)

const (
	wmDestroy        = 0x0002
	wmSize           = 0x0005
	wmMove           = 0x0003
	wmActivate       = 0x0006
	wmClose          = 0x0010
	wmGetMinMaxInfo  = 0x0024
	wmCopyData       = 0x004A
	wmTimer          = 0x0113
	wmHotkey         = 0x0312
	wmMoving         = 0x0216
	wmApp            = 0x8000
	swHide           = 0
	swShow           = 5
	swRestore        = 9
	swShowNormal     = 1
	swMaximize       = 3
	swMinimize       = 6
	sizeMinimized    = 1
	wsOverlappedWin  = 0x00CF0000
	wsPopup          = 0x80000000
	wsVisible        = 0x10000000
	wsExToolWindow   = 0x00000080
	wsExTopmost      = 0x00000008
	wsExNoActivate   = 0x08000000
	cwUseDefault     = 0x80000000
	smCxScreen       = 0
	smCyScreen       = 1
	gwlStyleU        = ^uintptr(15)
	gwlExStyleU      = ^uintptr(19)
	swpNoSize        = 0x0001
	swpNoMove        = 0x0002
	swpNoZOrder      = 0x0004
	swpNoActivate    = 0x0010
	swpFrameChanged  = 0x0020
	swpShowWindow    = 0x0040
	monDefaultNear   = 2
	monDefaultNull   = 0
	errAlreadyExists = 183
)

type rect struct{ Left, Top, Right, Bottom int32 }
type point struct{ X, Y int32 }
type msgT struct {
	Hwnd    uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      point
	_       uint32
}
type minMaxInfo struct {
	Reserved, MaxSize, MaxPosition, MinTrackSize, MaxTrackSize point
}
type monitorInfo struct {
	CbSize            uint32
	Monitor, WorkArea rect
	Flags             uint32
}
type wndClassEx struct {
	CbSize        uint32
	Style         uint32
	WndProc       uintptr
	ClsExtra      int32
	WndExtra      int32
	Instance      uintptr
	Icon          uintptr
	Cursor        uintptr
	Background    uintptr
	MenuName      *uint16
	ClassName     *uint16
	IconSm        uintptr
}
type copyDataStruct struct {
	DwData uintptr
	CbData uint32
	LpData uintptr
}
type flashInfo struct {
	CbSize    uint32
	Hwnd      uintptr
	Flags     uint32
	Count     uint32
	Timeout   uint32
}

func u16(s string) *uint16 { p, _ := syscall.UTF16PtrFromString(s); return p }

// ------------------------------------------------------------------ host window

type host struct {
	hwnd      uintptr
	wv        *edge.Chromium
	kind      string // "app", "desk", "bar"
	dataDir   string
	url       string
	minW      int32
	minH      int32
	hidden    bool
	onMessage func(h *host, m map[string]any)
	onHotkey  func(h *host, id uintptr)
	onClose   func(h *host) bool // return false to keep the window open
	onCopy    func(h *host, s string)
}

var (
	hostsMu sync.Mutex
	hosts   = map[uintptr]*host{}
	classes = map[string]bool{}
)

func hinstance() uintptr { h, _, _ := procGetModuleHandleW.Call(0); return h }

func registerClass(name string) {
	if classes[name] {
		return
	}
	inst := hinstance()
	icon, _, _ := procLoadImageW.Call(inst, uintptr(unsafe.Pointer(u16("APP"))), 1, 0, 0, 0x00000040|0x00008000)
	cursor, _, _ := procLoadCursorW.Call(0, 32512)
	wc := wndClassEx{
		CbSize:    uint32(unsafe.Sizeof(wndClassEx{})),
		WndProc:   windows.NewCallback(wndProc),
		Instance:  inst,
		Icon:      icon,
		IconSm:    icon,
		Cursor:    cursor,
		ClassName: u16(name),
	}
	procRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))
	classes[name] = true
}

func hostOf(hwnd uintptr) *host {
	hostsMu.Lock()
	defer hostsMu.Unlock()
	return hosts[hwnd]
}

func wndProc(hwnd, msg, wp, lp uintptr) uintptr {
	h := hostOf(hwnd)
	if h != nil {
		switch msg {
		case wmMove, wmMoving:
			if h.wv != nil {
				_ = h.wv.NotifyParentWindowPositionChanged()
			}
		case wmSize:
			if h.wv != nil {
				if wp == sizeMinimized {
					// minimized: the page stops drawing (no animations, almost no CPU)
					if !h.hidden {
						h.hidden = true
						_ = h.wv.Hide()
					}
				} else {
					if h.hidden {
						h.hidden = false
						_ = h.wv.Show()
					}
					h.wv.Resize()
				}
			}
		case wmActivate:
			if wp&0xFFFF != 0 && h.wv != nil {
				h.wv.Focus()
			}
		case wmGetMinMaxInfo:
			mmi := (*minMaxInfo)(unsafe.Pointer(lp))
			if h.minW > 0 {
				mmi.MinTrackSize = point{h.minW, h.minH}
			}
		case wmCopyData:
			cds := (*copyDataStruct)(unsafe.Pointer(lp))
			if cds.DwData == 1 && cds.CbData > 0 && h.onCopy != nil {
				n := int(cds.CbData / 2)
				buf := unsafe.Slice((*uint16)(unsafe.Pointer(cds.LpData)), n)
				h.onCopy(h, strings.TrimRight(syscall.UTF16ToString(buf), "\x00"))
			}
			return 1
		case wmHotkey:
			if h.onHotkey != nil {
				h.onHotkey(h, wp)
			}
			return 0
		case wmClose:
			if h.onClose != nil && !h.onClose(h) {
				return 0
			}
			procDestroyWindow.Call(hwnd)
			return 0
		case wmDestroy:
			hostsMu.Lock()
			delete(hosts, hwnd)
			left := len(hosts)
			hostsMu.Unlock()
			if left == 0 {
				procPostQuitMessage.Call(0)
			}
			return 0
		}
	}
	r, _, _ := procDefWindowProcW.Call(hwnd, msg, wp, lp)
	return r
}

type hostOpts struct {
	class, title       string
	style, exStyle     uintptr
	x, y, w, h         int32
	bg                 [3]uint8
	initJS             string
	darkTitle          bool
	showCmd            uintptr
}

// newHost makes the window and puts WebView2 in it. ok=false when WebView2 isn't there.
func newHost(h *host, o hostOpts) bool {
	registerClass(o.class)
	hwnd, _, _ := procCreateWindowExW.Call(o.exStyle, uintptr(unsafe.Pointer(u16(o.class))),
		uintptr(unsafe.Pointer(u16(o.title))), o.style,
		uintptr(o.x), uintptr(o.y), uintptr(o.w), uintptr(o.h), 0, 0, hinstance(), 0)
	if hwnd == 0 {
		return false
	}
	h.hwnd = hwnd
	hostsMu.Lock()
	hosts[hwnd] = h
	hostsMu.Unlock()
	if o.darkTitle {
		on := int32(1)
		if r, _, _ := procDwmSetWindowAttribute.Call(hwnd, 20, uintptr(unsafe.Pointer(&on)), 4); r != 0 {
			procDwmSetWindowAttribute.Call(hwnd, 19, uintptr(unsafe.Pointer(&on)), 4) // older Windows 10
		}
		caption := uint32(o.bg[0]) | uint32(o.bg[1])<<8 | uint32(o.bg[2])<<16
		procDwmSetWindowAttribute.Call(hwnd, 35, uintptr(unsafe.Pointer(&caption)), 4) // Windows 11 only
	}
	procShowWindow.Call(hwnd, o.showCmd)
	procUpdateWindow.Call(hwnd)

	wv := edge.NewChromium()
	wv.DataPath = filepath.Join(h.dataDir, "webview")
	// only OVERDRIVE's own page is ever loaded in here: it may use the mic and the clipboard
	wv.SetGlobalPermission(edge.CoreWebView2PermissionStateAllow)
	wv.MessageCallback = func(s string) {
		if !strings.HasPrefix(s, "{") || h.onMessage == nil {
			return
		}
		var m map[string]any
		if json.Unmarshal([]byte(s), &m) == nil {
			if _, echo := m["_echo"]; !echo {
				h.onMessage(h, m)
			}
		}
	}
	if !wv.Embed(hwnd) {
		procDestroyWindow.Call(hwnd)
		return false
	}
	h.wv = wv
	if c := wv.GetController(); c != nil {
		if c2 := c.GetICoreWebView2Controller2(); c2 != nil {
			_ = c2.PutDefaultBackgroundColor(edge.COREWEBVIEW2_COLOR{A: 255, R: o.bg[0], G: o.bg[1], B: o.bg[2]})
		}
	}
	if s, err := wv.GetSettings(); err == nil {
		_ = s.PutAreDevToolsEnabled(os.Getenv("OVERDRIVE_DEVTOOLS") != "")
		_ = s.PutAreDefaultContextMenusEnabled(true) // copy / paste on right click
		_ = s.PutIsStatusBarEnabled(false)
		_ = s.PutIsSwipeNavigationEnabled(false)
	}
	wv.Init(`window.OD_HOST={kind:` + jsq(h.kind) + `,post:function(o){try{window.chrome.webview.postMessage(JSON.stringify(o));}catch(e){}}};` + o.initJS)
	wv.Resize()
	wv.Navigate(h.url)
	return true
}

func jsq(s string) string { b, _ := json.Marshal(s); return string(b) }

func (h *host) eval(js string) {
	if h.wv != nil {
		h.wv.Eval(js)
	}
}

// send runs window.OD_HOST_EVENT(obj) in the page.
func (h *host) send(m map[string]any) {
	b, _ := json.Marshal(m)
	h.eval("window.OD_HOST_EVENT&&window.OD_HOST_EVENT(" + string(b) + ")")
}

func runLoop() {
	var m msgT
	for {
		r, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if r == 0 || int32(r) == -1 {
			return
		}
		procTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
		procDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
	}
}

func bringBack(hwnd uintptr) {
	procAllowSetForegroundWindow.Call(^uintptr(0)) // ASFW_ANY
	if r, _, _ := procIsIconic.Call(hwnd); r != 0 {
		procShowWindow.Call(hwnd, swRestore)
	} else {
		procShowWindow.Call(hwnd, swShow)
	}
	procSetForegroundWindow.Call(hwnd)
}

func sendCopy(hwnd uintptr, s string) {
	p, _ := syscall.UTF16FromString(s)
	cds := copyDataStruct{DwData: 1, CbData: uint32(len(p) * 2), LpData: uintptr(unsafe.Pointer(&p[0]))}
	procSendMessageW.Call(hwnd, wmCopyData, 0, uintptr(unsafe.Pointer(&cds)))
}

func shellOpen(target string) {
	procShellExecuteW.Call(0, uintptr(unsafe.Pointer(u16("open"))), uintptr(unsafe.Pointer(u16(target))), 0, 0, swShowNormal)
}

// safeLink: only web pages and Windows settings pages may be opened from the window.
func safeLink(u string) bool {
	l := strings.ToLower(u)
	return strings.HasPrefix(l, "https://") || strings.HasPrefix(l, "http://") || strings.HasPrefix(l, "ms-settings:")
}

func singleInstance(name string) bool {
	_, _, err := procCreateMutexW.Call(0, 0, uintptr(unsafe.Pointer(u16(name))))
	return err != windows.Errno(errAlreadyExists)
}

func noWebView2(url string) int {
	messageBox("OVERDRIVE", "This PC is missing Microsoft's WebView2 (the part Windows apps use to draw their windows).\n\n"+
		"OVERDRIVE opens in your browser for now. To get its own window back, install WebView2 from:\n"+
		"https://go.microsoft.com/fwlink/p/?LinkId=2124703")
	shellOpen(url)
	return 3
}

// ------------------------------------------------------------------ the main OVERDRIVE window

type place struct {
	X, Y, W, H int32
	Max        bool
}

func loadPlace(dir string) *place {
	b, err := os.ReadFile(filepath.Join(dir, "window-place.json"))
	if err != nil {
		return nil
	}
	var p place
	if json.Unmarshal(b, &p) != nil || p.W < 400 || p.H < 300 {
		return nil
	}
	r := rect{p.X, p.Y, p.X + p.W, p.Y + p.H}
	if m, _, _ := procMonitorFromRect.Call(uintptr(unsafe.Pointer(&r)), monDefaultNull); m == 0 {
		return nil // that screen isn't there anymore
	}
	return &p
}

func savePlace(dir string, hwnd uintptr) {
	if r, _, _ := procIsIconic.Call(hwnd); r != 0 {
		return
	}
	var wr rect
	procGetWindowRect.Call(hwnd, uintptr(unsafe.Pointer(&wr)))
	z, _, _ := procIsZoomed.Call(hwnd)
	p := place{X: wr.Left, Y: wr.Top, W: wr.Right - wr.Left, H: wr.Bottom - wr.Top, Max: z != 0}
	if p.Max {
		if old := loadPlace(dir); old != nil {
			p.X, p.Y, p.W, p.H = old.X, old.Y, old.W, old.H
		}
	}
	b, _ := json.Marshal(p)
	_ = os.MkdirAll(dir, 0o755)
	_ = os.WriteFile(filepath.Join(dir, "window-place.json"), b, 0o644)
}

const appClass = "OverdriveWindow"

func runAppWindow(url, dataDir string) int {
	if dataDir == "" {
		dataDir = filepath.Join(os.Getenv("LOCALAPPDATA"), "OVERDRIVE")
	}
	if !singleInstance("Local\\OVERDRIVE.Window") {
		if hw, _, _ := procFindWindowW.Call(uintptr(unsafe.Pointer(u16(appClass))), 0); hw != 0 {
			sendCopy(hw, url) // the new address (OVERDRIVE may have restarted with a new key)
			bringBack(hw)
			return 0
		}
	}
	windows.CoInitializeEx(0, windows.COINIT_APARTMENTTHREADED)
	sw, _, _ := procGetSystemMetrics.Call(smCxScreen)
	sh, _, _ := procGetSystemMetrics.Call(smCyScreen)
	w, hgt := int32(1320), int32(880)
	if int32(sw) < w+40 {
		w = int32(sw) - 40
	}
	if int32(sh) < hgt+80 {
		hgt = int32(sh) - 80
	}
	o := hostOpts{class: appClass, title: "OVERDRIVE", style: wsOverlappedWin, x: (int32(sw) - w) / 2, y: (int32(sh) - hgt) / 2,
		w: w, h: hgt, bg: [3]uint8{14, 15, 19}, darkTitle: true, showCmd: swShowNormal}
	p := loadPlace(dataDir)
	if p != nil {
		o.x, o.y, o.w, o.h = p.X, p.Y, p.W, p.H
		if p.Max {
			o.showCmd = swMaximize
		}
	}
	h := &host{kind: "app", dataDir: dataDir, url: url, minW: 760, minH: 520}
	full := false
	var oldStyle uintptr
	var oldRect rect
	h.onCopy = func(h *host, s string) {
		if s != "" && s != h.url && strings.HasPrefix(s, "http://127.0.0.1:") {
			h.url = s
			h.wv.Navigate(s)
		}
	}
	h.onClose = func(h *host) bool { savePlace(dataDir, h.hwnd); return true }
	h.onMessage = func(h *host, m map[string]any) {
		cmd, _ := m["cmd"].(string)
		switch cmd {
		case "open":
			if u, _ := m["url"].(string); safeLink(u) {
				shellOpen(u)
			}
		case "title":
			if t, _ := m["text"].(string); t != "" {
				procSetWindowTextW.Call(h.hwnd, uintptr(unsafe.Pointer(u16(t))))
			}
		case "flash":
			if fg, _, _ := procGetForegroundWindow.Call(); fg != h.hwnd {
				fi := flashInfo{CbSize: uint32(unsafe.Sizeof(flashInfo{})), Hwnd: h.hwnd, Flags: 0x3 | 0xC, Count: 0}
				procFlashWindowEx.Call(uintptr(unsafe.Pointer(&fi)))
			}
		case "front":
			bringBack(h.hwnd)
		case "minimize":
			procShowWindow.Call(h.hwnd, swMinimize)
		case "fullscreen":
			full = !full
			if full {
				oldStyle, _, _ = procGetWindowLongPtrW.Call(h.hwnd, gwlStyleU)
				procGetWindowRect.Call(h.hwnd, uintptr(unsafe.Pointer(&oldRect)))
				mon, _, _ := procMonitorFromWindow.Call(h.hwnd, monDefaultNear)
				mi := monitorInfo{CbSize: uint32(unsafe.Sizeof(monitorInfo{}))}
				procGetMonitorInfoW.Call(mon, uintptr(unsafe.Pointer(&mi)))
				procSetWindowLongPtrW.Call(h.hwnd, gwlStyleU, (oldStyle&^wsOverlappedWin)|wsPopup|wsVisible)
				procSetWindowPos.Call(h.hwnd, 0, uintptr(mi.Monitor.Left), uintptr(mi.Monitor.Top),
					uintptr(mi.Monitor.Right-mi.Monitor.Left), uintptr(mi.Monitor.Bottom-mi.Monitor.Top), swpFrameChanged|swpShowWindow)
			} else {
				procSetWindowLongPtrW.Call(h.hwnd, gwlStyleU, oldStyle)
				procSetWindowPos.Call(h.hwnd, 0, uintptr(oldRect.Left), uintptr(oldRect.Top),
					uintptr(oldRect.Right-oldRect.Left), uintptr(oldRect.Bottom-oldRect.Top), swpFrameChanged|swpShowWindow)
			}
			h.send(map[string]any{"type": "fullscreen", "on": full})
		}
	}
	if !newHost(h, o) {
		return noWebView2(url)
	}
	runLoop()
	return 0
}
