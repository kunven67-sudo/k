package main

// ALTS Clipboard: the part that doesn't need Windows (history list, pictures), so it can be tested anywhere.

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	clipMaxItems  = 200     // not counting pinned ones
	clipMaxPics   = 40      // pictures kept (not counting pinned ones)
	clipMaxText   = 1 << 20 // 1 MB of text per item
	clipThumbSide = 220
)

type clipItem struct {
	ID     string `json:"id"`
	Kind   string `json:"kind"` // "text" or "pic"
	Text   string `json:"text,omitempty"`
	File   string `json:"file,omitempty"` // picture: <id>.png inside the clip folder
	W      int    `json:"w,omitempty"`
	H      int    `json:"h,omitempty"`
	Hash   string `json:"hash"`
	Pinned bool   `json:"pinned,omitempty"`
	At     int64  `json:"at"`
}

type clipStore struct {
	Items    []clipItem `json:"items"`
	Stickers []string   `json:"stickers,omitempty"` // their own sticker files (in stickers\), newest first
	NoStart  bool       `json:"noStart,omitempty"`  // don't start with Windows
}

func hashOf(kind string, b []byte) string {
	h := sha256.Sum256(append([]byte(kind+":"), b...))
	return hex.EncodeToString(h[:12])
}

func loadClip(path string) clipStore {
	var s clipStore
	if b, err := os.ReadFile(path); err == nil {
		json.Unmarshal(b, &s)
	}
	return s
}

func saveClip(path string, s clipStore) error {
	b, err := json.Marshal(s)
	if err != nil {
		return err
	}
	return writeFileAtomic(path, b)
}

func (s *clipStore) find(id string) int {
	for i, it := range s.Items {
		if it.ID == id {
			return i
		}
	}
	return -1
}

// add puts a new copy at the top. Copying the same thing again moves it to the top
// (and keeps its pin). Returns the files of pictures that fell off the end.
func (s *clipStore) add(it clipItem) (gone []string) {
	for i, old := range s.Items {
		if old.Hash == it.Hash {
			it.Pinned = old.Pinned
			if it.File != old.File && old.File != "" {
				if it.File == "" {
					it.File, it.W, it.H = old.File, old.W, old.H
				} else {
					gone = append(gone, old.File)
				}
			}
			it.ID = old.ID
			s.Items = append(s.Items[:i], s.Items[i+1:]...)
			break
		}
	}
	s.Items = append([]clipItem{it}, s.Items...)
	return append(gone, s.trim()...)
}

// trim drops the oldest unpinned items past the limits.
func (s *clipStore) trim() (gone []string) {
	n, pics := 0, 0
	keep := s.Items[:0]
	for _, it := range s.Items {
		if !it.Pinned {
			n++
			if it.Kind == "pic" {
				pics++
			}
			if n > clipMaxItems || (it.Kind == "pic" && pics > clipMaxPics) {
				if it.File != "" {
					gone = append(gone, it.File)
				}
				continue
			}
		}
		keep = append(keep, it)
	}
	s.Items = keep
	return gone
}

func (s *clipStore) remove(id string) string {
	i := s.find(id)
	if i < 0 {
		return ""
	}
	f := s.Items[i].File
	s.Items = append(s.Items[:i], s.Items[i+1:]...)
	return f
}

// clear removes everything that isn't pinned.
func (s *clipStore) clear() (gone []string) {
	keep := s.Items[:0]
	for _, it := range s.Items {
		if it.Pinned {
			keep = append(keep, it)
		} else if it.File != "" {
			gone = append(gone, it.File)
		}
	}
	s.Items = keep
	return gone
}

func newClipID() string { return "c" + itoa(int(time.Now().UnixNano()%1e15)) }

// cleanClipText: keeps real text, drops empty/whitespace-only copies and caps the size.
func cleanClipText(t string) (string, bool) {
	t = strings.ReplaceAll(t, "\x00", "")
	if strings.TrimSpace(t) == "" {
		return "", false
	}
	if len(t) > clipMaxText {
		t = t[:clipMaxText]
		for len(t) > 0 && !utf8Start(t[len(t)-1]) {
			t = t[:len(t)-1]
		}
		if len(t) > 0 {
			t = t[:len(t)-1]
		}
	}
	return t, true
}

func utf8Start(b byte) bool { return b < 0x80 || b >= 0xC0 }

// ---------- pictures ----------

const biRGB, biBitfields = 0, 3

// dibToImage reads a Windows CF_DIB / CF_DIBV5 block (header + pixels).
func dibToImage(b []byte) (image.Image, error) {
	if len(b) < 40 {
		return nil, errors.New("too small")
	}
	le := binary.LittleEndian
	hs := int(le.Uint32(b[0:]))
	w := int(int32(le.Uint32(b[4:])))
	h := int(int32(le.Uint32(b[8:])))
	bpp := int(le.Uint16(b[14:]))
	comp := le.Uint32(b[16:])
	used := int(le.Uint32(b[32:]))
	if hs < 40 || hs > len(b) || w <= 0 || h == 0 || w > 20000 || h > 20000 || h < -20000 {
		return nil, errors.New("bad header")
	}
	topDown := h < 0
	if topDown {
		h = -h
	}
	off := hs
	rm, gm, bm, am := uint32(0xFF0000), uint32(0xFF00), uint32(0xFF), uint32(0)
	if comp == biBitfields {
		if hs == 40 {
			if len(b) < 52 {
				return nil, errors.New("no masks")
			}
			rm, gm, bm = le.Uint32(b[40:]), le.Uint32(b[44:]), le.Uint32(b[48:])
			off = 52
		} else if hs >= 56 {
			rm, gm, bm, am = le.Uint32(b[40:]), le.Uint32(b[44:]), le.Uint32(b[48:]), le.Uint32(b[52:])
		}
	} else if comp != biRGB {
		return nil, errors.New("compressed pictures aren't supported")
	}
	var pal []color.NRGBA
	if bpp <= 8 {
		n := used
		if n == 0 {
			n = 1 << bpp
		}
		if off+n*4 > len(b) {
			return nil, errors.New("bad palette")
		}
		for i := 0; i < n; i++ {
			p := b[off+i*4:]
			pal = append(pal, color.NRGBA{p[2], p[1], p[0], 255})
		}
		off += n * 4
	} else if bpp != 16 && bpp != 24 && bpp != 32 {
		return nil, errors.New("unsupported bit depth")
	}
	if bpp == 16 && comp == biRGB {
		rm, gm, bm = 0x7C00, 0x03E0, 0x001F
	}
	stride := ((w*bpp + 31) / 32) * 4
	if off+stride*h > len(b) {
		return nil, errors.New("picture cut short")
	}
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	anyAlpha := false
	for y := 0; y < h; y++ {
		row := b[off+y*stride:]
		dy := h - 1 - y
		if topDown {
			dy = y
		}
		for x := 0; x < w; x++ {
			var c color.NRGBA
			switch bpp {
			case 1, 4, 8:
				bit := x * bpp
				v := int(row[bit/8]>>(8-bpp-bit%8)) & (1<<bpp - 1)
				if v < len(pal) {
					c = pal[v]
				}
			case 24:
				p := row[x*3:]
				c = color.NRGBA{p[2], p[1], p[0], 255}
			case 16, 32:
				var v uint32
				if bpp == 16 {
					v = uint32(le.Uint16(row[x*2:]))
				} else {
					v = le.Uint32(row[x*4:])
				}
				c = color.NRGBA{mask8(v, rm), mask8(v, gm), mask8(v, bm), 255}
				if bpp == 32 {
					a := uint8(v >> 24)
					if am != 0 {
						a = mask8(v, am)
					}
					if a != 0 {
						anyAlpha = true
					}
					c.A = a
				}
			}
			img.SetNRGBA(x, dy, c)
		}
	}
	if bpp == 32 && !anyAlpha { // most apps leave the 4th byte at 0 = no see-through at all
		for i := 3; i < len(img.Pix); i += 4 {
			img.Pix[i] = 255
		}
	}
	return img, nil
}

func mask8(v, m uint32) uint8 {
	if m == 0 {
		return 0
	}
	sh := 0
	for m&1 == 0 {
		m >>= 1
		sh++
	}
	x := (v >> sh) & m
	return uint8(x * 255 / m)
}

// imageToDIB makes a CF_DIB block (32-bit, bottom-up). See-through parts are put on white,
// because most apps that read CF_DIB ignore see-through and would show black there.
func imageToDIB(img image.Image) []byte {
	r := img.Bounds()
	w, h := r.Dx(), r.Dy()
	out := make([]byte, 40+w*h*4)
	le := binary.LittleEndian
	le.PutUint32(out[0:], 40)
	le.PutUint32(out[4:], uint32(w))
	le.PutUint32(out[8:], uint32(h))
	le.PutUint16(out[12:], 1)
	le.PutUint16(out[14:], 32)
	le.PutUint32(out[20:], uint32(w*h*4))
	px := out[40:]
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			c := color.NRGBAModel.Convert(img.At(r.Min.X+x, r.Min.Y+y)).(color.NRGBA)
			a := int(c.A)
			blend := func(v uint8) byte { return byte((int(v)*a + 255*(255-a)) / 255) }
			i := ((h-1-y)*w + x) * 4
			px[i], px[i+1], px[i+2], px[i+3] = blend(c.B), blend(c.G), blend(c.R), 255
		}
	}
	return out
}

// thumb shrinks a picture to fit side x side (box average, good enough for a preview).
func thumb(img image.Image, side int) image.Image {
	r := img.Bounds()
	w, h := r.Dx(), r.Dy()
	if w <= side && h <= side {
		return img
	}
	tw, th := side, h*side/w
	if h > w {
		tw, th = w*side/h, side
	}
	tw, th = max(tw, 1), max(th, 1)
	src := image.NewNRGBA(r)
	draw.Draw(src, r, img, r.Min, draw.Src)
	dst := image.NewNRGBA(image.Rect(0, 0, tw, th))
	for y := 0; y < th; y++ {
		y0, y1 := y*h/th, max((y+1)*h/th, y*h/th+1)
		for x := 0; x < tw; x++ {
			x0, x1 := x*w/tw, max((x+1)*w/tw, x*w/tw+1)
			var sr, sg, sb, sa, n int
			for yy := y0; yy < y1; yy += max(1, (y1-y0)/4) {
				for xx := x0; xx < x1; xx += max(1, (x1-x0)/4) {
					i := yy*src.Stride + xx*4
					a := int(src.Pix[i+3])
					sr += int(src.Pix[i]) * a
					sg += int(src.Pix[i+1]) * a
					sb += int(src.Pix[i+2]) * a
					sa += a
					n++
				}
			}
			o := dst.PixOffset(x, y)
			if sa > 0 {
				dst.Pix[o], dst.Pix[o+1], dst.Pix[o+2] = uint8(sr/sa), uint8(sg/sa), uint8(sb/sa)
			}
			dst.Pix[o+3] = uint8(sa / n)
		}
	}
	return dst
}

func encodePNG(img image.Image) []byte {
	var b bytes.Buffer
	(&png.Encoder{CompressionLevel: png.BestSpeed}).Encode(&b, img)
	return b.Bytes()
}

// savePic writes the picture (and its preview) into dir and returns the new history item.
func savePic(dir string, img image.Image, raw []byte) (clipItem, error) {
	id := newClipID()
	if raw == nil {
		raw = encodePNG(img)
	}
	it := clipItem{ID: id, Kind: "pic", File: id + ".png", W: img.Bounds().Dx(), H: img.Bounds().Dy(), Hash: hashOf("pic", raw), At: time.Now().Unix()}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return it, err
	}
	if err := os.WriteFile(filepath.Join(dir, it.File), raw, 0o644); err != nil {
		return it, err
	}
	os.WriteFile(filepath.Join(dir, id+".thumb.png"), encodePNG(thumb(img, clipThumbSide)), 0o644)
	return it, nil
}

func removePic(dir, file string) {
	if file == "" || strings.ContainsAny(file, `/\`) {
		return
	}
	os.Remove(filepath.Join(dir, file))
	os.Remove(filepath.Join(dir, strings.TrimSuffix(file, ".png")+".thumb.png"))
}

// stickerName keeps a sticker's file name plain (it comes from the page).
func stickerName(s string) (string, bool) {
	if s == "" || strings.ContainsAny(s, `/\:*?"<>|`) || strings.HasPrefix(s, ".") || !strings.HasSuffix(strings.ToLower(s), ".png") {
		return "", false
	}
	return s, true
}
