package main

// Meme stickers: the most popular meme pictures from imgflip.com's free public list. They're downloaded
// onto this PC (first start, then every few days); nothing is shipped inside the app.

import (
	"bytes"
	"encoding/json"
	"errors"
	"image"
	"image/jpeg"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const memeAPI = "https://api.imgflip.com/get_memes"

type meme struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	File string `json:"file"` // <id>.jpg or .png in the memes folder
}

type memeIndex struct {
	Updated int64  `json:"updated"`
	Memes   []meme `json:"memes"`
}

var memeIDRe = regexp.MustCompile(`^[A-Za-z0-9]{1,20}$`)

func loadMemes(dir string) memeIndex {
	var x memeIndex
	if b, err := os.ReadFile(filepath.Join(dir, "memes.json")); err == nil {
		json.Unmarshal(b, &x)
	}
	return x
}

func (x memeIndex) stale() bool {
	return len(x.Memes) == 0 || time.Since(time.Unix(x.Updated, 0)) > 72*time.Hour
}

func memeThumb(file string) string { return strings.TrimSuffix(file, path.Ext(file)) + ".thumb.jpg" }

// refreshMemes gets the list and every picture not on this PC yet (plus a small preview of each).
// get downloads one link (passed in so it can be tested without the internet).
func refreshMemes(dir string, get func(link string) ([]byte, error)) (memeIndex, error) {
	b, err := get(memeAPI)
	if err != nil {
		return memeIndex{}, err
	}
	var r struct {
		Success bool `json:"success"`
		Data    struct {
			Memes []struct {
				ID   string `json:"id"`
				Name string `json:"name"`
				URL  string `json:"url"`
			} `json:"memes"`
		} `json:"data"`
	}
	if json.Unmarshal(b, &r) != nil || !r.Success || len(r.Data.Memes) == 0 {
		return memeIndex{}, errors.New("the meme list didn't come")
	}
	os.MkdirAll(dir, 0o755)
	x := memeIndex{Updated: time.Now().Unix()}
	for _, m := range r.Data.Memes {
		ext := strings.ToLower(path.Ext(m.URL))
		if !memeIDRe.MatchString(m.ID) || (ext != ".jpg" && ext != ".png") || !strings.HasPrefix(m.URL, "https://i.imgflip.com/") {
			continue
		}
		file := m.ID + ext
		full := filepath.Join(dir, file)
		if _, err := os.Stat(full); err != nil {
			pic, err := get(m.URL)
			if err != nil || len(pic) > 8<<20 {
				continue
			}
			img, _, err := image.Decode(bytes.NewReader(pic))
			if err != nil {
				continue
			}
			var tb bytes.Buffer
			if jpeg.Encode(&tb, thumb(img, clipThumbSide), &jpeg.Options{Quality: 82}) != nil {
				continue
			}
			if os.WriteFile(full, pic, 0o644) != nil {
				continue
			}
			os.WriteFile(filepath.Join(dir, memeThumb(file)), tb.Bytes(), 0o644)
		}
		name := strings.TrimSpace(m.Name)
		if len(name) > 80 {
			name = name[:80]
		}
		x.Memes = append(x.Memes, meme{ID: m.ID, Name: name, File: file})
	}
	if len(x.Memes) == 0 {
		return x, errors.New("no meme pictures came")
	}
	bj, _ := json.Marshal(x)
	writeFileAtomic(filepath.Join(dir, "memes.json"), bj)
	return x, nil
}

// memeFile: a meme picture's file name from the page, only if it's one of ours.
func memeFile(name string) (string, bool) {
	ext := strings.ToLower(path.Ext(name))
	id := strings.TrimSuffix(name, path.Ext(name))
	return name, memeIDRe.MatchString(id) && (ext == ".jpg" || ext == ".png")
}
