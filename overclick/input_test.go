package main

import (
	"testing"
	"unsafe"
)

func TestInputLayout(t *testing.T) {
	if s := unsafe.Sizeof(input{}); s != 40 {
		t.Fatalf("INPUT is %d bytes, Windows x64 wants 40", s)
	}
	if o := unsafe.Offsetof(input{}.Mi); o != 8 {
		t.Fatalf("mi offset %d, want 8", o)
	}
}

func TestAbsCoordLandsOnPixel(t *testing.T) {
	// Every pixel must map back to itself with Windows' formula, on odd setups too
	// (a second monitor left of the main one gives a negative origin).
	for _, scr := range [][2]int32{{0, 1920}, {-1280, 3200}, {0, 7}, {-2560, 6400}} {
		origin, size := scr[0], scr[1]
		for p := origin; p < origin+size; p++ {
			v := absCoord(p, origin, size)
			back := origin + int32(int64(v)*int64(size)/65536)
			if back != p {
				t.Fatalf("screen %v: pixel %d -> %d -> %d", scr, p, v, back)
			}
		}
	}
}

func TestClickInputs(t *testing.T) {
	buf := make([]input, 0, 8)
	c := &ClickerCfg{Follow: false, X: 100, Y: 50, Button: "right", Double: true}
	in, reps := clickInputs(buf, c, point{5, 5}, 0, 0, 1920, 1080, true)
	if reps != 2 || len(in) != 6 {
		t.Fatalf("got %d inputs, reps %d", len(in), reps)
	}
	if in[0].Mi.Flags&mouseMove == 0 || in[1].Mi.Flags != mouseRightDown || in[2].Mi.Flags != mouseRightUp || in[5].Mi.Flags&mouseMove == 0 {
		t.Fatalf("bad order: %+v", in)
	}
	f := &ClickerCfg{Follow: true, Button: "left"}
	in, reps = clickInputs(buf, f, point{}, 0, 0, 1920, 1080, true)
	if reps != 1 || len(in) != 2 || in[0].Mi.Flags != mouseLeftDown {
		t.Fatalf("follow click: %+v", in)
	}
}
