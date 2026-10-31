//go:build windows

package main

// Eyes on Windows: pictures of the whole screen (every monitor) with plain GDI.

import (
	"errors"
	"image"
	"runtime"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	pGetDC                  = user32.NewProc("GetDC")
	pReleaseDC              = user32.NewProc("ReleaseDC")
	pGetForegroundWindow    = user32.NewProc("GetForegroundWindow")
	pGetClassNameW          = user32.NewProc("GetClassNameW")
	pRegisterHotKey         = user32.NewProc("RegisterHotKey")
	pMessageBeep            = user32.NewProc("MessageBeep")
	pCreateCompatibleDC     = gdi32.NewProc("CreateCompatibleDC")
	pCreateCompatibleBitmap = gdi32.NewProc("CreateCompatibleBitmap")
	pSelectObject           = gdi32.NewProc("SelectObject")
	pBitBlt                 = gdi32.NewProc("BitBlt")
	pGetDIBits              = gdi32.NewProc("GetDIBits")
	pDeleteObject           = gdi32.NewProc("DeleteObject")
	pDeleteDC               = gdi32.NewProc("DeleteDC")
)

const (
	wmHotkey  = 0x0312
	hotRecord = 1
	eyesPoll  = 5 * time.Second
)

type bitmapInfo struct {
	Size                         uint32
	Width, Height                int32
	Planes, BitCount             uint16
	Compression, SizeImage       uint32
	XPelsPerMeter, YPelsPerMeter int32
	ClrUsed, ClrImportant        uint32
	masks                        [4]uint32 // room Windows may write into
}

// captureScreen takes a picture of every monitor at once.
func captureScreen() (*image.RGBA, error) {
	x, y := sysMetric(76), sysMetric(77) // SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN
	w, h := sysMetric(78), sysMetric(79) // SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN
	if w <= 0 || h <= 0 {
		return nil, errors.New("no screen")
	}
	sdc, _, _ := pGetDC.Call(0)
	if sdc == 0 {
		return nil, errors.New("GetDC failed")
	}
	defer pReleaseDC.Call(0, sdc)
	mdc, _, _ := pCreateCompatibleDC.Call(sdc)
	if mdc == 0 {
		return nil, errors.New("CreateCompatibleDC failed")
	}
	defer pDeleteDC.Call(mdc)
	bmp, _, _ := pCreateCompatibleBitmap.Call(sdc, uintptr(w), uintptr(h))
	if bmp == 0 {
		return nil, errors.New("CreateCompatibleBitmap failed")
	}
	defer pDeleteObject.Call(bmp)
	old, _, _ := pSelectObject.Call(mdc, bmp)
	ok, _, _ := pBitBlt.Call(mdc, 0, 0, uintptr(w), uintptr(h), sdc, uintptr(x), uintptr(y), 0x00CC0020|0x40000000) // SRCCOPY | CAPTUREBLT
	pSelectObject.Call(mdc, old)
	if ok == 0 {
		return nil, errors.New("BitBlt failed")
	}
	bi := bitmapInfo{Width: w, Height: -h, Planes: 1, BitCount: 32} // negative height = rows top to bottom
	bi.Size = 40
	img := image.NewRGBA(image.Rect(0, 0, int(w), int(h)))
	n, _, _ := pGetDIBits.Call(mdc, bmp, 0, uintptr(h), uintptr(unsafe.Pointer(&img.Pix[0])), uintptr(unsafe.Pointer(&bi)), 0)
	if n == 0 {
		return nil, errors.New("GetDIBits failed")
	}
	for i := 0; i < len(img.Pix); i += 4 { // BGRA -> RGBA
		img.Pix[i], img.Pix[i+2], img.Pix[i+3] = img.Pix[i+2], img.Pix[i], 255
	}
	return img, nil
}

// altsInFront: ALTS is the window you're using (or nothing is, like a locked screen).
func altsInFront() bool {
	h, _, _ := pGetForegroundWindow.Call()
	if h == 0 {
		return true
	}
	buf := make([]uint16, 64)
	pGetClassNameW.Call(h, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
	return windows.UTF16ToString(buf) == mainClass
}

// eyesLoop runs all the time: while you're using something other than ALTS, it keeps the screen
// fresh every few seconds (and one picture per 30 s for the grid). Pictures of ALTS itself are skipped.
func (a *App) eyesLoop() {
	runtime.LockOSThread()
	t := time.NewTicker(eyesPoll)
	defer t.Stop()
	for range t.C {
		if !a.eyesOn.Load() || a.recording.Load() || altsInFront() {
			continue
		}
		if img, err := captureScreen(); err == nil {
			a.eye.add(img, time.Now())
		}
	}
}

// record5 takes 10 pictures over 5 seconds (Ctrl+Alt+5, or the 5s button). They go with your next message.
func (a *App) record5() {
	if !a.recording.CompareAndSwap(false, true) {
		return
	}
	go func() {
		runtime.LockOSThread()
		defer a.recording.Store(false)
		pMessageBeep.Call(0)
		start := time.Now()
		var got []frame
		for i := 0; i < 10; i++ {
			time.Sleep(time.Until(start.Add(time.Duration(i) * 500 * time.Millisecond)))
			if img, err := captureScreen(); err == nil {
				got = append(got, frame{time.Now(), fitWidth(img, 384)})
			}
		}
		pMessageBeep.Call(0x40)
		if len(got) == 0 {
			a.post(func() { a.toast("Couldn't record the screen.") })
			return
		}
		a.eye.setClip(got, time.Now())
		a.post(func() { a.toast("Recorded 5 seconds. It goes with your next message.") })
	}()
}
