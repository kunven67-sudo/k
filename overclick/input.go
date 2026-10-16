package main

// Win32 structs used with SendInput. They live in a file without a build tag
// so their sizes can be checked by tests on any OS (Windows rejects the call if
// cbSize is wrong, and nothing clicks).

type point struct{ X, Y int32 }

type mouseInput struct {
	Dx, Dy    int32
	MouseData uint32
	Flags     uint32
	Time      uint32
	ExtraInfo uintptr
}

type input struct {
	Type uint32
	_    uint32
	Mi   mouseInput
}

const (
	mouseMove        = 0x0001
	mouseLeftDown    = 0x0002
	mouseLeftUp      = 0x0004
	mouseRightDown   = 0x0008
	mouseRightUp     = 0x0010
	mouseMiddleDown  = 0x0020
	mouseMiddleUp    = 0x0040
	mouseVirtualDesk = 0x4000
	mouseAbsolute    = 0x8000

	injectedTag = 0x0C11C4 // marks our own clicks in dwExtraInfo
)

func buttonFlags(b string) (down, up uint32) {
	switch b {
	case "right":
		return mouseRightDown, mouseRightUp
	case "middle":
		return mouseMiddleDown, mouseMiddleUp
	}
	return mouseLeftDown, mouseLeftUp
}

// absCoord maps a screen pixel to SendInput's 0..65535 virtual-desktop range.
// Windows maps back with pixel = origin + floor(v*size/65536), so aiming at the
// middle of the pixel's range lands exactly on it.
func absCoord(p, origin, size int32) int32 {
	if size <= 0 {
		return 0
	}
	v := (int64(2*(p-origin)+1) * 65536) / int64(2*size)
	if v < 0 {
		v = 0
	}
	if v > 65535 {
		v = 65535
	}
	return int32(v)
}

// clickInputs builds one SendInput batch: optional move to the spot, the
// click(s), optional move back. Batching keeps it atomic, so the click can't
// land somewhere else if the real mouse moves halfway through.
func clickInputs(buf []input, c *ClickerCfg, cur point, vx, vy, vw, vh int32, returnMouse bool) ([]input, int) {
	buf = buf[:0]
	move := func(p point) {
		buf = append(buf, input{Mi: mouseInput{
			Dx: absCoord(p.X, vx, vw), Dy: absCoord(p.Y, vy, vh),
			Flags: mouseMove | mouseAbsolute | mouseVirtualDesk, ExtraInfo: injectedTag,
		}})
	}
	if !c.Follow {
		move(point{int32(c.X), int32(c.Y)})
	}
	down, up := buttonFlags(c.Button)
	reps := 1
	if c.Double {
		reps = 2
	}
	for i := 0; i < reps; i++ {
		buf = append(buf,
			input{Mi: mouseInput{Flags: down, ExtraInfo: injectedTag}},
			input{Mi: mouseInput{Flags: up, ExtraInfo: injectedTag}})
	}
	if !c.Follow && returnMouse {
		move(cur)
	}
	return buf, reps
}
