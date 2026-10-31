//go:build windows

package main

import (
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	user32   = windows.NewLazySystemDLL("user32.dll")
	kernel32 = windows.NewLazySystemDLL("kernel32.dll")
	gdi32    = windows.NewLazySystemDLL("gdi32.dll")
	ole32    = windows.NewLazySystemDLL("ole32.dll")
	shell32  = windows.NewLazySystemDLL("shell32.dll")
	dwmapi   = windows.NewLazySystemDLL("dwmapi.dll")

	pRegisterClassExW      = user32.NewProc("RegisterClassExW")
	pCreateWindowExW       = user32.NewProc("CreateWindowExW")
	pDefWindowProcW        = user32.NewProc("DefWindowProcW")
	pDestroyWindow         = user32.NewProc("DestroyWindow")
	pShowWindow            = user32.NewProc("ShowWindow")
	pGetMessageW           = user32.NewProc("GetMessageW")
	pTranslateMessage      = user32.NewProc("TranslateMessage")
	pDispatchMessageW      = user32.NewProc("DispatchMessageW")
	pPostMessageW          = user32.NewProc("PostMessageW")
	pPostQuitMessage       = user32.NewProc("PostQuitMessage")
	pSetWindowPos          = user32.NewProc("SetWindowPos")
	pMoveWindow            = user32.NewProc("MoveWindow")
	pGetClientRect         = user32.NewProc("GetClientRect")
	pLoadCursorW           = user32.NewProc("LoadCursorW")
	pLoadImageW            = user32.NewProc("LoadImageW")
	pSetWindowTextW        = user32.NewProc("SetWindowTextW")
	pGetDpiForWindow       = user32.NewProc("GetDpiForWindow")
	pGetAsyncKeyState      = user32.NewProc("GetAsyncKeyState")
	pGetSystemMetrics      = user32.NewProc("GetSystemMetrics")
	pFindWindowW           = user32.NewProc("FindWindowW")
	pSetForegroundWindow   = user32.NewProc("SetForegroundWindow")
	pIsIconic              = user32.NewProc("IsIconic")
	pMessageBoxW           = user32.NewProc("MessageBoxW")
	pGetWindowPlacement    = user32.NewProc("GetWindowPlacement")
	pSetWindowPlacement    = user32.NewProc("SetWindowPlacement")
	pSystemParametersInfoW = user32.NewProc("SystemParametersInfoW")
	pMonitorFromRect       = user32.NewProc("MonitorFromRect")
	pSetProcessDpiAwareCtx = user32.NewProc("SetProcessDpiAwarenessContext")
	pCreateMutexW          = kernel32.NewProc("CreateMutexW")
	pGetModuleHandleW      = kernel32.NewProc("GetModuleHandleW")
	pCreateSolidBrush      = gdi32.NewProc("CreateSolidBrush")
	pCoInitializeEx        = ole32.NewProc("CoInitializeEx")
	pCoTaskMemFree         = ole32.NewProc("CoTaskMemFree")
	pShellExecuteW         = shell32.NewProc("ShellExecuteW")
	pDwmSetWindowAttribute = dwmapi.NewProc("DwmSetWindowAttribute")
)

const (
	wmDestroy        = 0x0002
	wmMove           = 0x0003
	wmSize           = 0x0005
	wmSetFocus       = 0x0007
	wmClose          = 0x0010
	wmGetMinMaxInfo  = 0x0024
	wmDPIChanged     = 0x02E0
	wmApp            = 0x8000
	sizeMinimized    = 1
	wsOverlappedWin  = 0x00CF0000
	wsChild          = 0x40000000
	wsVisible        = 0x10000000
	wsClipChildren   = 0x02000000
	wsClipSiblings   = 0x04000000
	cwUseDefault     = 0x80000000
	swHide           = 0
	swShowNormal     = 1
	swShowMaximized  = 3
	swRestore        = 9
	swpNoSize        = 0x0001
	swpNoMove        = 0x0002
	swpNoZOrder      = 0x0004
	swpNoActivate    = 0x0010
	spiGetWorkArea   = 0x0030
	idcArrow         = 32512
	imageIcon        = 1
	lrDefaultSize    = 0x0040
	lrShared         = 0x8000
	mbOK             = 0x0000
	mbOKCancel       = 0x0001
	mbIconError      = 0x0010
	idOK             = 1
	vkTab            = 0x09
	vkShift          = 0x10
	vkControl        = 0x11
	vkMenu           = 0x12
	vkLeft           = 0x25
	vkRight          = 0x27
	vkF5             = 0x74
	vkF12            = 0x7B
	vkBrowserBack    = 0xA6
	vkBrowserForward = 0xA7
)

type point struct{ X, Y int32 }

type rect struct{ L, T, R, B int32 }

type msg struct {
	Hwnd    uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      point
	Private uint32
}

type wndClassEx struct {
	Size       uint32
	Style      uint32
	WndProc    uintptr
	ClsExtra   int32
	WndExtra   int32
	Instance   uintptr
	Icon       uintptr
	Cursor     uintptr
	Background uintptr
	MenuName   *uint16
	ClassName  *uint16
	IconSm     uintptr
}

type windowPlacement struct {
	Length  uint32
	Flags   uint32
	ShowCmd uint32
	MinPos  point
	MaxPos  point
	Normal  rect
}

type minMaxInfo struct {
	Reserved, MaxSize, MaxPosition, MinTrackSize, MaxTrackSize point
}

func u16(s string) *uint16 {
	p, err := windows.UTF16PtrFromString(s)
	if err != nil {
		p, _ = windows.UTF16PtrFromString("")
	}
	return p
}

func dpiOf(h uintptr) int32 {
	if h != 0 && pGetDpiForWindow.Find() == nil {
		if d, _, _ := pGetDpiForWindow.Call(h); d != 0 {
			return int32(d)
		}
	}
	return 96
}

// keyDown reads the real key right now. (The keys are typed into the page's window, which
// belongs to the WebView2 process, so this thread's own key state can be out of date.)
func keyDown(vk uintptr) bool {
	r, _, _ := pGetAsyncKeyState.Call(vk)
	return r&0x8000 != 0
}

func sysMetric(i uintptr) int32 {
	r, _, _ := pGetSystemMetrics.Call(i)
	return int32(r)
}

func msgBox(text string, flags uintptr) uintptr {
	r, _, _ := pMessageBoxW.Call(0, uintptr(unsafe.Pointer(u16(text))), uintptr(unsafe.Pointer(u16("ALTS"))), flags)
	return r
}

// shellOpen opens a web link in the PC's normal browser.
func shellOpen(link string) {
	pShellExecuteW.Call(0, uintptr(unsafe.Pointer(u16("open"))), uintptr(unsafe.Pointer(u16(link))), 0, 0, swShowNormal)
}

// darkTitle makes the title bar dark to match the side list (Windows 10/11; ignored on older builds).
func darkTitle(h uintptr) {
	if pDwmSetWindowAttribute.Find() != nil {
		return
	}
	on := int32(1)
	pDwmSetWindowAttribute.Call(h, 20, uintptr(unsafe.Pointer(&on)), 4) // dark mode
	bar := uint32(0x00161313)                                           // #131316, written as 0x00BBGGRR
	pDwmSetWindowAttribute.Call(h, 35, uintptr(unsafe.Pointer(&bar)), 4)
	pDwmSetWindowAttribute.Call(h, 34, uintptr(unsafe.Pointer(&bar)), 4)
	text := uint32(0x00f1ecec)
	pDwmSetWindowAttribute.Call(h, 36, uintptr(unsafe.Pointer(&text)), 4)
}

// comCall calls method number idx of a COM object (its vtable index, counting IUnknown's 3).
//
//go:uintptrescapes
func comCall(obj unsafe.Pointer, idx int, args ...uintptr) uintptr {
	if obj == nil {
		return 0x80004003 // E_POINTER
	}
	vt := *(*unsafe.Pointer)(obj)
	fn := *(*uintptr)(unsafe.Add(vt, uintptr(idx)*unsafe.Sizeof(uintptr(0))))
	all := append([]uintptr{uintptr(obj)}, args...)
	r, _, _ := syscall.SyscallN(fn, all...)
	return r
}

// runVisible runs a program in its own console window that you can see and type into, and waits
// for it. (Go's exec would send the window's text into nowhere, so it looks blank.)
func runVisible(cmdline string) error {
	var si windows.StartupInfo
	si.Cb = uint32(unsafe.Sizeof(si))
	var pi windows.ProcessInformation
	if err := windows.CreateProcess(nil, u16(cmdline), nil, nil, false, windows.CREATE_NEW_CONSOLE, nil, nil, &si, &pi); err != nil {
		return err
	}
	defer windows.CloseHandle(pi.Thread)
	defer windows.CloseHandle(pi.Process)
	windows.WaitForSingleObject(pi.Process, windows.INFINITE)
	return nil
}
