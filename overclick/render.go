package main

import "math"

// canvas is a premultiplied BGRA pixel buffer, the format UpdateLayeredWindow wants.
// Drawing it in plain Go gives smooth antialiased edges without any graphics library.
type canvas struct {
	w, h int
	px   []byte
}

type rgb struct{ r, g, b uint8 }

func newCanvas(w, h int) *canvas { return &canvas{w: w, h: h, px: make([]byte, w*h*4)} }

func hexColor(s string) rgb {
	var v [6]uint8
	for i := 0; i < 6 && i+1 < len(s); i++ {
		c := s[i+1]
		switch {
		case c >= '0' && c <= '9':
			v[i] = c - '0'
		case c >= 'a' && c <= 'f':
			v[i] = c - 'a' + 10
		case c >= 'A' && c <= 'F':
			v[i] = c - 'A' + 10
		}
	}
	return rgb{v[0]<<4 | v[1], v[2]<<4 | v[3], v[4]<<4 | v[5]}
}

// blend paints color c with coverage a (0..1) over the pixel at x,y.
func (cv *canvas) blend(x, y int, c rgb, a float64) {
	if x < 0 || y < 0 || x >= cv.w || y >= cv.h || a <= 0 {
		return
	}
	if a > 1 {
		a = 1
	}
	i := (y*cv.w + x) * 4
	inv := 1 - a
	cv.px[i+0] = uint8(float64(c.b)*a + float64(cv.px[i+0])*inv + 0.5)
	cv.px[i+1] = uint8(float64(c.g)*a + float64(cv.px[i+1])*inv + 0.5)
	cv.px[i+2] = uint8(float64(c.r)*a + float64(cv.px[i+2])*inv + 0.5)
	cv.px[i+3] = uint8(255*a + float64(cv.px[i+3])*inv + 0.5)
}

// shape runs f (signed distance -> coverage) over a box, sampling pixel centers.
func (cv *canvas) shape(x0, y0, x1, y1 float64, c rgb, alpha float64, cover func(px, py float64) float64) {
	for y := int(math.Floor(y0)); y <= int(math.Ceil(y1)); y++ {
		for x := int(math.Floor(x0)); x <= int(math.Ceil(x1)); x++ {
			if k := cover(float64(x)+0.5, float64(y)+0.5); k > 0 {
				cv.blend(x, y, c, k*alpha)
			}
		}
	}
}

func edge(d float64) float64 { // d < 0 inside; one pixel of antialiasing
	return math.Max(0, math.Min(1, 0.5-d))
}

func (cv *canvas) disc(cx, cy, r float64, c rgb, alpha float64) {
	cv.shape(cx-r-1, cy-r-1, cx+r+1, cy+r+1, c, alpha, func(x, y float64) float64 {
		return edge(math.Hypot(x-cx, y-cy) - r)
	})
}

func (cv *canvas) ring(cx, cy, r, thick float64, c rgb, alpha float64) {
	cv.shape(cx-r-thick, cy-r-thick, cx+r+thick, cy+r+thick, c, alpha, func(x, y float64) float64 {
		return edge(math.Abs(math.Hypot(x-cx, y-cy)-r) - thick/2)
	})
}

// glow is a soft blurred ring.
func (cv *canvas) glow(cx, cy, r, spread float64, c rgb, alpha float64) {
	cv.shape(cx-r-spread*3, cy-r-spread*3, cx+r+spread*3, cy+r+spread*3, c, alpha, func(x, y float64) float64 {
		d := (math.Hypot(x-cx, y-cy) - r) / spread
		return math.Exp(-d * d)
	})
}

func (cv *canvas) line(x0, y0, x1, y1, thick float64, c rgb, alpha float64) {
	minX, maxX := math.Min(x0, x1)-thick, math.Max(x0, x1)+thick
	minY, maxY := math.Min(y0, y1)-thick, math.Max(y0, y1)+thick
	dx, dy := x1-x0, y1-y0
	l2 := dx*dx + dy*dy
	cv.shape(minX, minY, maxX, maxY, c, alpha, func(x, y float64) float64 {
		t := 0.0
		if l2 > 0 {
			t = math.Max(0, math.Min(1, ((x-x0)*dx+(y-y0)*dy)/l2))
		}
		return edge(math.Hypot(x-(x0+t*dx), y-(y0+t*dy)) - thick/2)
	})
}

func (cv *canvas) roundRect(x, y, w, h, r float64, c rgb, alpha float64) {
	cv.shape(x-1, y-1, x+w+1, y+h+1, c, alpha, func(px, py float64) float64 {
		qx := math.Abs(px-(x+w/2)) - (w/2 - r)
		qy := math.Abs(py-(y+h/2)) - (h/2 - r)
		d := math.Hypot(math.Max(qx, 0), math.Max(qy, 0)) + math.Min(math.Max(qx, qy), 0) - r
		return edge(d)
	})
}

// textMask is white-on-black text coverage, one byte per pixel.
type textMask struct {
	w, h int
	a    []byte
}

func (cv *canvas) text(m *textMask, x, y int, c rgb, alpha float64) {
	if m == nil {
		return
	}
	for j := 0; j < m.h; j++ {
		for i := 0; i < m.w; i++ {
			if k := m.a[j*m.w+i]; k > 0 {
				cv.blend(x+i, y+j, c, float64(k)/255*alpha)
			}
		}
	}
}

var (
	ink   = rgb{11, 14, 20}
	white = rgb{255, 255, 255}
)

func markerSize(scale float64) int { return int(math.Round(60 * scale)) }

// drawMarker draws a clicker's target. The window's center pixel is the exact click spot.
func drawMarker(scale float64, col rgb, label *textMask, dim bool) *canvas {
	n := markerSize(scale)
	cv := newCanvas(n, n)
	c := float64(n) / 2
	s := scale
	a := 1.0
	if dim {
		a = 0.45
	}
	cv.disc(c, c, 19*s, ink, 0.18*a) // faint fill so the whole target can be grabbed
	cv.ring(c, c, 18*s, 6*s, ink, 0.45*a)
	cv.glow(c, c, 18*s, 3.2*s, col, 0.55*a)
	cv.ring(c, c, 18*s, 2.6*s, col, a)
	for _, d := range [][2]float64{{1, 0}, {-1, 0}, {0, 1}, {0, -1}} {
		x0, y0 := c+d[0]*6*s, c+d[1]*6*s
		x1, y1 := c+d[0]*12.5*s, c+d[1]*12.5*s
		cv.line(x0, y0, x1, y1, 3.6*s, ink, 0.6*a)
		cv.line(x0, y0, x1, y1, 1.6*s, white, a)
	}
	cv.disc(c, c, 2.8*s, ink, 0.7*a)
	cv.disc(c, c, 1.7*s, white, a)
	// number badge, top-right
	bx, by, br := c+17*s, c-17*s, 8.5*s
	cv.disc(bx, by, br+1.4*s, ink, 0.8*a)
	cv.disc(bx, by, br, col, a)
	if label != nil {
		cv.text(label, int(math.Round(bx-float64(label.w)/2)), int(math.Round(by-float64(label.h)/2)), ink, a)
	}
	return cv
}

// drawHUD draws the "running" pill badge: colored dot + text.
func drawHUD(scale float64, col rgb, label *textMask) *canvas {
	s := scale
	h := int(math.Round(36 * s))
	pad := 14 * s
	dot := 5 * s
	tw := 0
	if label != nil {
		tw = label.w
	}
	w := int(math.Round(pad + dot*2 + 10*s + float64(tw) + pad))
	cv := newCanvas(w, h)
	fh := float64(h)
	cv.roundRect(0.5, 0.5, float64(w)-1, fh-1, fh/2-0.5, ink, 0.92)
	cv.shape(0, 0, float64(w), fh, col, 0.85, func(px, py float64) float64 { // 1px border
		qx := math.Abs(px-float64(w)/2) - (float64(w)/2 - fh/2)
		qy := math.Abs(py-fh/2) - 0
		d := math.Hypot(math.Max(qx, 0), math.Max(qy, 0)) + math.Min(math.Max(qx, qy), 0) - (fh/2 - 1)
		return edge(math.Abs(d) - 0.6*s)
	})
	cx := pad + dot
	cv.glow(cx, fh/2, dot*0.6, 3*s, col, 0.6)
	cv.disc(cx, fh/2, dot, col, 1)
	if label != nil {
		cv.text(label, int(math.Round(cx+dot+10*s)), (h-label.h)/2, white, 1)
	}
	return cv
}
