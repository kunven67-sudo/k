package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSafeFileName(t *testing.T) {
	for in, want := range map[string]string{
		`GS3: the "real" PS5 look?`: "GS3 the real PS5 look",
		"  CON ":                    "Chat",
		"":                          "Chat",
		"a/b\\c|d*e":                "a b c d e",
		"dots...":                   "dots",
		strings.Repeat("x", 120):    strings.Repeat("x", 80),
	} {
		if got := safeFileName(in); got != want {
			t.Errorf("safeFileName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSaveChatReplacesSameLink(t *testing.T) {
	dir := t.TempDir()
	now := time.Date(2026, 10, 31, 9, 5, 0, 0, time.UTC)
	h1, m1, err := saveChat(dir, "https://claude.ai/code/session_abc?x=1", "Game System 3", []byte("<p>one</p>"), []byte("# Game System 3\none"), now)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(h1) != "2026-10-31 0905 - Game System 3.html" {
		t.Fatalf("name = %s", filepath.Base(h1))
	}
	h2, m2, _ := saveChat(dir, "https://claude.ai/code/session_abc#end", "Game System 3 (renamed)", []byte("<p>two</p>"), []byte("# x\ntwo"), now.Add(time.Hour))
	if h2 != h1 || m2 != m1 {
		t.Fatalf("same chat saved to a new file: %s", h2)
	}
	if b, _ := os.ReadFile(m1); string(b) != "# x\ntwo" {
		t.Fatalf("not replaced: %q", b)
	}
	h3, _, _ := saveChat(dir, "https://claude.ai/code/session_other", "Game System 3", []byte("x"), []byte("y"), now)
	if filepath.Base(h3) != "2026-10-31 0905 - Game System 3 (2).html" {
		t.Fatalf("second chat with the same name = %s", filepath.Base(h3))
	}
}

func TestSearchChats(t *testing.T) {
	root := t.TempDir()
	a := filepath.Join(root, "Main")
	b := filepath.Join(root, "Alt 2")
	saveChat(a, "https://claude.ai/code/session_1", "Old chat", []byte("h"), []byte("# Old chat\nwe talked about the PS5 Control Center here\n"), time.Now())
	saveChat(b, "https://claude.ai/code/session_2", "Other", []byte("h"), []byte("# Other\nnothing to see\n"), time.Now())
	hits := searchChats(root, "control center", 10)
	if len(hits) != 1 || hits[0].Account != "Main" || hits[0].Title != "Old chat" || !strings.Contains(hits[0].Snippet, "PS5 Control Center") {
		t.Fatalf("hits = %+v", hits)
	}
	if !strings.HasSuffix(hits[0].File, ".html") || !insideDir(root, hits[0].File) {
		t.Fatalf("file = %s", hits[0].File)
	}
	if insideDir(root, filepath.Join(root, "..", "evil.html")) {
		t.Fatal("outside path counted as inside")
	}
	if len(searchChats(root, "   ", 10)) != 0 {
		t.Fatal("empty search should find nothing")
	}
}
