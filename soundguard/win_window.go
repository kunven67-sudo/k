//go:build windows

package main

// win_window.go = the SOUNDGUARD window (WebView2 inside our own Win32 window).
// Main window: dark title bar that matches the app. Popup: small card above the clock
// that never steals focus from what you're doing.

import (
	"os"
	"runtime"
	"unsafe"

	"github.com/jchv/go-webview2/pkg/edge"
	"golang.org/x/sys/windows"
)

var (
	dwmapi                   = windows.NewLazySystemDLL("dwmapi.dll")
	procDwmSetWindowAttr     = dwmapi.NewProc("DwmSetWindowAttribute")
	procShowWindow           = user32.NewProc("ShowWindow")
	procSetWindowPos         = user32.NewProc("SetWindowPos")
	procGetDpiForSystem      = user32.NewProc("GetDpiForSystem")
	procSystemParametersInfo = user32.NewProc("SystemParametersInfoW")
	procFindWindowW          = user32.NewProc("FindWindowW")
	procIsIconic             = user32.NewProc("IsIconic")
	procAllowSetFg           = user32.NewProc("AllowSetForegroundWindow")
	procGetClientRect        = user32.NewProc("GetClientRect")
	procCreateSolidBrush     = windows.NewLazySystemDLL("gdi32.dll").NewProc("CreateSolidBrush")
	procBringWindowToTop     = user32.NewProc("BringWindowToTop")
)

const (
	classMain          = "SoundGuardWindow"
	classPopup         = "SoundGuardPopup"
	wmSize             = 0x0005
	wmActivate         = 0x0006
	wmMove             = 0x0003
	wmGetMinMax        = 0x0024
	wsOverlappedWindow = 0x00CF0000
	wsPopup            = 0x80000000
	wsClipChildren     = 0x02000000
	wsExToolWindow     = 0x00000080
	wsExTopmost        = 0x00000008
	wsExNoActivate     = 0x08000000
)

type rect struct{ L, T, R, B int32 }

type winHost struct {
	hwnd  uintptr
	wv    *edge.Chromium
	minW  int32
	minH  int32
	popup bool
	shown bool
}

var theHost *winHost

func hostWndProc(hwnd, msg, wp, lp uintptr) uintptr {
	h := theHost
	if h != nil && h.hwnd == hwnd {
		switch uint32(msg) {
		case wmSize:
			if h.wv != nil {
				h.wv.Resize()
			}
		case wmMove:
			if h.wv != nil {
				h.wv.NotifyParentWindowPositionChanged()
			}
		case wmActivate:
			if wp&0xFFFF != 0 && h.wv != nil && !h.popup {
				h.wv.Focus()
			}
		case wmGetMinMax:
			mm := (*[10]int32)(unsafe.Pointer(lp)) // MINMAXINFO: ptMinTrackSize at index 6,7
			mm[6], mm[7] = h.minW, h.minH
			return 0
		case wmClose:
			procDestroyWindow.Call(hwnd)
			return 0
		case wmDestroy:
			procPostQuitMessage.Call(0)
			return 0
		}
	}
	r, _, _ := procDefWindowProcW.Call(hwnd, msg, wp, lp)
	return r
}

func dpiScale() float64 {
	if procGetDpiForSystem.Find() == nil {
		r, _, _ := procGetDpiForSystem.Call()
		if r > 0 {
			return float64(r) / 96
		}
	}
	return 1
}

func workArea() rect {
	var r rect
	procSystemParametersInfo.Call(0x0030 /*SPI_GETWORKAREA*/, 0, uintptr(unsafe.Pointer(&r)), 0)
	if r.R == 0 {
		r = rect{0, 0, int32(sysMetric(0)), int32(sysMetric(1))}
	}
	return r
}

func dwmInt(hwnd uintptr, attr int, v uint32) {
	procDwmSetWindowAttr.Call(hwnd, uintptr(attr), uintptr(unsafe.Pointer(&v)), 4)
}

// runWindow shows one window and returns when it closes. kind: "main" or "popup".
func runWindow(kind, url, dataDir string) int {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	procCoInitializeEx.Call(0, coinitApartmentThreaded)
	s := dpiScale()
	h := &winHost{popup: kind == "popup"}
	theHost = h
	clsName := classMain
	if h.popup {
		clsName = classPopup
	}
	cls, _ := windows.UTF16PtrFromString(clsName)
	brush, _, _ := procCreateSolidBrush.Call(0x000D0A08) // #080a0d (BGR)
	wc := wndClassEx{WndProc: windows.NewCallback(hostWndProc), Instance: hinstance(), ClassName: cls, Background: windows.Handle(brush),
		Icon: windows.Handle(loadIcon(1, sysMetric(11))), IconSm: windows.Handle(loadIcon(1, 0))}
	wc.Size = uint32(unsafe.Sizeof(wc))
	wc.Cursor = windows.Handle(loadCursor())
	procRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))
	title, _ := windows.UTF16PtrFromString("SOUNDGUARD")
	wa := workArea()
	var x, y, w, ht int32
	var style, ex uintptr
	if h.popup {
		w, ht = int32(440*s), int32(196*s)
		x, y = wa.R-w-int32(14*s), wa.B-ht-int32(14*s)
		style, ex = wsPopup|wsClipChildren, wsExToolWindow|wsExTopmost|wsExNoActivate
	} else {
		w, ht = int32(1180*s), int32(780*s)
		if aw := wa.R - wa.L; w > aw-40 {
			w = aw - 40
		}
		if ah := wa.B - wa.T; ht > ah-40 {
			ht = ah - 40
		}
		x, y = wa.L+(wa.R-wa.L-w)/2, wa.T+(wa.B-wa.T-ht)/2
		style = wsOverlappedWindow | wsClipChildren
		h.minW, h.minH = int32(760*s), int32(560*s)
	}
	h.hwnd, _, _ = procCreateWindowExW.Call(ex, uintptr(unsafe.Pointer(cls)), uintptr(unsafe.Pointer(title)), style,
		uintptr(x), uintptr(y), uintptr(w), uintptr(ht), 0, 0, uintptr(hinstance()), 0)
	if h.hwnd == 0 {
		return 2
	}
	dwmInt(h.hwnd, 20, 1)          // dark mode title bar
	dwmInt(h.hwnd, 35, 0x000D0A08) // caption color = app background
	dwmInt(h.hwnd, 34, 0x002B221B) // border color
	dwmInt(h.hwnd, 33, 2)          // round corners
	if !h.popup {
		procShowWindow.Call(h.hwnd, 5) // SW_SHOW: dark window right away, page fades in
		procSetForegroundWindow.Call(h.hwnd)
	}

	wv := edge.NewChromium()
	wv.DataPath = dataDir
	wv.MessageCallback = func(m string) {
		switch m {
		case "close":
			procPostMessageW.Call(h.hwnd, wmClose, 0, 0)
		case "ready":
			if h.popup && !h.shown {
				h.shown = true
				procShowWindow.Call(h.hwnd, 4) // SW_SHOWNOACTIVATE
				procSetWindowPos.Call(h.hwnd, ^uintptr(0) /*HWND_TOPMOST*/, 0, 0, 0, 0, 0x0001|0x0002|0x0010 /*NOSIZE|NOMOVE|NOACTIVATE*/)
			}
		}
	}
	if !wv.Embed(h.hwnd) {
		logf("WebView2 didn't start")
		msgBox("SOUNDGUARD needs Microsoft Edge WebView2 (it comes with Windows 11). Run Windows Update, then open SOUNDGUARD again.\n\nSOUNDGUARD keeps fixing your sound in the background anyway.")
		return 3
	}
	h.wv = wv
	if c := wv.GetController(); c != nil {
		if c2 := c.GetICoreWebView2Controller2(); c2 != nil {
			c2.PutDefaultBackgroundColor(edge.COREWEBVIEW2_COLOR{A: 255, R: 0x08, G: 0x0A, B: 0x0D})
		}
	}
	if st, err := wv.GetSettings(); err == nil {
		st.PutAreDefaultContextMenusEnabled(os.Getenv("SG_DEBUG") != "")
		st.PutAreDevToolsEnabled(os.Getenv("SG_DEBUG") != "")
		st.PutIsZoomControlEnabled(false)
		st.PutIsStatusBarEnabled(false)
		st.PutAreBrowserAcceleratorKeysEnabled(os.Getenv("SG_DEBUG") != "")
	}
	wv.Resize()
	wv.Navigate(url)
	if !h.popup {
		wv.Focus()
	}
	var m msgT
	for {
		r, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if int32(r) <= 0 {
			break
		}
		procTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
		procDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
	}
	return 0
}

var procLoadCursorW = user32.NewProc("LoadCursorW")

func loadCursor() uintptr {
	r, _, _ := procLoadCursorW.Call(0, 32512 /*IDC_ARROW*/)
	return r
}

var procMessageBoxW = user32.NewProc("MessageBoxW")

func msgBox(text string) {
	t, _ := windows.UTF16PtrFromString(text)
	c, _ := windows.UTF16PtrFromString("SOUNDGUARD")
	procMessageBoxW.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), 0x40|0x10000 /*ICONINFO|SETFOREGROUND*/)
}

// focusMain brings an open SOUNDGUARD window to the front. false = none open.
func focusMain() bool {
	cls, _ := windows.UTF16PtrFromString(classMain)
	hw, _, _ := procFindWindowW.Call(uintptr(unsafe.Pointer(cls)), 0)
	if hw == 0 {
		return false
	}
	if r, _, _ := procIsIconic.Call(hw); r != 0 {
		procShowWindow.Call(hw, 9) // SW_RESTORE
	}
	procBringWindowToTop.Call(hw)
	procSetForegroundWindow.Call(hw)
	return true
}
