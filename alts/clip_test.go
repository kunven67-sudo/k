package main

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestClipAddDedupePinTrim(t *testing.T) {
	var s clipStore
	s.add(clipItem{ID: "a", Kind: "text", Text: "hi", Hash: hashOf("text", []byte("hi"))})
	s.add(clipItem{ID: "b", Kind: "text", Text: "yo", Hash: hashOf("text", []byte("yo"))})
	s.Items[1].Pinned = true // "hi"
	s.add(clipItem{ID: "c", Kind: "text", Text: "hi", Hash: hashOf("text", []byte("hi"))})
	if len(s.Items) != 2 || s.Items[0].Text != "hi" || !s.Items[0].Pinned || s.Items[0].ID != "a" {
		t.Fatalf("dedupe/pin: %+v", s.Items)
	}
	for i := 0; i < clipMaxItems+20; i++ {
		s.add(clipItem{ID: itoa(i), Kind: "text", Hash: hashOf("text", []byte(itoa(i)))})
	}
	if len(s.Items) != clipMaxItems+1 || s.find("a") < 0 {
		t.Fatalf("trim kept %d, pinned there=%v", len(s.Items), s.find("a") >= 0)
	}
	var gone []string
	for i := 0; i < clipMaxPics+3; i++ {
		gone = append(gone, s.add(clipItem{ID: "p" + itoa(i), Kind: "pic", File: "p" + itoa(i) + ".png", Hash: hashOf("pic", []byte(itoa(i)))})...)
	}
	if len(gone) != 3 || gone[0] != "p0.png" {
		t.Fatalf("pics gone %v", gone)
	}
	g := s.clear()
	if len(s.Items) != 1 || len(g) != clipMaxPics {
		t.Fatalf("clear left %d, gone %d", len(s.Items), len(g))
	}
}

func TestCleanClipText(t *testing.T) {
	if _, ok := cleanClipText(" \n\t "); ok {
		t.Fatal("blank kept")
	}
	big := string(bytes.Repeat([]byte("é"), clipMaxText))
	got, ok := cleanClipText(big)
	if !ok || len(got) > clipMaxText || !utf8Valid(got) {
		t.Fatal("cap broke utf8")
	}
}

func utf8Valid(s string) bool {
	for _, r := range s {
		if r == 0xFFFD {
			return false
		}
	}
	return true
}

func TestDIBRoundTrip(t *testing.T) {
	src := image.NewNRGBA(image.Rect(0, 0, 3, 2))
	src.SetNRGBA(0, 0, color.NRGBA{255, 0, 0, 255})
	src.SetNRGBA(2, 1, color.NRGBA{0, 0, 255, 255})
	src.SetNRGBA(1, 0, color.NRGBA{0, 0, 0, 0}) // see-through -> white
	got, err := dibToImage(imageToDIB(src))
	if err != nil {
		t.Fatal(err)
	}
	at := func(x, y int) color.NRGBA { return got.At(x, y).(color.NRGBA) }
	if at(0, 0) != (color.NRGBA{255, 0, 0, 255}) || at(2, 1) != (color.NRGBA{0, 0, 255, 255}) || at(1, 0) != (color.NRGBA{255, 255, 255, 255}) {
		t.Fatalf("pixels %v %v %v", at(0, 0), at(2, 1), at(1, 0))
	}
}

func TestDIB24TopDown(t *testing.T) {
	// 2x2, 24-bit, top-down (negative height), rows padded to 8 bytes
	b := make([]byte, 40+16)
	put := func(o int, v uint32) { b[o], b[o+1], b[o+2], b[o+3] = byte(v), byte(v>>8), byte(v>>16), byte(v>>24) }
	put(0, 40)
	put(4, 2)
	put(8, uint32(0xFFFFFFFE)) // -2
	b[12], b[14] = 1, 24
	copy(b[40:], []byte{0, 0, 255 /*red*/, 0, 255, 0 /*green*/, 0, 0})
	img, err := dibToImage(b)
	if err != nil {
		t.Fatal(err)
	}
	if c := img.At(0, 0).(color.NRGBA); c.R != 255 || c.G != 0 {
		t.Fatalf("top-left %v", c)
	}
	if _, err := dibToImage(b[:45]); err == nil {
		t.Fatal("cut picture accepted")
	}
}

func TestThumbAndSavePic(t *testing.T) {
	img := image.NewNRGBA(image.Rect(0, 0, 1000, 500))
	for i := range img.Pix {
		img.Pix[i] = 200
	}
	th := thumb(img, clipThumbSide)
	if th.Bounds().Dx() != clipThumbSide || th.Bounds().Dy() != clipThumbSide/2 {
		t.Fatalf("thumb %v", th.Bounds())
	}
	dir := t.TempDir()
	it, err := savePic(dir, img, nil)
	if err != nil || it.W != 1000 {
		t.Fatal(err, it)
	}
	f, _ := os.Open(filepath.Join(dir, it.File))
	if _, err := png.Decode(f); err != nil {
		t.Fatal(err)
	}
	f.Close()
	removePic(dir, it.File)
	if _, err := os.Stat(filepath.Join(dir, it.File)); err == nil {
		t.Fatal("not removed")
	}
	removePic(dir, `..\x.png`) // must not do anything
}

func TestStickerName(t *testing.T) {
	for in, ok := range map[string]bool{"skull.png": true, "a/b.png": false, "..\\x.png": false, ".png": false, "x.exe": false} {
		if _, got := stickerName(in); got != ok {
			t.Errorf("%q = %v", in, got)
		}
	}
}
