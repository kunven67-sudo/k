package main

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"testing"
	"time"
)

func screen(c uint8) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, 1920, 1080))
	for i := 0; i < len(img.Pix); i += 4 {
		img.Pix[i], img.Pix[i+1], img.Pix[i+2], img.Pix[i+3] = c, 255-c, 40, 255
	}
	return img
}

func TestFitWidthAverages(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 4, 2))
	for x := 0; x < 4; x++ {
		for y := 0; y < 2; y++ {
			v := uint8(0)
			if x%2 == 1 {
				v = 200
			}
			src.Set(x, y, color.RGBA{v, v, v, 255})
		}
	}
	out := fitWidth(src, 2)
	if out.Bounds().Dx() != 2 || out.Bounds().Dy() != 1 {
		t.Fatalf("size = %v", out.Bounds())
	}
	if r := out.RGBAAt(0, 0).R; r != 100 {
		t.Fatalf("average = %d, want 100", r)
	}
	if fitWidth(src, 10).Bounds().Dx() != 4 {
		t.Fatal("grew a picture")
	}
}

func TestEyesTakeOnlyNewStuff(t *testing.T) {
	var e eyes
	t0 := time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC)
	for i := 0; i < 25; i++ { // 12.5 minutes of pictures, every 30 s
		e.add(screen(uint8(i*10)), t0.Add(time.Duration(i)*eyesEvery))
	}
	if len(e.frames) != 21 { // only the last 10 minutes are kept
		t.Fatalf("kept %d pictures", len(e.frames))
	}
	got := e.take(t0.Add(13 * time.Minute))
	if len(got) != 2 || got[0].Name != "screen-now.jpg" || got[1].Name != "screen-last-minutes.jpg" {
		t.Fatalf("first take = %v", names(got))
	}
	now, _ := jpeg.Decode(bytes.NewReader(got[0].B64))
	if now.Bounds().Dx() != nowWidth {
		t.Fatalf("now width = %d", now.Bounds().Dx())
	}
	g, _ := jpeg.Decode(bytes.NewReader(got[1].B64))
	if g.Bounds().Dx() != 4*tileWidth+5*6 {
		t.Fatalf("grid width = %d", g.Bounds().Dx())
	}
	if again := e.take(t0.Add(14 * time.Minute)); len(again) != 0 {
		t.Fatalf("sent the same pictures twice: %v", names(again))
	}
	e.add(screen(9), t0.Add(14*time.Minute+10*time.Second))
	if one := e.take(t0.Add(15 * time.Minute)); len(one) != 1 || one[0].Name != "screen-now.jpg" {
		t.Fatalf("one new picture = %v", names(one))
	}
	clip := []frame{}
	for i := 0; i < 10; i++ {
		clip = append(clip, frame{t0.Add(time.Duration(i) * 500 * time.Millisecond), fitWidth(screen(uint8(i*20)), 384)})
	}
	e.setClip(clip, t0.Add(16*time.Minute))
	if c := e.take(t0.Add(17 * time.Minute)); len(c) != 1 || c[0].Name != "record-5-seconds.jpg" {
		t.Fatalf("clip = %v", names(c))
	}
}

func names(f []eyeFile) []string {
	var out []string
	for _, x := range f {
		out = append(out, x.Name)
	}
	return out
}
