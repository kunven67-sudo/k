package main

// Stickers shared by ALTS (the chat-box picker) and ALTS Clipboard (Win+V), all in %LOCALAPPDATA%\ALTS\clip:
//   favs.json          favorites: both apps read and write it (small, always rewritten whole)
//   giphy\<id>.gif     GIPHY stickers you kept (ALTS downloads them; ALTS Clipboard only reads files)
//   giphy\giphy.json   their names, newest first
//   stickers\*.png     your own stickers (ALTS Clipboard's ☺ button, and "+ Your pics" in the picker)

import (
	"bytes"
	"encoding/json"
	"errors"
	"image"
	_ "image/gif" // "+ Your pics" and kept GIPHY stickers
	_ "image/jpeg"
	_ "image/png"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

// ---------------------------------------------------------------- favorites

type favStore struct {
	Favs []string `json:"favs"` // "kind:file", newest first
}

var stickerKinds = map[string]bool{"meme": true, "mine": true, "giphy": true}

func favKey(kind, file string) string { return kind + ":" + file }

func loadFavs(clipDir string) []string {
	var s favStore
	if b, err := os.ReadFile(filepath.Join(clipDir, "favs.json")); err == nil {
		json.Unmarshal(b, &s)
	}
	out := s.Favs[:0:0]
	for _, k := range s.Favs {
		if kind, file, ok := strings.Cut(k, ":"); ok && stickerKinds[kind] && plainFile(file) {
			out = append(out, k)
		}
	}
	return out
}

// plainFile: a file name with no folder in it (names come from the page).
func plainFile(s string) bool {
	return s != "" && len(s) < 120 && !strings.ContainsAny(s, `/\:*?"<>|`) && !strings.HasPrefix(s, ".")
}

// setFav turns one on (it goes to the front) or off. Read, change, write: both apps do this.
func setFav(clipDir, kind, file string, on bool) error {
	if !stickerKinds[kind] || !plainFile(file) {
		return errors.New("bad sticker")
	}
	k := favKey(kind, file)
	out := []string{}
	if on {
		out = append(out, k)
	}
	for _, x := range loadFavs(clipDir) {
		if x != k {
			out = append(out, x)
		}
	}
	if len(out) > 500 {
		out = out[:500]
	}
	return writeJSONFile(filepath.Join(clipDir, "favs.json"), favStore{out})
}

// writeJSONFile writes the whole file or nothing (another app may read it at any moment).
func writeJSONFile(path string, v any) error {
	b, err := json.MarshalIndent(v, "", " ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// ---------------------------------------------------------------- GIPHY

type giphyKept struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	File string `json:"file"`
	At   int64  `json:"at"`
}

type giphyIndex struct {
	List []giphyKept `json:"list"`
}

var giphyFileRe = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}\.(gif|webp)$`)

func giphyFile(s string) (string, bool) { return s, giphyFileRe.MatchString(s) }

func loadGiphy(dir string) giphyIndex {
	var x giphyIndex
	if b, err := os.ReadFile(filepath.Join(dir, "giphy.json")); err == nil {
		json.Unmarshal(b, &x)
	}
	out := x.List[:0:0]
	for _, g := range x.List {
		if _, ok := giphyFile(g.File); ok {
			out = append(out, g)
		}
	}
	x.List = out
	return x
}

func cleanID(s string) string {
	b := strings.Builder{}
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			b.WriteRune(r)
		}
	}
	out := b.String()
	if len(out) > 64 {
		out = out[:64]
	}
	return out
}

// keepGiphy saves a GIPHY sticker for good (newest first, at most 300; the oldest go).
func keepGiphy(dir, id, name string, data []byte) (giphyKept, error) {
	id = cleanID(id)
	if id == "" {
		return giphyKept{}, errors.New("bad id")
	}
	ext := ""
	switch {
	case bytes.HasPrefix(data, []byte("GIF87a")) || bytes.HasPrefix(data, []byte("GIF89a")):
		ext = ".gif"
	case len(data) > 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP":
		ext = ".webp"
	default:
		return giphyKept{}, errors.New("not a GIF")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return giphyKept{}, err
	}
	g := giphyKept{ID: id, Name: strings.TrimSpace(name), File: id + ext, At: time.Now().Unix()}
	if g.Name == "" {
		g.Name = "sticker"
	}
	if err := os.WriteFile(filepath.Join(dir, g.File), data, 0o644); err != nil {
		return giphyKept{}, err
	}
	// a small still picture for the grids (the moving one can be a few MB)
	if img, _, err := image.Decode(bytes.NewReader(data)); err == nil {
		os.WriteFile(filepath.Join(dir, id+".thumb.png"), encodePNG(thumb(img, 144)), 0o644)
	}
	x := loadGiphy(dir)
	list := []giphyKept{g}
	for _, o := range x.List {
		if o.ID != id {
			list = append(list, o)
		}
	}
	for len(list) > 300 {
		old := list[len(list)-1].File
		os.Remove(filepath.Join(dir, old))
		os.Remove(filepath.Join(dir, strings.TrimSuffix(old, filepath.Ext(old))+".thumb.png"))
		list = list[:len(list)-1]
	}
	return g, writeJSONFile(filepath.Join(dir, "giphy.json"), giphyIndex{list})
}

func dropGiphy(dir, file string) {
	if _, ok := giphyFile(file); !ok {
		return
	}
	x := loadGiphy(dir)
	out := x.List[:0:0]
	for _, g := range x.List {
		if g.File != file {
			out = append(out, g)
		}
	}
	os.Remove(filepath.Join(dir, file))
	os.Remove(filepath.Join(dir, strings.TrimSuffix(file, filepath.Ext(file))+".thumb.png"))
	writeJSONFile(filepath.Join(dir, "giphy.json"), giphyIndex{out})
}

type giphyHit struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Still string `json:"still"` // small still picture, for the grid
	Send  string `json:"url"`   // the moving one, to send
}

var giphyTitleTail = regexp.MustCompile(`(?i)\s*(GIF|Sticker)\s*(by .*)?$`)

// parseGiphy reads a GIPHY search answer.
func parseGiphy(body []byte) []giphyHit {
	type img struct {
		URL string `json:"url"`
	}
	var r struct {
		Data []struct {
			ID     string         `json:"id"`
			Title  string         `json:"title"`
			Images map[string]img `json:"images"`
		} `json:"data"`
	}
	if json.Unmarshal(body, &r) != nil {
		return nil
	}
	pick := func(m map[string]img, keys ...string) string {
		for _, k := range keys {
			if u := m[k].URL; giphyHost(u) {
				return u
			}
		}
		return ""
	}
	out := []giphyHit{}
	for _, d := range r.Data {
		id := cleanID(d.ID)
		still := pick(d.Images, "fixed_width_still", "480w_still", "fixed_width")
		send := pick(d.Images, "downsized", "fixed_width", "original")
		if id == "" || still == "" || send == "" {
			continue
		}
		name := strings.TrimSpace(giphyTitleTail.ReplaceAllString(d.Title, ""))
		if name == "" {
			name = "sticker"
		}
		out = append(out, giphyHit{ID: "giphy-" + id, Name: name, Still: still, Send: send})
	}
	return out
}

// giphyHost: only GIPHY's own picture servers (a link from the page is never fetched blindly).
func giphyHost(link string) bool {
	u, err := url.Parse(link)
	if err != nil || u.Scheme != "https" {
		return false
	}
	h := strings.ToLower(u.Hostname())
	return h == "giphy.com" || strings.HasSuffix(h, ".giphy.com")
}

func giphySearchURL(kind, key, q string) string {
	return "https://api.giphy.com/v1/" + kind + "/search?api_key=" + url.QueryEscape(key) + "&q=" + url.QueryEscape(q) + "&limit=24&rating=pg-13"
}

// ---------------------------------------------------------------- your own pictures

// newMine: pictures in the stickers folder that the list doesn't have yet (added by "+ Your pics" in
// ALTS while ALTS Clipboard owns the list), newest first.
func newMine(mineDir string, known []string) []string {
	have := map[string]bool{}
	for _, k := range known {
		have[k] = true
	}
	type f struct {
		name string
		at   time.Time
	}
	found := []f{}
	ents, _ := os.ReadDir(mineDir)
	for _, e := range ents {
		n := e.Name()
		if e.IsDir() || have[n] {
			continue
		}
		if _, ok := stickerName(n); !ok {
			continue
		}
		if info, err := e.Info(); err == nil {
			found = append(found, f{n, info.ModTime()})
		}
	}
	sort.Slice(found, func(i, j int) bool { return found[i].at.After(found[j].at) })
	out := []string{}
	for _, x := range found {
		out = append(out, x.name)
	}
	return out
}

// stickerFromPicture turns any picture into a sticker file: PNG, at most 512 px (clip.go's thumb + encodePNG).
func stickerFromPicture(raw []byte) ([]byte, error) {
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, errors.New("not a picture ALTS can read (PNG, JPG or GIF)")
	}
	if b := img.Bounds(); b.Dx() <= 0 || b.Dy() <= 0 {
		return nil, errors.New("empty picture")
	}
	return encodePNG(thumb(img, 512)), nil
}
