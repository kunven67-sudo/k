//go:build windows

package main

// win_tray.go = the icon by the clock + Windows notifications. Pure Win32, no keyboard hooks.

import (
	"runtime"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	user32                  = windows.NewLazySystemDLL("user32.dll")
	shell32                 = windows.NewLazySystemDLL("shell32.dll")
	procRegisterClassExW    = user32.NewProc("RegisterClassExW")
	procCreateWindowExW     = user32.NewProc("CreateWindowExW")
	procDefWindowProcW      = user32.NewProc("DefWindowProcW")
	procGetMessageW         = user32.NewProc("GetMessageW")
	procTranslateMessage    = user32.NewProc("TranslateMessage")
	procDispatchMessageW    = user32.NewProc("DispatchMessageW")
	procPostMessageW        = user32.NewProc("PostMessageW")
	procPostQuitMessage     = user32.NewProc("PostQuitMessage")
	procDestroyWindow       = user32.NewProc("DestroyWindow")
	procLoadImageW          = user32.NewProc("LoadImageW")
	procGetSystemMetrics    = user32.NewProc("GetSystemMetrics")
	procCreatePopupMenu     = user32.NewProc("CreatePopupMenu")
	procAppendMenuW         = user32.NewProc("AppendMenuW")
	procTrackPopupMenu      = user32.NewProc("TrackPopupMenu")
	procDestroyMenu         = user32.NewProc("DestroyMenu")
	procSetForegroundWindow = user32.NewProc("SetForegroundWindow")
	procGetCursorPos        = user32.NewProc("GetCursorPos")
	procRegisterWindowMsg   = user32.NewProc("RegisterWindowMessageW")
	procShellNotifyIconW    = shell32.NewProc("Shell_NotifyIconW")
	procSetMenuDefaultItem  = user32.NewProc("SetMenuDefaultItem")
)

const (
	wmDestroy     = 0x0002
	wmClose       = 0x0010
	wmCommand     = 0x0111
	wmContextMenu = 0x007B
	wmLButtonUp   = 0x0202
	wmLButtonDbl  = 0x0203
	wmUser        = 0x0400
	wmApp         = 0x8000
	wmTray        = wmApp + 1
	wmTrayUpdate  = wmApp + 2
	ninSelect     = wmUser + 0
	ninKeySelect  = wmUser + 1
	ninBalloonClk = wmUser + 5
)

type wndClassEx struct {
	Size       uint32
	Style      uint32
	WndProc    uintptr
	ClsExtra   int32
	WndExtra   int32
	Instance   windows.Handle
	Icon       windows.Handle
	Cursor     windows.Handle
	Background windows.Handle
	MenuName   *uint16
	ClassName  *uint16
	IconSm     windows.Handle
}

type msgT struct {
	Hwnd    uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      struct{ X, Y int32 }
	_       uint32
}

type notifyIconData struct {
	Size            uint32
	Wnd             uintptr
	ID              uint32
	Flags           uint32
	CallbackMessage uint32
	Icon            uintptr
	Tip             [128]uint16
	State           uint32
	StateMask       uint32
	Info            [256]uint16
	Version         uint32
	InfoTitle       [64]uint16
	InfoFlags       uint32
	GUIDItem        windows.GUID
	BalloonIcon     uintptr
}

func hinstance() windows.Handle {
	var h windows.Handle
	windows.GetModuleHandleEx(0, nil, &h)
	return h
}

// loadIcon loads icon resource #id at a size (0 = small icon size).
func loadIcon(id int, size int) uintptr {
	if size == 0 {
		size = sysMetric(49) // SM_CXSMICON
	}
	h, _, _ := procLoadImageW.Call(uintptr(hinstance()), uintptr(id), 1 /*IMAGE_ICON*/, uintptr(size), uintptr(size), 0)
	return h
}

func sysMetric(i int) int {
	r, _, _ := procGetSystemMetrics.Call(uintptr(i))
	return int(r)
}

func copyUTF16(dst []uint16, s string) {
	u, _ := windows.UTF16FromString(s)
	if len(u) > len(dst) {
		u = u[:len(dst)]
		u[len(u)-1] = 0
	}
	copy(dst, u)
}

type tray struct {
	hwnd    uintptr
	mu      sync.Mutex
	level   string
	tip     string
	notes   [][2]string
	onOpen  func()
	onFix   func()
	onQuit  func()
	created uint32
	ready   chan struct{}
	icons   map[string]uintptr
	big     uintptr
}

var theTray *tray

const (
	cmdOpen = 1
	cmdFix  = 2
	cmdQuit = 3
)

func trayWndProc(hwnd, msg, wp, lp uintptr) uintptr {
	t := theTray
	switch uint32(msg) {
	case wmTray:
		switch uint32(lp & 0xFFFF) {
		case ninSelect, ninKeySelect, wmLButtonUp, ninBalloonClk:
			if t.onOpen != nil {
				go t.onOpen()
			}
		case wmContextMenu:
			t.menu()
		}
		return 0
	case wmTrayUpdate:
		t.apply()
		return 0
	case wmDestroy:
		t.remove()
		procPostQuitMessage.Call(0)
		return 0
	}
	if t != nil && t.created != 0 && uint32(msg) == t.created { // Explorer restarted: icon is gone, add it back
		t.add()
		return 0
	}
	r, _, _ := procDefWindowProcW.Call(hwnd, msg, wp, lp)
	return r
}

func (t *tray) nid() notifyIconData {
	var d notifyIconData
	d.Size = uint32(unsafe.Sizeof(d))
	d.Wnd = t.hwnd
	d.ID = 1
	return d
}

func (t *tray) add() {
	d := t.nid()
	d.Flags = 0x1 | 0x2 | 0x4 | 0x80 // MESSAGE | ICON | TIP | SHOWTIP
	d.CallbackMessage = wmTray
	t.mu.Lock()
	d.Icon = t.icons[t.level]
	copyUTF16(d.Tip[:], t.tip)
	t.mu.Unlock()
	procShellNotifyIconW.Call(0 /*NIM_ADD*/, uintptr(unsafe.Pointer(&d)))
	d.Version = 4
	procShellNotifyIconW.Call(4 /*NIM_SETVERSION*/, uintptr(unsafe.Pointer(&d)))
}

func (t *tray) remove() {
	d := t.nid()
	procShellNotifyIconW.Call(2 /*NIM_DELETE*/, uintptr(unsafe.Pointer(&d)))
}

// apply = icon/tip + queued notifications (runs on the tray thread).
func (t *tray) apply() {
	t.mu.Lock()
	d := t.nid()
	d.Flags = 0x2 | 0x4 | 0x80
	d.Icon = t.icons[t.level]
	copyUTF16(d.Tip[:], t.tip)
	notes := t.notes
	t.notes = nil
	t.mu.Unlock()
	procShellNotifyIconW.Call(1 /*NIM_MODIFY*/, uintptr(unsafe.Pointer(&d)))
	for _, n := range notes {
		b := t.nid()
		b.Flags = 0x10 // INFO
		copyUTF16(b.InfoTitle[:], n[0])
		copyUTF16(b.Info[:], n[1])
		b.InfoFlags = 0x4 | 0x20 // USER icon, LARGE
		b.BalloonIcon = t.big
		procShellNotifyIconW.Call(1, uintptr(unsafe.Pointer(&b)))
	}
}

func (t *tray) menu() {
	m, _, _ := procCreatePopupMenu.Call()
	add := func(id int, s string) {
		p, _ := windows.UTF16PtrFromString(s)
		procAppendMenuW.Call(m, 0, uintptr(id), uintptr(unsafe.Pointer(p)))
	}
	add(cmdOpen, "Open SOUNDGUARD")
	add(cmdFix, "Fix now")
	procAppendMenuW.Call(m, 0x800 /*MF_SEPARATOR*/, 0, 0)
	add(cmdQuit, "Quit (until next restart)")
	procSetMenuDefaultItem.Call(m, cmdOpen, 0)
	var pt struct{ X, Y int32 }
	procGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))
	procSetForegroundWindow.Call(t.hwnd)
	cmd, _, _ := procTrackPopupMenu.Call(m, 0x0100|0x0002|0x0020 /*RETURNCMD|RIGHTBUTTON|BOTTOMALIGN*/, uintptr(pt.X), uintptr(pt.Y), 0, t.hwnd, 0)
	procPostMessageW.Call(t.hwnd, 0, 0, 0)
	procDestroyMenu.Call(m)
	switch cmd {
	case cmdOpen:
		if t.onOpen != nil {
			go t.onOpen()
		}
	case cmdFix:
		if t.onFix != nil {
			go t.onFix()
		}
	case cmdQuit:
		if t.onQuit != nil {
			go t.onQuit()
		}
	}
}

// runTray blocks: creates the icon and pumps messages until quit.
func (t *tray) run() {
	runtime.LockOSThread()
	theTray = t
	t.icons = map[string]uintptr{"ok": loadIcon(2, 0), "warn": loadIcon(3, 0), "bad": loadIcon(4, 0)}
	t.big = loadIcon(1, 64)
	if t.level == "" {
		t.level = "ok"
	}
	cls, _ := windows.UTF16PtrFromString("SoundGuardTray")
	wc := wndClassEx{WndProc: windows.NewCallback(trayWndProc), Instance: hinstance(), ClassName: cls}
	wc.Size = uint32(unsafe.Sizeof(wc))
	procRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))
	name, _ := windows.UTF16PtrFromString("SOUNDGUARD")
	t.hwnd, _, _ = procCreateWindowExW.Call(0, uintptr(unsafe.Pointer(cls)), uintptr(unsafe.Pointer(name)), 0, 0, 0, 0, 0, 0, 0, uintptr(hinstance()), 0)
	tc, _ := windows.UTF16PtrFromString("TaskbarCreated")
	r, _, _ := procRegisterWindowMsg.Call(uintptr(unsafe.Pointer(tc)))
	t.created = uint32(r)
	t.add()
	close(t.ready)
	var m msgT
	for {
		r, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if int32(r) <= 0 {
			return
		}
		procTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
		procDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
	}
}

func (t *tray) quit() { procPostMessageW.Call(t.hwnd, wmClose, 0, 0) }

// ---- UIHooks for the Guardian (safe from any goroutine) ----

var trayTips = map[string]string{"ok": "SOUNDGUARD: all good", "warn": "SOUNDGUARD: heads up", "bad": "SOUNDGUARD: needs you"}

func (t *tray) Tray(level string) {
	t.mu.Lock()
	if level == t.level && t.tip != "" {
		t.mu.Unlock()
		return
	}
	t.level = level
	t.tip = trayTips[level]
	t.mu.Unlock()
	if t.hwnd != 0 {
		procPostMessageW.Call(t.hwnd, wmTrayUpdate, 0, 0)
	}
}

func (t *tray) Notify(title, body string) {
	t.mu.Lock()
	t.notes = append(t.notes, [2]string{title, body})
	t.mu.Unlock()
	if t.hwnd != 0 {
		procPostMessageW.Call(t.hwnd, wmTrayUpdate, 0, 0)
	}
}
