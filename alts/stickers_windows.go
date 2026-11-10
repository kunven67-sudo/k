//go:build windows && !clip

package main

// The chat-box picker's sticker extras (1.7.0): GIPHY search (free key), keeping a GIPHY sticker,
// and "+ Your pics". Favorites and the shared folders are in stickers.go.

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

func (a *App) giphyKeyFile() string { return filepath.Join(a.base, "giphy-key.txt") }

func (a *App) giphyKey() string {
	b, _ := os.ReadFile(a.giphyKeyFile())
	return strings.TrimSpace(string(b))
}

func (a *App) setGiphyKey(k string) {
	k = strings.TrimSpace(k)
	if len(k) > 100 || strings.ContainsAny(k, " \r\n\t\"'<>") {
		a.toast("That doesn't look like a GIPHY key.")
		return
	}
	if k == "" {
		os.Remove(a.giphyKeyFile())
		return
	}
	os.WriteFile(a.giphyKeyFile(), []byte(k), 0o600)
}

// evalOn runs js in account id's page, from any thread (the work happens on the message loop).
func (a *App) evalOn(id, js string) {
	a.post(func() {
		if v := a.views[id]; v != nil && onClaude(v) {
			v.c.Eval(js)
		}
	})
}

// giphySearch: stickers first (see-through ones), normal gifs too when there are few. Each result's
// still picture is fetched here and handed over as a data link (claude.ai's page can't load GIPHY's
// pictures itself).
func (a *App) giphySearch(id, q string) {
	q = strings.TrimSpace(q)
	key := a.giphyKey()
	if q == "" || len(q) > 100 {
		return
	}
	if key == "" {
		a.evalOn(id, jsCall("giphyResults", map[string]any{"q": q, "error": "no key"}))
		return
	}
	go func() {
		hits := []giphyHit{}
		var lastErr error
		for _, kind := range []string{"stickers", "gifs"} {
			if len(hits) >= 8 {
				break
			}
			b, err := webGet(giphySearchURL(kind, key, q))
			if err != nil {
				lastErr = err
				continue
			}
			for _, h := range parseGiphy(b) {
				dup := false
				for _, o := range hits {
					dup = dup || o.ID == h.ID
				}
				if !dup {
					hits = append(hits, h)
				}
			}
		}
		if len(hits) == 0 && lastErr != nil {
			msg := lastErr.Error()
			if strings.Contains(msg, "401") || strings.Contains(msg, "403") {
				msg = "GIPHY didn't take the key. Check it in the picker (Stickers > GIPHY key)."
			}
			a.evalOn(id, jsCall("giphyResults", map[string]any{"q": q, "error": msg}))
			return
		}
		type out struct {
			ID    string `json:"id"`
			Name  string `json:"name"`
			Thumb string `json:"thumb"`
			URL   string `json:"url"`
		}
		res := make([]out, len(hits))
		var wg sync.WaitGroup
		sem := make(chan struct{}, 8)
		for i, h := range hits {
			wg.Add(1)
			go func(i int, h giphyHit) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()
				if b, err := webGet(h.Still); err == nil && len(b) < 2<<20 {
					res[i] = out{h.ID, h.Name, "data:image/gif;base64," + base64.StdEncoding.EncodeToString(b), h.Send}
				}
			}(i, h)
		}
		wg.Wait()
		list := []out{}
		for _, r := range res {
			if r.Thumb != "" {
				list = append(list, r)
			}
		}
		a.evalOn(id, jsCall("giphyResults", map[string]any{"q": q, "list": list}))
	}()
}

// giphyTake downloads one: keep=true saves it with your stickers (Win+V shows it too), else it goes
// straight into the chat.
func (a *App) giphyTake(id, gid, name, link string, keep bool) {
	if !giphyHost(link) {
		return
	}
	go func() {
		b, err := webGet(link)
		if err != nil {
			a.evalOn(id, jsCall("stickerFile", nil))
			return
		}
		if keep {
			if _, err := keepGiphy(filepath.Join(a.clipDir(), "giphy"), gid, name, b); err != nil {
				a.post(func() { a.toast("Couldn't keep that one: " + err.Error()) })
				return
			}
			a.post(func() {
				if v := a.views[id]; v != nil && onClaude(v) {
					v.c.Eval(jsCall("emojiData", a.emojiData()))
				}
			})
			return
		}
		typ, ext := "image/gif", ".gif"
		if len(b) > 12 && string(b[:4]) == "RIFF" {
			typ, ext = "image/webp", ".webp"
		}
		a.evalOn(id, jsCall("stickerFile", map[string]string{"name": "sticker" + ext, "type": typ, "b64": base64.StdEncoding.EncodeToString(b)}))
	}()
}

// ---------------------------------------------------------------- "+ Your pics"

var (
	comdlg32          = windows.NewLazySystemDLL("comdlg32.dll")
	pGetOpenFileNameW = comdlg32.NewProc("GetOpenFileNameW")
)

type openFileNameW struct {
	StructSize    uint32
	Owner         uintptr
	Instance      uintptr
	Filter        *uint16
	CustomFilter  *uint16
	MaxCustFilter uint32
	FilterIndex   uint32
	File          *uint16
	MaxFile       uint32
	FileTitle     *uint16
	MaxFileTitle  uint32
	InitialDir    *uint16
	Title         *uint16
	Flags         uint32
	FileOffset    uint16
	FileExtension uint16
	DefExt        *uint16
	CustData      uintptr
	Hook          uintptr
	TemplateName  *uint16
	Reserved      uintptr
	Reserved2     uint32
	FlagsEx       uint32
}

// pickPicture shows Windows' own Open box (pictures only). "" if cancelled.
func (a *App) pickPicture() string {
	filter := []uint16{}
	for _, part := range []string{"Pictures (PNG, JPG, GIF)", "*.png;*.jpg;*.jpeg;*.gif", "All files", "*.*"} {
		filter = append(filter, windows.StringToUTF16(part)...) // each ends with a 0
	}
	filter = append(filter, 0)
	buf := make([]uint16, 1024)
	title := windows.StringToUTF16Ptr("Pick a picture to make a sticker")
	ofn := openFileNameW{
		Owner:   a.main,
		Filter:  &filter[0],
		File:    &buf[0],
		MaxFile: uint32(len(buf)),
		Title:   title,
		Flags:   0x00001000 | 0x00000800 | 0x00080000 | 0x00000008, // file + path must exist, explorer look, keep the current folder
	}
	ofn.StructSize = uint32(unsafe.Sizeof(ofn))
	if r, _, _ := pGetOpenFileNameW.Call(uintptr(unsafe.Pointer(&ofn))); r == 0 {
		return ""
	}
	return windows.UTF16ToString(buf)
}

func (a *App) addStickerPicture(id string) {
	p := a.pickPicture()
	if p == "" {
		return
	}
	st, err := os.Stat(p)
	if err != nil || st.Size() > 40<<20 {
		a.toast("That picture is too big (40 MB max).")
		return
	}
	raw, err := os.ReadFile(p)
	if err == nil {
		raw, err = stickerFromPicture(raw)
	}
	if err != nil {
		a.toast("Couldn't make a sticker: " + err.Error())
		return
	}
	dir := filepath.Join(a.clipDir(), "stickers")
	os.MkdirAll(dir, 0o755)
	name := "s" + itoa(int(time.Now().Unix())) + "p.png"
	if err := os.WriteFile(filepath.Join(dir, name), raw, 0o644); err != nil {
		a.toast("Couldn't save the sticker: " + err.Error())
		return
	}
	if v := a.views[id]; v != nil && onClaude(v) {
		v.c.Eval(jsCall("emojiData", a.emojiData()))
	}
}
