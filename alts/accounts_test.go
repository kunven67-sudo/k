package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCleanName(t *testing.T) {
	cases := map[string]string{
		"  Main  ":                        "Main",
		"":                                "fb",
		"   ":                             "fb",
		"a\tb\nc":                         "a b c",
		"Alt   2":                         "Alt 2",
		"abcdefghijklmnopqrstuvwxyz12345": "abcdefghijklmnopqrstuvwx",
		"école ñame":                      "école ñame",
	}
	for in, want := range cases {
		if got := cleanName(in, "fb"); got != want {
			t.Errorf("cleanName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestCleanColor(t *testing.T) {
	if cleanColor("#4F8EF7") != "#4f8ef7" || cleanColor("red") != palette[0] || cleanColor("#12345") != palette[0] {
		t.Fatal("cleanColor")
	}
}

func TestAddMoveCycle(t *testing.T) {
	var s Settings
	a := s.add("", "")
	b := s.add("Alt", "#3dbe8b")
	c := s.add("Third", "")
	if a.Name != "Account 1" || b.Name != "Alt" || !validID(a.ID) || a.ID == b.ID {
		t.Fatalf("add: %+v %+v", a, b)
	}
	if s.defaultName() != "Account 4" {
		t.Fatal(s.defaultName())
	}
	if s.move(a.ID, -1) || !s.move(a.ID, 1) || s.Accounts[1].ID != a.ID || s.move(c.ID, 1) || s.move(a.ID, 2) {
		t.Fatal("move")
	}
	// order is now b, a, c
	if s.cycle(c.ID, 1) != b.ID || s.cycle(b.ID, -1) != c.ID || s.cycle("nope", 1) != b.ID {
		t.Fatal("cycle")
	}
	if s.byNumber(1) != b.ID || s.byNumber(3) != c.ID || s.byNumber(4) != "" || s.byNumber(9) != c.ID || s.byNumber(0) != "" {
		t.Fatal("byNumber")
	}
	s.Last = a.ID
	if s.remove(a.ID) != 1 || s.Last != "" || len(s.Accounts) != 2 || s.remove(a.ID) != -1 {
		t.Fatal("remove")
	}
	var empty Settings
	if empty.cycle("", 1) != "" || empty.byNumber(9) != "" {
		t.Fatal("empty")
	}
}

func TestNextColorAndDefaultName(t *testing.T) {
	var s Settings
	for i := 0; i < len(palette); i++ {
		s.add("", s.nextColor())
	}
	seen := map[string]bool{}
	for _, a := range s.Accounts {
		if seen[a.Color] {
			t.Fatal("color used twice before the palette ran out")
		}
		seen[a.Color] = true
	}
	s.Accounts[0].Name = "account 12"
	if s.defaultName() != "Account 11" {
		t.Fatal(s.defaultName())
	}
}

func TestLoadSaveTidyAdopt(t *testing.T) {
	dir := t.TempDir()
	cfg := filepath.Join(dir, "alts.json")
	acc := filepath.Join(dir, "accounts")
	os.MkdirAll(acc, 0o755)

	if _, st := loadSettings(cfg); st != fileMissing {
		t.Fatal("missing")
	}
	os.WriteFile(cfg, []byte("{nope"), 0o644)
	if _, st := loadSettings(cfg); st != fileBroken {
		t.Fatal("broken")
	}

	raw := `{"accounts":[{"id":"aaaa1111","name":"  Main ","color":"#D97757"},{"id":"..\\..\\x","name":"evil"},{"id":"aaaa1111","name":"dup"},{"id":"bbbb2222","name":"","color":"pink"}],"last":"gone"}`
	os.WriteFile(cfg, []byte(raw), 0o644)
	s, st := loadSettings(cfg)
	if st != fileOK || len(s.Accounts) != 2 || s.Accounts[0].Name != "Main" || s.Accounts[0].Color != "#d97757" ||
		s.Accounts[1].Name != "Account" || s.Accounts[1].Color != palette[0] || s.Last != "" {
		t.Fatalf("tidy: %+v", s)
	}

	os.MkdirAll(filepath.Join(acc, "aaaa1111"), 0o755)
	os.MkdirAll(filepath.Join(acc, "cccc3333"), 0o755)
	os.MkdirAll(filepath.Join(acc, "not-an-id"), 0o755)
	if o := s.orphans(acc); len(o) != 1 || filepath.Base(o[0]) != "cccc3333" {
		t.Fatalf("orphans %v", o)
	}
	s.adopt(acc)
	if s.find("cccc3333") < 0 || len(s.Accounts) != 3 || len(s.orphans(acc)) != 0 {
		t.Fatalf("adopt %+v", s)
	}

	s.Place = &Place{L: 10, T: 20, R: 900, B: 700, Max: true}
	if err := saveSettings(cfg, s); err != nil {
		t.Fatal(err)
	}
	back, st := loadSettings(cfg)
	if st != fileOK || len(back.Accounts) != 3 || back.Place == nil || !back.Place.Max || back.Place.R != 900 {
		t.Fatalf("roundtrip %+v", back)
	}
	if _, err := os.Stat(cfg + ".tmp"); !os.IsNotExist(err) {
		t.Fatal("tmp left behind")
	}
}

func TestOpensOutside(t *testing.T) {
	inside := []string{
		"https://claude.ai/chat/123", "https://www.claude.ai/", "https://support.anthropic.com/x",
		"https://accounts.google.com/o/oauth2/v2/auth?x=1", "https://appleid.apple.com/auth",
		"https://checkout.stripe.com/c/pay", "https://github.com/login/oauth/authorize?c=1",
		"https://github.com/apps/claude/installations/new", "about:blank", "", "blob:https://claude.ai/abc",
		"mailto:a@b.c", "javascript:void(0)",
	}
	outside := []string{
		"https://github.com/kunven67-sudo/k/pull/12", "https://www.youtube.com/watch?v=1",
		"http://example.com", "https://google.com/search?q=x", "https://notclaude.ai/",
		"https://claude.ai.evil.com/",
	}
	for _, u := range inside {
		if opensOutside(u) {
			t.Errorf("%q should stay inside", u)
		}
	}
	for _, u := range outside {
		if !opensOutside(u) {
			t.Errorf("%q should open outside", u)
		}
	}
}
