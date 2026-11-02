package main

import (
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

func TestFromClaude(t *testing.T) {
	const chat = "https://claude.ai/chat/1234"
	cases := []struct {
		link, page string
		want       bool
		from       string
	}{
		{"https://claude.ai/api/org/files/abc/contents", chat, true, "claude.ai"},
		{"https://claude.ai/api/x/wiggle/download-file?path=/out/GS3.zip", "https://claude.ai/code/session_1", true, "claude.ai"},
		{"https://api.anthropic.com/v1/files/x", chat, true, "api.anthropic.com"},
		{"https://www.claudeusercontent.com/x.html", chat, true, "www.claudeusercontent.com"},
		{"blob:https://claude.ai/6f1c-22", chat, true, "claude.ai"},
		{"BLOB:https://www.claudeusercontent.com/6f1c", chat, true, "www.claudeusercontent.com"},
		{"data:text/markdown;base64,SGk=", chat, true, "claude.ai"},
		// not Claude's
		{"https://github.com/x/y/releases/download/v1/tool.exe", chat, false, "github.com"},
		{"https://claude.ai.evil.com/x.exe", chat, false, "claude.ai.evil.com"},
		{"https://evilclaude.ai/x.exe", chat, false, "evilclaude.ai"},
		{"http://claude.ai/x.exe", chat, false, "claude.ai"},
		{"blob:https://evil.com/1", chat, false, "evil.com"},
		{"blob:null/1234", chat, false, ""},
		{"ftp://claude.ai/x", chat, false, "claude.ai"},
		// a Claude file, but the account was on another site at the time
		{"https://claude.ai/api/files/x", "https://accounts.google.com/signin", false, "claude.ai"},
		{"data:application/octet-stream,hi", "https://accounts.google.com/", false, "another site"},
		{"https://claude.ai/api/files/x", "", false, "claude.ai"},
		{"https://claude.ai/api/files/x", "http://claude.ai/chat", false, "claude.ai"},
		{"::bad", chat, false, ""},
	}
	for _, c := range cases {
		got, from := fromClaude(c.link, c.page)
		if got != c.want || from != c.from {
			t.Errorf("fromClaude(%q, %q) = %v, %q; want %v, %q", c.link, c.page, got, from, c.want, c.from)
		}
	}
}

func TestZoneFromClaude(t *testing.T) {
	cases := []struct {
		zone string
		want bool
	}{
		{"[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=https://claude.ai/chat/1\r\nHostUrl=https://claude.ai/api/files/2\r\n", true},
		{"[ZoneTransfer]\r\nZoneId=3\r\nHostUrl=https://api.anthropic.com/v1/files/2\r\n", true},
		{"[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=https://claude.ai/code/x\r\nHostUrl=about:internet\r\n", true},
		{"[ZoneTransfer]\nZoneId=3\nreferrerurl=https://claude.ai/code/x\n", true},
		{"[ZoneTransfer]\r\nZoneId=3\r\nHostUrl=blob:https://claude.ai/abc\r\n", true},
		// linked from a Claude chat, but the file itself came from somewhere else
		{"[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=https://claude.ai/chat/1\r\nHostUrl=https://github.com/x/y.exe\r\n", false},
		{"[ZoneTransfer]\r\nZoneId=3\r\nHostUrl=https://claude.ai.evil.com/y.exe\r\n", false},
		{"[ZoneTransfer]\r\nZoneId=3\r\nHostUrl=http://claude.ai/y.exe\r\n", false},
		{"[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=https://www.google.com/\r\nHostUrl=about:internet\r\n", false},
		{"[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=C:\\Users\\bro\\Downloads\\GS3.zip\r\n", false},
		{"[ZoneTransfer]\r\nZoneId=3\r\n", false},
		{"", false},
	}
	for _, c := range cases {
		if got, _ := zoneFromClaude(c.zone); got != c.want {
			t.Errorf("zoneFromClaude(%q) = %v, want %v", c.zone, got, c.want)
		}
	}
}

func TestZoneParent(t *testing.T) {
	if p := zoneParent("[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=C:\\Users\\bro\\Downloads\\GS3.zip\r\n"); p != `C:\Users\bro\Downloads\GS3.zip` {
		t.Errorf("got %q", p)
	}
	if p := zoneParent("[ZoneTransfer]\r\nReferrerUrl=\\\\nas\\share\\a.zip\r\n"); p != `\\nas\share\a.zip` {
		t.Errorf("unc: got %q", p)
	}
	if p := zoneParent("[ZoneTransfer]\r\nReferrerUrl=https://claude.ai/x\r\n"); p != "" {
		t.Errorf("web link counted as a zip: %q", p)
	}
}

func TestCleanDownloadName(t *testing.T) {
	cases := map[string]string{
		"GS3 Setup 3.7.0.exe": "GS3 Setup 3.7.0.exe",
		"a/b\\c:d?.zip":       "a_b_c_d_.zip",
		"  PORTBAY.exe  ":     "PORTBAY.exe",
		"con.txt":             "_con.txt",
		"NUL":                 "_NUL",
		"....":                "download",
		"":                    "download",
		"notes.":              "notes",
		"x\x00y.bat":          "x_y.bat",
	}
	for in, want := range cases {
		if got := cleanDownloadName(in); got != want {
			t.Errorf("cleanDownloadName(%q) = %q, want %q", in, got, want)
		}
	}
	long := strings.Repeat("a", 300) + ".exe"
	if got := cleanDownloadName(long); len([]rune(got)) != 124 || !strings.HasSuffix(got, ".exe") {
		t.Errorf("long name cut wrong: %d %q", len(got), got[len(got)-8:])
	}
}

func TestUniqueName(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "ALTS.exe"), nil, 0o644)
	os.WriteFile(filepath.Join(dir, "ALTS (2).exe"), nil, 0o644)
	reserved := map[string]bool{strings.ToLower(filepath.Join(dir, "ALTS (3).exe")): true}
	taken := func(p string) bool {
		if reserved[strings.ToLower(p)] {
			return true
		}
		_, err := os.Lstat(p)
		return err == nil
	}
	if got := uniqueName(dir, "ALTS.exe", taken); got != filepath.Join(dir, "ALTS (4).exe") {
		t.Errorf("got %q", got)
	}
	if got := uniqueName(dir, "new.zip", taken); got != filepath.Join(dir, "new.zip") {
		t.Errorf("got %q", got)
	}
	if got := uniqueName(dir, "README", func(string) bool { return true }); !strings.HasPrefix(filepath.Base(got), "README (") {
		t.Errorf("never stops looking: %q", got)
	}
}

func TestFileList(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "files.json")
	var l fileList
	a := fileRec{ID: newFileID(), Name: "a.exe", Path: filepath.Join(dir, "a.exe"), Size: 3}
	b := fileRec{ID: newFileID(), Name: "b.zip", Path: filepath.Join(dir, "b.zip"), Size: 4}
	l.add(a)
	l.add(b)
	if len(l.Files) != 2 || l.Files[0].ID != b.ID {
		t.Fatalf("newest should be first: %+v", l.Files)
	}
	a2 := a
	a2.ID = newFileID()
	a2.Path = strings.ToUpper(a.Path[:1]) + a.Path[1:] // same file, different case
	l.add(a2)
	if len(l.Files) != 2 || l.Files[0].ID != a2.ID {
		t.Fatalf("same file twice: %+v", l.Files)
	}
	if !l.has(a.Path) || l.has(filepath.Join(dir, "c.exe")) {
		t.Error("has is wrong")
	}
	l.New = true
	if err := saveFiles(path, l); err != nil {
		t.Fatal(err)
	}
	back := loadFiles(path)
	if len(back.Files) != 2 || !back.New || back.Files[1].ID != b.ID {
		t.Fatalf("load: %+v", back)
	}
	if !back.remove(b.ID) || back.remove(b.ID) || len(back.Files) != 1 {
		t.Error("remove is wrong")
	}
	for i := 0; i < maxFiles+20; i++ {
		back.add(fileRec{ID: newFileID(), Path: filepath.Join(dir, "f"+itoa(i))})
	}
	if len(back.Files) != maxFiles {
		t.Errorf("list should stop at %d, got %d", maxFiles, len(back.Files))
	}

	// broken or tampered files load as empty / skip bad rows
	os.WriteFile(path, []byte("{not json"), 0o644)
	if got := loadFiles(path); len(got.Files) != 0 {
		t.Error("broken file should load empty")
	}
	os.WriteFile(path, []byte(`{"files":[{"id":"x","path":"relative.exe"},{"id":"","path":"/abs"},{"id":"ok","path":"`+filepath.ToSlash(filepath.Join(dir, "z"))+`"}]}`), 0o644)
	if got := loadFiles(path); len(got.Files) != 1 || got.Files[0].ID != "ok" {
		t.Errorf("bad rows kept: %+v", got.Files)
	}
	if got := loadFiles(filepath.Join(dir, "missing.json")); len(got.Files) != 0 {
		t.Error("missing file should load empty")
	}
}

func TestHashAndState(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "x.bin")
	os.WriteFile(p, []byte("hello"), 0o644)
	h, n, err := hashFile(p)
	if err != nil || n != 5 || h != "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824" {
		t.Fatalf("hash: %v %d %s", err, n, h)
	}
	r := fileRec{Size: 5, Hash: h}
	if s := fileState(r, n, h, nil); s != "ok" {
		t.Errorf("same file = %s", s)
	}
	os.WriteFile(p, []byte("hellO"), 0o644)
	h2, n2, _ := hashFile(p)
	if s := fileState(r, n2, h2, nil); s != "changed" {
		t.Errorf("edited file = %s", s)
	}
	if s := fileState(r, 6, "", nil); s != "changed" {
		t.Errorf("bigger file = %s", s)
	}
	os.Remove(p)
	_, _, err = hashFile(p)
	if s := fileState(r, 0, "", err); s != "gone" {
		t.Errorf("deleted file = %s", s)
	}
}

func TestClaudeHost(t *testing.T) {
	for h, want := range map[string]bool{
		"claude.ai": true, "CLAUDE.AI": true, "claude.ai.": true, "a.b.claude.ai": true, "anthropic.com": true,
		"api.anthropic.com": true, "claude.com": true, "www.claudeusercontent.com": true,
		"": false, "ai": false, "notclaude.ai": false, "claude.ai.evil.com": false, "anthropic.co": false,
	} {
		if got := claudeHost(h); got != want {
			t.Errorf("claudeHost(%q) = %v", h, got)
		}
	}
}

func TestFixOldIn(t *testing.T) {
	dl, desk := t.TempDir(), t.TempDir()
	mk := func(rel string, root string) string {
		p := filepath.Join(root, filepath.FromSlash(rel))
		os.MkdirAll(filepath.Dir(p), 0o755)
		os.WriteFile(p, []byte("data of "+rel), 0o644)
		return p
	}
	claude := "[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=https://claude.ai/chat/1\r\nHostUrl=https://claude.ai/api/files/2\r\n"
	blob := "[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=https://claude.ai/code/s\r\nHostUrl=about:internet\r\n"
	github := "[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=https://claude.ai/chat/1\r\nHostUrl=https://github.com/x/y.exe\r\n"
	from := func(zip string) string { return "[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=" + zip + "\r\n" }

	zip := mk("GS3.zip", dl)
	known := mk("Old Game.zip", dl) // already on the list (downloaded in ALTS, mark already off)
	mark := map[string]string{
		zip:                            claude,
		mk("PORTBAY.exe", dl):          blob,
		mk("random.exe", dl):           github, // only LINKED from a Claude chat: not Claude's
		mk("cloud only.exe", dl):       claude, // OneDrive placeholder: never touched
		mk("GS3/game.exe", dl):         from(zip),
		mk("GS3/sub/data.pak", dl):     from(strings.ToUpper(zip[:1]) + zip[1:]), // case doesn't matter
		mk("Other/x.exe", dl):          from(filepath.Join(dl, "Somebody else.zip")),
		mk("Other/7zip copy.exe", dl):  claude, // 7-Zip copies the zip's own note
		mk("Old/thing.exe", dl):        from(known),
		mk("a/b/c/d/e/f/deep.exe", dl): from(zip), // too deep to look
		mk("node_modules/x.js", dl):    claude,
		mk("page.html", desk):          claude,
	}
	mk("no mark.txt", dl)
	stuck := mk("stuck.exe", dl)
	mark[stuck] = claude
	cleared := map[string]bool{}
	m := marks{
		read: func(p string) (string, bool) { z, ok := mark[p]; return z, ok },
		clear: func(p string) error {
			if p == stuck {
				return os.ErrPermission // something has it open
			}
			cleared[p] = true
			delete(mark, p)
			return nil
		},
		skip: func(info fs.FileInfo) bool { return info == nil || info.Name() == "cloud only.exe" },
	}
	found, inside := fixOldIn([]string{dl, desk, dl, ""}, []string{strings.ToLower(known)}, m)

	var names []string
	for _, r := range found {
		names = append(names, r.Name)
		if !r.Old || r.Hash == "" || r.Size == 0 || r.ID == "" || !strings.Contains(r.From, "claude.ai") {
			t.Errorf("bad record: %+v", r)
		}
	}
	sort.Strings(names)
	if got := strings.Join(names, ","); got != "GS3.zip,PORTBAY.exe,page.html" {
		t.Errorf("listed %q", got)
	}
	if inside != 4 {
		t.Errorf("inside = %d, want 4 (game.exe, data.pak, 7zip copy.exe, thing.exe)", inside)
	}
	for _, rel := range []string{"random.exe", "cloud only.exe", "Other/x.exe", "a/b/c/d/e/f/deep.exe", "node_modules/x.js", "stuck.exe"} {
		if cleared[filepath.Join(dl, filepath.FromSlash(rel))] {
			t.Errorf("%s should keep its mark", rel)
		}
	}
	for _, rel := range []string{"GS3.zip", "PORTBAY.exe", "GS3/game.exe", "GS3/sub/data.pak", "Other/7zip copy.exe", "Old/thing.exe"} {
		if !cleared[filepath.Join(dl, filepath.FromSlash(rel))] {
			t.Errorf("%s should lose its mark", rel)
		}
	}
	// running it again finds nothing new (the marks are gone)
	found, inside = fixOldIn([]string{dl, desk}, nil, m)
	if len(found) != 0 || inside != 0 {
		t.Errorf("second run: %d listed, %d inside", len(found), inside)
	}
}
