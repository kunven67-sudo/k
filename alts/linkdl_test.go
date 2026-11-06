//go:build !clip

package main

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGithubFile(t *testing.T) {
	for _, c := range []struct{ in, dl, owner, name string }{
		{"https://github.com/kunven67-sudo/k/raw/ab1c68404c97/alts/ALTS.exe", "https://github.com/kunven67-sudo/k/raw/ab1c68404c97/alts/ALTS.exe", "kunven67-sudo", "ALTS.exe"},
		{"https://github.com/o/r/blob/claude/some-branch/dir/My%20Game.zip?raw=true", "https://github.com/o/r/raw/claude/some-branch/dir/My%20Game.zip", "o", "My Game.zip"},
		{"https://raw.githubusercontent.com/o/r/main/app.apk", "https://raw.githubusercontent.com/o/r/main/app.apk", "o", "app.apk"},
		{"https://github.com/o/r/releases/download/v1/Setup.exe", "https://github.com/o/r/releases/download/v1/Setup.exe", "o", "Setup.exe"},
		{"https://github.com/o/r/blob/main/README.md", "", "", ""},
		{"https://github.com/o/r/pull/5", "", "", ""},
		{"http://github.com/o/r/raw/main/a.exe", "", "", ""},
		{"https://example.com/a.exe", "", "", ""},
	} {
		dl, o, n := githubFile(c.in)
		if dl != c.dl || o != c.owner || n != c.name {
			t.Errorf("%s -> %q %q %q", c.in, dl, o, n)
		}
	}
	if got := rawLink("https://github.com/o/r/raw/claude/b/x/a.exe"); got != "https://raw.githubusercontent.com/o/r/claude/b/x/a.exe" {
		t.Error(got)
	}
	if rawLink("https://github.com/o/r/releases/download/v1/a.exe") != "" {
		t.Error("release links have no raw form")
	}
}

func TestRefreshMemes(t *testing.T) {
	img := image.NewNRGBA(image.Rect(0, 0, 600, 400))
	for i := range img.Pix {
		img.Pix[i] = 180
	}
	img.SetNRGBA(1, 1, color.NRGBA{255, 0, 0, 255})
	var jb bytes.Buffer
	jpeg.Encode(&jb, img, nil)
	list := `{"success":true,"data":{"memes":[{"id":"30b1gx","name":"Drake Hotline Bling","url":"https://i.imgflip.com/30b1gx.jpg"},
	{"id":"../x","name":"bad","url":"https://i.imgflip.com/x.jpg"},{"id":"abc","name":"elsewhere","url":"https://evil.example/abc.jpg"}]}}`
	asked := 0
	get := func(link string) ([]byte, error) {
		asked++
		switch link {
		case memeAPI:
			return []byte(list), nil
		case "https://i.imgflip.com/30b1gx.jpg":
			return jb.Bytes(), nil
		}
		return nil, errors.New("not found")
	}
	dir := t.TempDir()
	x, err := refreshMemes(dir, get)
	if err != nil || len(x.Memes) != 1 || x.Memes[0].File != "30b1gx.jpg" {
		t.Fatalf("%v %+v", err, x)
	}
	if _, err := os.Stat(filepath.Join(dir, "30b1gx.thumb.jpg")); err != nil {
		t.Fatal("no preview")
	}
	if y := loadMemes(dir); len(y.Memes) != 1 || y.stale() {
		t.Fatalf("index %+v", y)
	}
	asked = 0
	refreshMemes(dir, get) // pictures already here: only the list is asked for
	if asked != 1 {
		t.Fatalf("asked %d", asked)
	}
	for in, ok := range map[string]bool{"30b1gx.jpg": true, "a1.png": true, "../x.jpg": false, "x.exe": false, strings.Repeat("a", 30) + ".jpg": false} {
		if _, got := memeFile(in); got != ok {
			t.Errorf("memeFile(%q) = %v", in, got)
		}
	}
}

func TestFetchTo(t *testing.T) {
	body := bytes.Repeat([]byte("MZ\x90\x00binary"), 50000)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ok.exe":
			w.Header().Set("Content-Type", "application/octet-stream")
			w.Header().Set("Content-Length", fmt.Sprint(len(body))) // GitHub sends the size
			w.Write(body)
		case "/private.exe":
			if r.Header.Get("Authorization") != "token T" {
				w.Header().Set("Content-Type", "text/html")
				w.Write([]byte("<html>sign in</html>"))
				return
			}
			w.Write(body)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	tmp := filepath.Join(t.TempDir(), "x.part")
	ticks := 0
	n, h, err := fetchTo(srv.URL+"/ok.exe", tmp, "", func(d, tot int64) { ticks++ })
	got, _ := os.ReadFile(tmp)
	if err != nil || n != int64(len(body)) || !bytes.Equal(got, body) || len(h) != 64 || ticks == 0 {
		t.Fatalf("ok: %v %d %d ticks", err, n, ticks)
	}
	if _, _, err := fetchTo(srv.URL+"/private.exe", tmp, "", func(int64, int64) {}); err == nil || !strings.Contains(err.Error(), "web page") {
		t.Fatalf("private without sign-in: %v", err)
	}
	if _, _, err := fetchTo(srv.URL+"/private.exe", tmp, "T", func(int64, int64) {}); err != nil {
		t.Fatalf("private with sign-in: %v", err)
	}
	if _, _, err := fetchTo(srv.URL+"/nope.exe", tmp, "", func(int64, int64) {}); err == nil || !strings.Contains(err.Error(), "404") {
		t.Fatalf("404: %v", err)
	}
}
