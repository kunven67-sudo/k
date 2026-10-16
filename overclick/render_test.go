package main

import (
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

// Writes marker/HUD previews over a light and a dark background when
// OVERCLICK_PREVIEW is set to a folder.
func TestRenderPreview(t *testing.T) {
	m := drawMarker(1.5, hexColor("#4cc9ff"), nil, false)
	if m.w != 90 || len(m.px) != 90*90*4 {
		t.Fatalf("marker size %d", m.w)
	}
	c := m.w / 2
	if m.px[(c*m.w+c)*4+3] < 200 {
		t.Error("center dot (the click spot) not drawn")
	}
	if m.px[3] != 0 {
		t.Error("corner should be transparent")
	}
	dir := os.Getenv("OVERCLICK_PREVIEW")
	if dir == "" {
		return
	}
	fake := &textMask{w: 120, h: 14, a: make([]byte, 120*14)}
	for i := range fake.a {
		if (i%120)%9 < 6 {
			fake.a[i] = 255
		}
	}
	h := drawHUD(1.5, hexColor("#ff2448"), fake)
	out := image.NewNRGBA(image.Rect(0, 0, 420, 220))
	for y := 0; y < 220; y++ {
		for x := 0; x < 420; x++ {
			bg := color.NRGBA{235, 235, 228, 255}
			if x >= 210 {
				bg = color.NRGBA{40, 70, 50, 255}
			}
			out.Set(x, y, bg)
		}
	}
	put := func(cv *canvas, ox, oy int) {
		for y := 0; y < cv.h; y++ {
			for x := 0; x < cv.w; x++ {
				i := (y*cv.w + x) * 4
				a := float64(cv.px[i+3]) / 255
				b := out.NRGBAAt(ox+x, oy+y)
				out.Set(ox+x, oy+y, color.NRGBA{
					uint8(float64(cv.px[i+2]) + float64(b.R)*(1-a)),
					uint8(float64(cv.px[i+1]) + float64(b.G)*(1-a)),
					uint8(float64(cv.px[i+0]) + float64(b.B)*(1-a)), 255})
			}
		}
	}
	put(m, 40, 20)
	put(drawMarker(1.5, hexColor("#ff5fd2"), nil, true), 260, 20)
	put(h, 20, 150)
	f, _ := os.Create(filepath.Join(dir, "render-preview.png"))
	png.Encode(f, out)
	f.Close()
}
