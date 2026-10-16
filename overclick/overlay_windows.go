//go:build windows

package main

import (
	"math"
	"runtime"
	"strconv"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

// winUI owns everything drawn outside the main window: the draggable click
// targets, the running badge (HUD), the "click to place" screen, and the
// global hotkeys. It all lives on one locked OS thread with its own message loop.
type winUI struct {
	app   *App
	ready chan struct{}

	mu    sync.Mutex
	queue []func()

	// Only touched on the UI thread below.
	msgHwnd      uintptr
	inst         uintptr
	scale        float64
	markers      map[int]*marker
	byHwnd       map[uintptr]*marker
	clickThrough bool
	hud          uintptr
	hudKey       string
	pick         uintptr
	pickID       int
	pickDown     bool
}

type marker struct {
	id     int
	hwnd   uintptr
	look   string // label|color|dim, to skip redraws that change nothing
	x, y   int32  // the exact click spot (center of the window)
	moving bool   // we're moving it ourselves, ignore WM_MOVE
}

var theUI *winUI // the window procedure is a plain callback and needs a way back

var clickerPalette = []string{"#4cc9ff", "#ff5fd2", "#8cff66", "#ffb020", "#b388ff", "#ff6b6b", "#3ff0c8", "#f5f06b"}

var modeColors = map[string]string{
	"custom": "#9aa7c7", "normal": "#3d9cff", "fast": "#22d3b4",
	"turbo": "#ffd23f", "insane": "#ff7a1a", "max": "#ff2448",
}

func clickerColor(id int) string {
	if id < 1 {
		id = 1
	}
	return clickerPalette[(id-1)%len(clickerPalette)]
}

func newWinUI(app *App) *winUI {
	return &winUI{app: app, ready: make(chan struct{}), markers: map[int]*marker{}, byHwnd: map[uintptr]*marker{}}
}

// do runs f on the UI thread. It never blocks, so it's safe to call from anywhere.
func (u *winUI) do(f func()) {
	u.mu.Lock()
	u.queue = append(u.queue, f)
	u.mu.Unlock()
	pPostMessageW.Call(u.msgHwnd, wmCmd, 0, 0)
}

func (u *winUI) drain() {
	u.mu.Lock()
	q := u.queue
	u.queue = nil
	u.mu.Unlock()
	for _, f := range q {
		f()
	}
}

func (u *winUI) registerClass(name string, cursor uintptr, bg uintptr, proc uintptr) {
	cur, _, _ := pLoadCursorW.Call(0, cursor)
	wc := wndClassEx{
		Size: uint32(unsafe.Sizeof(wndClassEx{})), WndProc: proc, Instance: u.inst,
		Cursor: cur, Background: bg, ClassName: u16(name),
	}
	pRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))
}

func (u *winUI) run() {
	runtime.LockOSThread()
	var h windows.Handle
	windows.GetModuleHandleEx(0, nil, &h)
	u.inst = uintptr(h)
	u.scale = systemScale()
	proc := windows.NewCallback(uiWndProc)
	black, _, _ := pGetStockObject.Call(blackBrush)
	u.registerClass("OverclickMsg", idcArrow, 0, proc)
	u.registerClass("OverclickTarget", idcSizeAll, 0, proc)
	u.registerClass("OverclickHUD", idcArrow, 0, proc)
	u.registerClass("OverclickPick", idcCross, black, proc)
	u.msgHwnd, _, _ = pCreateWindowExW.Call(0, uintptr(unsafe.Pointer(u16("OverclickMsg"))), 0, 0,
		0, 0, 0, 0, hwndMessage, 0, u.inst, 0)
	close(u.ready)

	var m msg
	for {
		r, _, _ := pGetMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if int32(r) <= 0 {
			return
		}
		pTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
		pDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
	}
}

func uiWndProc(hwnd, m, wp, lp uintptr) uintptr {
	u := theUI
	if u != nil {
		switch {
		case hwnd == u.msgHwnd:
			switch m {
			case wmCmd:
				u.drain()
				return 0
			case wmHotkey:
				if wp == 1 {
					go u.app.Toggle()
				} else if wp == 2 {
					go u.app.Stop("esc")
				}
				return 0
			}
		case hwnd == u.pick && hwnd != 0:
			switch m {
			case wmLButtonDown:
				u.pickDown = true
				return 0
			case wmLButtonDown + 1: // WM_LBUTTONUP: finish on release so the game never gets a stray button-up
				if u.pickDown {
					u.endPick(true, getCursorPos())
				}
				return 0
			case wmRButtonDown:
				return 0
			case wmRButtonDown + 1: // WM_RBUTTONUP
				u.endPick(false, point{})
				return 0
			case wmKeyDown:
				if wp == vkEscape {
					u.endPick(false, point{})
				}
				return 0
			}
		default:
			if mk := u.byHwnd[hwnd]; mk != nil {
				switch m {
				case wmNCHitTest:
					return htCaption // drag the target anywhere
				case wmSetCursor:
					c, _, _ := pLoadCursorW.Call(0, idcSizeAll)
					pSetCursor.Call(c)
					return 1
				case wmMouseActivate:
					return maNoActivate
				case wmMove:
					if !mk.moving {
						u.markerMoved(mk, false)
					}
				case wmExitSizeMove:
					u.markerMoved(mk, true)
				}
			}
		}
	}
	r, _, _ := pDefWindowProcW.Call(hwnd, m, wp, lp)
	return r
}

// ---- click targets ----

func (u *winUI) half() int32 { return int32(markerSize(u.scale) / 2) }

func (u *winUI) markerMoved(mk *marker, final bool) {
	r := windowRect(mk.hwnd)
	mk.x, mk.y = r.L+u.half(), r.T+u.half()
	u.app.markerMoved(mk.id, int(mk.x), int(mk.y), final)
}

func (u *winUI) moveMarker(mk *marker, x, y int32) {
	mk.x, mk.y = x, y
	mk.moving = true
	pSetWindowPos.Call(mk.hwnd, hwndTopmost, uintptr(x-u.half()), uintptr(y-u.half()), 0, 0, swpNoSize|swpNoActivate)
	mk.moving = false
}

// syncMarkers makes the on-screen targets match the clicker list.
func (u *winUI) syncMarkers(cs []ClickerCfg, show bool) {
	keep := map[int]bool{}
	for i, c := range cs {
		if !show || c.Follow {
			continue
		}
		keep[c.ID] = true
		label := strconv.Itoa(i + 1)
		color := clickerColor(c.ID)
		look := label + "|" + color + "|" + strconv.FormatBool(!c.On)
		mk := u.markers[c.ID]
		x, y := int32(c.X), int32(c.Y)
		if mk == nil {
			ex := uintptr(wsExLayered | wsExTopmost | wsExToolWindow | wsExNoActivate)
			if u.clickThrough {
				ex |= wsExTransparent
			}
			n := uintptr(markerSize(u.scale))
			h, _, _ := pCreateWindowExW.Call(ex, uintptr(unsafe.Pointer(u16("OverclickTarget"))), 0, wsPopup,
				uintptr(x-u.half()), uintptr(y-u.half()), n, n, 0, 0, u.inst, 0)
			if h == 0 {
				continue
			}
			mk = &marker{id: c.ID, hwnd: h, x: x, y: y}
			u.markers[c.ID] = mk
			u.byHwnd[h] = mk
		}
		if mk.look != look {
			mk.look = look
			lbl := renderText(label, int(math.Round(12*u.scale)), 700)
			mk.moving = true
			pushLayered(mk.hwnd, drawMarker(u.scale, hexColor(color), lbl, !c.On), x-u.half(), y-u.half())
			pShowWindow.Call(mk.hwnd, swShowNoActivate)
			mk.moving = false
			mk.x, mk.y = x, y
		}
		if mk.x != x || mk.y != y {
			u.moveMarker(mk, x, y)
		}
	}
	for id, mk := range u.markers {
		if !keep[id] {
			delete(u.markers, id)
			delete(u.byHwnd, mk.hwnd)
			pDestroyWindow.Call(mk.hwnd)
		}
	}
}

// setClickThrough: while clicking, targets must let clicks pass to the app under them.
func (u *winUI) setClickThrough(on bool) {
	u.clickThrough = on
	for _, mk := range u.markers {
		if on {
			setExStyle(mk.hwnd, wsExTransparent, 0)
		} else {
			setExStyle(mk.hwnd, 0, wsExTransparent)
		}
	}
}

// ---- running badge ----

func (u *winUI) setHUD(text, color string) {
	key := text + color
	if key == u.hudKey {
		return
	}
	u.hudKey = key
	if text == "" {
		if u.hud != 0 {
			pShowWindow.Call(u.hud, swHide)
		}
		return
	}
	if u.hud == 0 {
		ex := uintptr(wsExLayered | wsExTopmost | wsExToolWindow | wsExNoActivate | wsExTransparent)
		u.hud, _, _ = pCreateWindowExW.Call(ex, uintptr(unsafe.Pointer(u16("OverclickHUD"))), 0, wsPopup,
			0, 0, 10, 10, 0, 0, u.inst, 0)
		if u.hud == 0 {
			return
		}
	}
	cv := drawHUD(u.scale, hexColor(color), renderText(text, int(math.Round(14*u.scale)), 600))
	wa := workArea()
	x := wa.L + (wa.R-wa.L-int32(cv.w))/2
	y := wa.T + int32(math.Round(14*u.scale))
	pushLayered(u.hud, cv, x, y)
	pShowWindow.Call(u.hud, swShowNoActivate)
	pSetWindowPos.Call(u.hud, hwndTopmost, 0, 0, 0, 0, swpNoMove|swpNoSize|swpNoActivate)
}

// ---- hotkeys ----

func (u *winUI) setHotkey(name string) bool {
	pUnregisterHotKey.Call(u.msgHwnd, 1)
	vk := uintptr(0)
	for i, h := range hotkeys {
		if h == name {
			vk = vkF1 + uintptr(i)
		}
	}
	if vk == 0 {
		return false
	}
	r, _, _ := pRegisterHotKey.Call(u.msgHwnd, 1, modNoRepeat, vk)
	return r != 0
}

// Esc is only grabbed while clicking, so it still works normally in games otherwise.
func (u *winUI) setEsc(on bool) {
	pUnregisterHotKey.Call(u.msgHwnd, 2)
	if on {
		pRegisterHotKey.Call(u.msgHwnd, 2, modNoRepeat, vkEscape)
	}
}

// ---- "click where it should click" screen ----

func (u *winUI) startPick(id int, name string) {
	if u.pick != 0 {
		pDestroyWindow.Call(u.pick)
	}
	vx, vy, vw, vh := virtualScreen()
	u.pick, _, _ = pCreateWindowExW.Call(wsExLayered|wsExTopmost|wsExToolWindow,
		uintptr(unsafe.Pointer(u16("OverclickPick"))), 0, wsPopup,
		uintptr(vx), uintptr(vy), uintptr(vw), uintptr(vh), 0, 0, u.inst, 0)
	if u.pick == 0 {
		u.app.pickDone(id, false, point{})
		return
	}
	u.pickID = id
	u.pickDown = false
	pSetLayeredWindowAttributes.Call(u.pick, 0, 90, lwaAlpha)
	pShowWindow.Call(u.pick, 5 /*SW_SHOW*/)
	pSetForegroundWindow.Call(u.pick)
	u.setHUD("Click where "+name+" should click  ·  Esc or right-click to cancel", clickerColor(id))
	pShowWindowAsync.Call(u.app.main, swMinimize) // so you can see your game under it
}

func (u *winUI) endPick(ok bool, p point) {
	if u.pick == 0 {
		return
	}
	h := u.pick
	u.pick = 0
	pDestroyWindow.Call(h)
	u.setHUD("", "")
	u.app.pickDone(u.pickID, ok, p)
}

func (u *winUI) cancelPick() { u.endPick(false, point{}) }
