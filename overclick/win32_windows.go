//go:build windows

package main

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	user32   = windows.NewLazySystemDLL("user32.dll")
	gdi32    = windows.NewLazySystemDLL("gdi32.dll")
	dwmapi   = windows.NewLazySystemDLL("dwmapi.dll")
	kernel32 = windows.NewLazySystemDLL("kernel32.dll")

	pSendInput                  = user32.NewProc("SendInput")
	pGetCursorPos               = user32.NewProc("GetCursorPos")
	pWindowFromPoint            = user32.NewProc("WindowFromPoint")
	pGetAncestor                = user32.NewProc("GetAncestor")
	pGetSystemMetrics           = user32.NewProc("GetSystemMetrics")
	pRegisterHotKey             = user32.NewProc("RegisterHotKey")
	pUnregisterHotKey           = user32.NewProc("UnregisterHotKey")
	pRegisterClassExW           = user32.NewProc("RegisterClassExW")
	pCreateWindowExW            = user32.NewProc("CreateWindowExW")
	pDestroyWindow              = user32.NewProc("DestroyWindow")
	pDefWindowProcW             = user32.NewProc("DefWindowProcW")
	pGetMessageW                = user32.NewProc("GetMessageW")
	pTranslateMessage           = user32.NewProc("TranslateMessage")
	pDispatchMessageW           = user32.NewProc("DispatchMessageW")
	pPostMessageW               = user32.NewProc("PostMessageW")
	pShowWindow                 = user32.NewProc("ShowWindow")
	pShowWindowAsync            = user32.NewProc("ShowWindowAsync")
	pSetWindowPos               = user32.NewProc("SetWindowPos")
	pGetWindowRect              = user32.NewProc("GetWindowRect")
	pGetWindowLongPtrW          = user32.NewProc("GetWindowLongPtrW")
	pSetWindowLongPtrW          = user32.NewProc("SetWindowLongPtrW")
	pUpdateLayeredWindow        = user32.NewProc("UpdateLayeredWindow")
	pSetLayeredWindowAttributes = user32.NewProc("SetLayeredWindowAttributes")
	pLoadCursorW                = user32.NewProc("LoadCursorW")
	pSetCursor                  = user32.NewProc("SetCursor")
	pSetForegroundWindow        = user32.NewProc("SetForegroundWindow")
	pIsIconic                   = user32.NewProc("IsIconic")
	pGetDC                      = user32.NewProc("GetDC")
	pReleaseDC                  = user32.NewProc("ReleaseDC")
	pGetDpiForSystem            = user32.NewProc("GetDpiForSystem")
	pGetDpiForWindow            = user32.NewProc("GetDpiForWindow")
	pSystemParametersInfoW      = user32.NewProc("SystemParametersInfoW")
	pMessageBoxW                = user32.NewProc("MessageBoxW")
	pFindWindowW                = user32.NewProc("FindWindowW")

	pCreateCompatibleDC    = gdi32.NewProc("CreateCompatibleDC")
	pCreateDIBSection      = gdi32.NewProc("CreateDIBSection")
	pSelectObject          = gdi32.NewProc("SelectObject")
	pDeleteObject          = gdi32.NewProc("DeleteObject")
	pDeleteDC              = gdi32.NewProc("DeleteDC")
	pCreateFontW           = gdi32.NewProc("CreateFontW")
	pSetTextColor          = gdi32.NewProc("SetTextColor")
	pSetBkMode             = gdi32.NewProc("SetBkMode")
	pGetTextExtentPoint32W = gdi32.NewProc("GetTextExtentPoint32W")
	pTextOutW              = gdi32.NewProc("TextOutW")
	pGdiFlush              = gdi32.NewProc("GdiFlush")
	pGetStockObject        = gdi32.NewProc("GetStockObject")

	pDwmSetWindowAttribute = dwmapi.NewProc("DwmSetWindowAttribute")
	pCreateMutexW          = kernel32.NewProc("CreateMutexW")
)

const (
	smXVirtualScreen  = 76
	smYVirtualScreen  = 77
	smCXVirtualScreen = 78
	smCYVirtualScreen = 79

	gaRoot = 2

	wsPopup          = 0x80000000
	wsExTopmost      = 0x00000008
	wsExTransparent  = 0x00000020
	wsExToolWindow   = 0x00000080
	wsExLayered      = 0x00080000
	wsExNoActivate   = 0x08000000
	gwlExStyle       = ^uintptr(19) // -20
	hwndMessage      = ^uintptr(2)  // -3
	hwndTopmost      = ^uintptr(0)  // -1
	hwndNoTopmost    = ^uintptr(1)  // -2
	swHide           = 0
	swShowNoActivate = 4
	swMinimize       = 6
	swRestore        = 9
	swpNoSize        = 0x0001
	swpNoMove        = 0x0002
	swpNoZOrder      = 0x0004
	swpNoActivate    = 0x0010
	swpFrameChanged  = 0x0020
	swpShowWindow    = 0x0040

	wmDestroy       = 0x0002
	wmMove          = 0x0003
	wmSetCursor     = 0x0020
	wmMouseActivate = 0x0021
	wmNCHitTest     = 0x0084
	wmKeyDown       = 0x0100
	wmLButtonDown   = 0x0201
	wmRButtonDown   = 0x0204
	wmHotkey        = 0x0312
	wmExitSizeMove  = 0x0232
	wmActivate      = 0x0006
	wmCmd           = 0x8000 + 0x55 // WM_APP + n: "run queued commands"
	htCaption       = 2
	maNoActivate    = 3

	ulwAlpha    = 2
	lwaAlpha    = 2
	idcArrow    = 32512
	idcCross    = 32515
	idcSizeAll  = 32646
	modNoRepeat = 0x4000
	vkEscape    = 0x1B
	vkF1        = 0x70
	blackBrush  = 4
	spiWorkArea = 0x0030
)

type rect struct{ L, T, R, B int32 }
type size struct{ CX, CY int32 }

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

type bitmapInfo struct {
	Size          uint32
	Width, Height int32
	Planes        uint16
	BitCount      uint16
	Compression   uint32
	SizeImage     uint32
	XPels, YPels  int32
	ClrUsed       uint32
	ClrImportant  uint32
	Colors        [4]byte
}

type blendFunc struct{ Op, Flags, Alpha, Format byte }

func u16(s string) *uint16 { p, _ := windows.UTF16PtrFromString(s); return p }

func getCursorPos() point {
	var p point
	pGetCursorPos.Call(uintptr(unsafe.Pointer(&p)))
	return p
}

func virtualScreen() (x, y, w, h int32) {
	a, _, _ := pGetSystemMetrics.Call(smXVirtualScreen)
	b, _, _ := pGetSystemMetrics.Call(smYVirtualScreen)
	c, _, _ := pGetSystemMetrics.Call(smCXVirtualScreen)
	d, _, _ := pGetSystemMetrics.Call(smCYVirtualScreen)
	return int32(a), int32(b), int32(c), int32(d)
}

func rootWindowAt(p point) uintptr {
	h, _, _ := pWindowFromPoint.Call(uintptr(uint32(p.X)) | uintptr(uint32(p.Y))<<32)
	if h == 0 {
		return 0
	}
	r, _, _ := pGetAncestor.Call(h, gaRoot)
	return r
}

func sendInputs(in []input) int {
	if len(in) == 0 {
		return 0
	}
	n, _, _ := pSendInput.Call(uintptr(len(in)), uintptr(unsafe.Pointer(&in[0])), unsafe.Sizeof(input{}))
	return int(n)
}

func systemScale() float64 {
	if pGetDpiForSystem.Find() != nil {
		return 1
	}
	d, _, _ := pGetDpiForSystem.Call()
	if d == 0 {
		return 1
	}
	return float64(d) / 96
}

func windowScale(hwnd uintptr) float64 {
	if pGetDpiForWindow.Find() != nil {
		return systemScale()
	}
	d, _, _ := pGetDpiForWindow.Call(hwnd)
	if d == 0 {
		return systemScale()
	}
	return float64(d) / 96
}

func workArea() rect {
	var r rect
	pSystemParametersInfoW.Call(spiWorkArea, 0, uintptr(unsafe.Pointer(&r)), 0)
	return r
}

func windowRect(h uintptr) rect {
	var r rect
	pGetWindowRect.Call(h, uintptr(unsafe.Pointer(&r)))
	return r
}

func messageBox(text, title string, flags uintptr) {
	pMessageBoxW.Call(0, uintptr(unsafe.Pointer(u16(text))), uintptr(unsafe.Pointer(u16(title))), flags)
}

// renderText draws text with GDI into a black/white bitmap and returns the
// grayscale coverage, which render.go then tints and blends.
func renderText(text string, px int, weight int) *textMask {
	if text == "" {
		return nil
	}
	hdc, _, _ := pCreateCompatibleDC.Call(0)
	if hdc == 0 {
		return nil
	}
	defer pDeleteDC.Call(hdc)
	font, _, _ := pCreateFontW.Call(uintptr(-int32(px))&0xFFFFFFFF, 0, 0, 0, uintptr(weight), 0, 0, 0,
		1 /*DEFAULT_CHARSET*/, 0, 0, 4 /*ANTIALIASED_QUALITY*/, 0, uintptr(unsafe.Pointer(u16("Bahnschrift"))))
	if font == 0 {
		return nil
	}
	defer pDeleteObject.Call(font)
	oldFont, _, _ := pSelectObject.Call(hdc, font)
	defer pSelectObject.Call(hdc, oldFont)

	w16, _ := windows.UTF16FromString(text)
	n := len(w16) - 1
	var sz size
	pGetTextExtentPoint32W.Call(hdc, uintptr(unsafe.Pointer(&w16[0])), uintptr(n), uintptr(unsafe.Pointer(&sz)))
	w, h := int(sz.CX)+2, int(sz.CY)
	if w <= 2 || h <= 0 {
		return nil
	}
	bi := bitmapInfo{Size: 40, Width: int32(w), Height: -int32(h), Planes: 1, BitCount: 32}
	var bits unsafe.Pointer
	bmp, _, _ := pCreateDIBSection.Call(hdc, uintptr(unsafe.Pointer(&bi)), 0, uintptr(unsafe.Pointer(&bits)), 0, 0)
	if bmp == 0 || bits == nil {
		return nil
	}
	defer pDeleteObject.Call(bmp)
	oldBmp, _, _ := pSelectObject.Call(hdc, bmp)
	defer pSelectObject.Call(hdc, oldBmp)

	pSetTextColor.Call(hdc, 0xFFFFFF)
	pSetBkMode.Call(hdc, 1 /*TRANSPARENT*/)
	pTextOutW.Call(hdc, 1, 0, uintptr(unsafe.Pointer(&w16[0])), uintptr(n))
	pGdiFlush.Call()

	src := unsafe.Slice((*byte)(bits), w*h*4)
	m := &textMask{w: w, h: h, a: make([]byte, w*h)}
	for i := 0; i < w*h; i++ {
		m.a[i] = src[i*4+1] // green channel = coverage (grayscale AA, not ClearType)
	}
	return m
}

// layeredWindow pushes a canvas onto a per-pixel-alpha layered window at x,y.
func pushLayered(hwnd uintptr, cv *canvas, x, y int32) {
	screen, _, _ := pGetDC.Call(0)
	defer pReleaseDC.Call(0, screen)
	mem, _, _ := pCreateCompatibleDC.Call(screen)
	if mem == 0 {
		return
	}
	defer pDeleteDC.Call(mem)
	bi := bitmapInfo{Size: 40, Width: int32(cv.w), Height: -int32(cv.h), Planes: 1, BitCount: 32}
	var bits unsafe.Pointer
	bmp, _, _ := pCreateDIBSection.Call(mem, uintptr(unsafe.Pointer(&bi)), 0, uintptr(unsafe.Pointer(&bits)), 0, 0)
	if bmp == 0 || bits == nil {
		return
	}
	defer pDeleteObject.Call(bmp)
	old, _, _ := pSelectObject.Call(mem, bmp)
	defer pSelectObject.Call(mem, old)
	copy(unsafe.Slice((*byte)(bits), len(cv.px)), cv.px)

	dst := point{x, y}
	sz := size{int32(cv.w), int32(cv.h)}
	src := point{}
	bf := blendFunc{Op: 0, Alpha: 255, Format: 1 /*AC_SRC_ALPHA*/}
	pUpdateLayeredWindow.Call(hwnd, screen, uintptr(unsafe.Pointer(&dst)), uintptr(unsafe.Pointer(&sz)),
		mem, uintptr(unsafe.Pointer(&src)), 0, uintptr(unsafe.Pointer(&bf)), ulwAlpha)
}

func setExStyle(hwnd uintptr, add, remove uintptr) {
	s, _, _ := pGetWindowLongPtrW.Call(hwnd, gwlExStyle)
	ns := (s | add) &^ remove
	if ns != s {
		pSetWindowLongPtrW.Call(hwnd, gwlExStyle, ns)
	}
}

// darkTitleBar makes the main window frame match the dark UI (Win10 20H1+ / Win11).
func darkTitleBar(hwnd uintptr) {
	if pDwmSetWindowAttribute.Find() != nil {
		return
	}
	on := int32(1)
	pDwmSetWindowAttribute.Call(hwnd, 20, uintptr(unsafe.Pointer(&on)), 4)
	caption := uint32(0x00140E0B) // COLORREF of #0b0e14
	pDwmSetWindowAttribute.Call(hwnd, 35, uintptr(unsafe.Pointer(&caption)), 4)
}
