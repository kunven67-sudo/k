package main

// Eyes: pictures of the screen that go with your next message, so Claude can see what you see.
// A picture every 30 seconds is kept for 10 minutes, only in memory. When you start typing,
// you get what's new since the last message: the screen right now, a grid of the last
// minutes, and the last "record 5 seconds". No Windows calls in here, so it's tested anywhere.

import (
	"bytes"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"sync"
	"time"

	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
)

const (
	eyesEvery = 30 * time.Second
	eyesKeep  = 10 * time.Minute
	nowWidth  = 1600 // the "right now" picture
	tileWidth = 480  // one picture in a grid
)

type frame struct {
	at  time.Time
	img *image.RGBA
}

type eyeFile struct {
	Name string `json:"name"`
	B64  []byte `json:"b64"` // encoding/json turns []byte into base64
}

type eyes struct {
	mu     sync.Mutex
	frames []frame      // small pictures for the grid, oldest first
	now    *image.RGBA  // the newest picture, bigger
	nowAt  time.Time
	clip   []frame      // the last "record 5 seconds"
	clipAt time.Time
	sent   time.Time    // everything up to here already went with a message
}

// add keeps a new picture of the whole screen. It's called often (so "right now" is fresh),
// but the grid only gets one picture per eyesEvery.
func (e *eyes) add(full *image.RGBA, at time.Time) {
	big := fitWidth(full, nowWidth)
	e.mu.Lock()
	defer e.mu.Unlock()
	e.now, e.nowAt = big, at
	if n := len(e.frames); n > 0 && at.Sub(e.frames[n-1].at) < eyesEvery {
		return
	}
	e.frames = append(e.frames, frame{at, fitWidth(full, tileWidth)})
	cut := 0
	for cut < len(e.frames) && at.Sub(e.frames[cut].at) > eyesKeep {
		cut++
	}
	e.frames = e.frames[cut:]
}

func (e *eyes) setClip(frames []frame, at time.Time) {
	e.mu.Lock()
	e.clip, e.clipAt = frames, at
	e.mu.Unlock()
}

// take hands out what's new since the last message (nothing new = nothing, so no usage is wasted).
func (e *eyes) take(at time.Time) []eyeFile {
	e.mu.Lock()
	var newer []frame
	for _, f := range e.frames {
		if f.at.After(e.sent) {
			newer = append(newer, f)
		}
	}
	now, nowAt := e.now, e.nowAt
	clip, clipAt := e.clip, e.clipAt
	sent := e.sent
	e.sent = at
	e.mu.Unlock()

	var out []eyeFile
	if now != nil && nowAt.After(sent) {
		out = append(out, eyeFile{"screen-now.jpg", jpegBytes(now, 82)})
	}
	if len(newer) >= 2 {
		out = append(out, eyeFile{"screen-last-minutes.jpg", jpegBytes(grid(newer, 4, at), 78)})
	}
	if len(clip) > 0 && clipAt.After(sent) {
		out = append(out, eyeFile{"record-5-seconds.jpg", jpegBytes(grid(clip, 5, time.Time{}), 80)})
	}
	return out
}

// grid puts the pictures in rows, oldest first, each with a little time label.
// ref set = labels like "4 min ago"; zero = labels like "0.5 s" from the first picture.
func grid(frames []frame, cols int, ref time.Time) *image.RGBA {
	if len(frames) < cols {
		cols = len(frames)
	}
	tw := frames[0].img.Bounds().Dx()
	th := frames[0].img.Bounds().Dy()
	rows := (len(frames) + cols - 1) / cols
	gap := 6
	out := image.NewRGBA(image.Rect(0, 0, cols*tw+(cols+1)*gap, rows*th+(rows+1)*gap))
	draw.Draw(out, out.Bounds(), &image.Uniform{color.RGBA{19, 19, 22, 255}}, image.Point{}, draw.Src)
	for i, f := range frames {
		x := gap + (i%cols)*(tw+gap)
		y := gap + (i/cols)*(th+gap)
		r := image.Rect(x, y, x+tw, y+th)
		draw.Draw(out, r, f.img, f.img.Bounds().Min, draw.Src)
		var label string
		if ref.IsZero() {
			label = itoa(int(f.at.Sub(frames[0].at)/time.Millisecond)/100/10) + "." + itoa(int(f.at.Sub(frames[0].at)/time.Millisecond)/100%10) + " s"
		} else {
			label = ago(ref.Sub(f.at))
		}
		tag(out, x+6, y+6, label)
	}
	return out
}

func ago(d time.Duration) string {
	if d < time.Minute {
		return "just now"
	}
	return itoa(int(d/time.Minute)) + " min ago"
}

// tag writes white text on a dark box.
func tag(dst *image.RGBA, x, y int, s string) {
	w := len(s)*7 + 10
	draw.Draw(dst, image.Rect(x, y, x+w, y+20), &image.Uniform{color.RGBA{0, 0, 0, 200}}, image.Point{}, draw.Over)
	d := font.Drawer{Dst: dst, Src: image.White, Face: basicfont.Face7x13, Dot: fixed.P(x+5, y+15)}
	d.DrawString(s)
}

// fitWidth shrinks a picture to w pixels wide (never makes it bigger), averaging the pixels it squeezes.
func fitWidth(src *image.RGBA, w int) *image.RGBA {
	sw, sh := src.Bounds().Dx(), src.Bounds().Dy()
	if sw <= w {
		out := image.NewRGBA(image.Rect(0, 0, sw, sh))
		draw.Draw(out, out.Bounds(), src, src.Bounds().Min, draw.Src)
		return out
	}
	h := max(1, sh*w/sw)
	out := image.NewRGBA(image.Rect(0, 0, w, h))
	ox, oy := src.Bounds().Min.X, src.Bounds().Min.Y
	for y := 0; y < h; y++ {
		y0, y1 := y*sh/h, max(y*sh/h+1, (y+1)*sh/h)
		for x := 0; x < w; x++ {
			x0, x1 := x*sw/w, max(x*sw/w+1, (x+1)*sw/w)
			var r, g, b, n int
			for yy := y0; yy < y1; yy++ {
				row := src.Pix[(oy+yy-src.Rect.Min.Y)*src.Stride:]
				for xx := x0; xx < x1; xx++ {
					p := (ox + xx - src.Rect.Min.X) * 4
					r += int(row[p])
					g += int(row[p+1])
					b += int(row[p+2])
					n++
				}
			}
			q := out.PixOffset(x, y)
			out.Pix[q], out.Pix[q+1], out.Pix[q+2], out.Pix[q+3] = uint8(r/n), uint8(g/n), uint8(b/n), 255
		}
	}
	return out
}

func jpegBytes(img image.Image, q int) []byte {
	var b bytes.Buffer
	jpeg.Encode(&b, img, &jpeg.Options{Quality: q})
	return b.Bytes()
}
