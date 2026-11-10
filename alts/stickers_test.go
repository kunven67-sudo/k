package main

import (
	"bytes"
	"image"
	"image/color"
	"image/gif"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestFavorites(t *testing.T) {
	dir := t.TempDir()
	if got := loadFavs(dir); len(got) != 0 {
		t.Fatalf("no file = no favorites, got %v", got)
	}
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(setFav(dir, "meme", "30b1gx.jpg", true))
	must(setFav(dir, "mine", "s123.png", true))
	must(setFav(dir, "giphy", "abc.gif", true))
	if got := strings.Join(loadFavs(dir), ","); got != "giphy:abc.gif,mine:s123.png,meme:30b1gx.jpg" {
		t.Fatalf("newest first: %s", got)
	}
	must(setFav(dir, "meme", "30b1gx.jpg", true)) // again: moves to the front, no copy
	must(setFav(dir, "mine", "s123.png", false))
	if got := strings.Join(loadFavs(dir), ","); got != "meme:30b1gx.jpg,giphy:abc.gif" {
		t.Fatalf("after re-star + unstar: %s", got)
	}
	for _, bad := range [][2]string{{"meme", "../x.jpg"}, {"meme", `a\b.jpg`}, {"emoji", "x.png"}, {"mine", ""}, {"mine", ".hidden.png"}} {
		if setFav(dir, bad[0], bad[1], true) == nil {
			t.Fatalf("should refuse %v", bad)
		}
	}
	// a file another app (or a person) messed with: only the good ones count
	os.WriteFile(filepath.Join(dir, "favs.json"), []byte(`{"favs":["meme:ok.jpg","meme:../../evil","nope","giphy:x.gif"]}`), 0o644)
	if got := strings.Join(loadFavs(dir), ","); got != "meme:ok.jpg,giphy:x.gif" {
		t.Fatalf("cleaned: %s", got)
	}
	os.WriteFile(filepath.Join(dir, "favs.json"), []byte(`garbage`), 0o644)
	if len(loadFavs(dir)) != 0 {
		t.Fatal("garbage = none")
	}
	if _, err := os.Stat(filepath.Join(dir, "favs.json.tmp")); err == nil {
		t.Fatal("temp file left behind")
	}
}

func gifBytes(t *testing.T) []byte {
	t.Helper()
	pal := []color.Color{color.Black, color.White}
	g := &gif.GIF{Image: []*image.Paletted{image.NewPaletted(image.Rect(0, 0, 4, 4), pal), image.NewPaletted(image.Rect(0, 0, 4, 4), pal)}, Delay: []int{5, 5}}
	var b bytes.Buffer
	if err := gif.EncodeAll(&b, g); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

func TestKeepGiphy(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "giphy")
	g, err := keepGiphy(dir, "giphy-abc/../x", "Anime Cry", gifBytes(t))
	if err != nil {
		t.Fatal(err)
	}
	if g.File != "giphy-abcx.gif" || g.Name != "Anime Cry" {
		t.Fatalf("clean name: %+v", g)
	}
	if _, ok := giphyFile(g.File); !ok {
		t.Fatal("kept file must pass the check the apps use")
	}
	if _, err := os.Stat(filepath.Join(dir, "giphy-abcx.thumb.png")); err != nil {
		t.Fatal("a small still picture is kept next to it")
	}
	if _, err := keepGiphy(dir, "two", "", gifBytes(t)); err != nil {
		t.Fatal(err)
	}
	if _, err := keepGiphy(dir, "giphy-abc/../x", "Anime Cry again", gifBytes(t)); err != nil {
		t.Fatal(err)
	}
	x := loadGiphy(dir)
	if len(x.List) != 2 || x.List[0].Name != "Anime Cry again" || x.List[1].Name != "sticker" {
		t.Fatalf("newest first, no duplicates: %+v", x.List)
	}
	if _, err := keepGiphy(dir, "html", "x", []byte("<html>not a gif</html>")); err == nil {
		t.Fatal("only real GIF/WebP files are kept")
	}
	dropGiphy(dir, "two.gif")
	if x := loadGiphy(dir); len(x.List) != 1 {
		t.Fatalf("dropped: %+v", x.List)
	}
	if _, err := os.Stat(filepath.Join(dir, "two.gif")); err == nil {
		t.Fatal("file removed too")
	}
	if _, err := os.Stat(filepath.Join(dir, "two.thumb.png")); err == nil {
		t.Fatal("its still picture too")
	}
	dropGiphy(dir, "../../important.txt") // ignored
	for _, bad := range []string{"../a.gif", "a.png", "a.gif.exe", ""} {
		if _, ok := giphyFile(bad); ok {
			t.Fatalf("giphyFile(%q) should be refused", bad)
		}
	}
}

func TestParseGiphy(t *testing.T) {
	body := []byte(`{"data":[
	 {"id":"abc","title":"Anime Cry GIF by Crunchyroll","images":{"fixed_width_still":{"url":"https://media2.giphy.com/s.gif"},"downsized":{"url":"https://media2.giphy.com/d.gif"}}},
	 {"id":"evil","title":"x","images":{"fixed_width_still":{"url":"https://evil.example/s.gif"},"downsized":{"url":"https://evil.example/d.gif"}}},
	 {"id":"plain","title":"Sticker","images":{"fixed_width":{"url":"https://i.giphy.com/f.gif"}}}]}`)
	hits := parseGiphy(body)
	if len(hits) != 2 {
		t.Fatalf("2 hits (the one off GIPHY's servers is dropped), got %+v", hits)
	}
	if hits[0].ID != "giphy-abc" || hits[0].Name != "Anime Cry" || !strings.HasSuffix(hits[0].Still, "s.gif") || !strings.HasSuffix(hits[0].Send, "d.gif") {
		t.Fatalf("first: %+v", hits[0])
	}
	if hits[1].Name != "sticker" || hits[1].Still != hits[1].Send {
		t.Fatalf("fallbacks: %+v", hits[1])
	}
	if parseGiphy([]byte("<html>")) != nil {
		t.Fatal("broken answer = nothing")
	}
	for link, ok := range map[string]bool{"https://media.giphy.com/a.gif": true, "https://i.giphy.com/a": true, "http://media.giphy.com/a.gif": false,
		"https://giphy.com.evil.example/a.gif": false, "https://evilgiphy.com/a.gif": false} {
		if giphyHost(link) != ok {
			t.Fatalf("giphyHost(%s) should be %v", link, ok)
		}
	}
	if u := giphySearchURL("stickers", "k&y", "anime cry"); !strings.Contains(u, "api_key=k%26y") || !strings.Contains(u, "q=anime+cry") {
		t.Fatalf("escaped: %s", u)
	}
}

func TestNewMineAndPictures(t *testing.T) {
	dir := t.TempDir()
	img := image.NewRGBA(image.Rect(0, 0, 1200, 600))
	for x := 0; x < 1200; x++ {
		img.Set(x, 10, color.RGBA{255, 0, 0, 255})
	}
	var src bytes.Buffer
	png.Encode(&src, img)
	out, err := stickerFromPicture(src.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	got, err := png.Decode(bytes.NewReader(out))
	if err != nil || got.Bounds().Dx() != 512 || got.Bounds().Dy() != 256 {
		t.Fatalf("shrunk to 512 wide PNG: %v %v", got.Bounds(), err)
	}
	if out, err := stickerFromPicture(gifBytes(t)); err != nil || !bytes.HasPrefix(out, []byte("\x89PNG")) {
		t.Fatal("a GIF becomes a PNG sticker too")
	}
	if _, err := stickerFromPicture([]byte("not a picture")); err == nil {
		t.Fatal("junk refused")
	}
	os.WriteFile(filepath.Join(dir, "s1.png"), out, 0o644)
	time.Sleep(20 * time.Millisecond)
	os.WriteFile(filepath.Join(dir, "s2.png"), out, 0o644)
	os.WriteFile(filepath.Join(dir, "notes.txt"), []byte("x"), 0o644)
	if got := strings.Join(newMine(dir, []string{"s0.png"}), ","); got != "s2.png,s1.png" {
		t.Fatalf("new ones, newest first, pictures only: %s", got)
	}
	if got := newMine(dir, []string{"s1.png", "s2.png"}); len(got) != 0 {
		t.Fatalf("all known: %v", got)
	}
}
