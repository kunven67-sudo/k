package main

// Saved chats: where they go, their file names, and search. No Windows calls, so it's tested anywhere.

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode"
)

const savedFolder = "Saved chats"

// safeFileName turns a chat title or account name into something Windows accepts as a file name.
func safeFileName(s string) string {
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || strings.ContainsRune(`<>:"/\|?*`, r) {
			return ' '
		}
		return r
	}, s)
	s = strings.Join(strings.Fields(s), " ")
	if r := []rune(s); len(r) > 80 {
		s = strings.TrimSpace(string(r[:80]))
	}
	s = strings.TrimRight(s, ". ")
	switch strings.ToUpper(s) {
	case "", "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "LPT1", "LPT2", "LPT3":
		return "Chat"
	}
	return s
}

// The index remembers which file each chat link went to, so saving a chat again replaces it.
func loadIndex(dir string) map[string]string {
	idx := map[string]string{}
	if b, err := os.ReadFile(filepath.Join(dir, "index.json")); err == nil {
		json.Unmarshal(b, &idx)
	}
	return idx
}

// saveChat writes <dir>/<name>.html + .md and returns both paths.
func saveChat(dir, link, title string, html, md []byte, now time.Time) (string, string, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", "", err
	}
	idx := loadIndex(dir)
	key := strings.SplitN(strings.SplitN(link, "#", 2)[0], "?", 2)[0]
	name := idx[key]
	if name == "" || name != safeFileName(name) {
		base := now.Format("2006-01-02 1504") + " - " + safeFileName(title)
		name = base
		for i := 2; ; i++ {
			if _, err := os.Stat(filepath.Join(dir, name+".md")); os.IsNotExist(err) {
				break
			}
			name = base + " (" + itoa(i) + ")"
		}
	}
	hp, mp := filepath.Join(dir, name+".html"), filepath.Join(dir, name+".md")
	if err := writeFileAtomic(hp, html); err != nil {
		return "", "", err
	}
	if err := writeFileAtomic(mp, md); err != nil {
		return "", "", err
	}
	idx[key] = name
	b, _ := json.MarshalIndent(idx, "", "  ")
	writeFileAtomic(filepath.Join(dir, "index.json"), b)
	return hp, mp, nil
}

func writeFileAtomic(path string, b []byte) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	var b []byte
	for ; i > 0; i /= 10 {
		b = append([]byte{byte('0' + i%10)}, b...)
	}
	return string(b)
}

// insideDir is true when p is root itself or somewhere under it (so a page can't make ALTS open other files).
func insideDir(root, p string) bool {
	r, err1 := filepath.Abs(root)
	q, err2 := filepath.Abs(p)
	if err1 != nil || err2 != nil {
		return false
	}
	rel, err := filepath.Rel(r, q)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

type hit struct {
	Account string `json:"account"`
	Title   string `json:"title"`
	File    string `json:"file"` // the .html, which is what opens
	Date    string `json:"date"`
	Snippet string `json:"snippet"`
	when    time.Time
}

// searchChats looks through every saved chat (.md) for q, newest first.
func searchChats(root, q string, max int) []hit {
	q = strings.TrimSpace(q)
	if q == "" {
		return nil
	}
	lq := strings.ToLower(q)
	var out []hit
	filepath.Walk(root, func(p string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || !strings.HasSuffix(strings.ToLower(p), ".md") {
			return nil
		}
		f, err := os.Open(p)
		if err != nil {
			return nil
		}
		defer f.Close()
		title := strings.TrimSuffix(filepath.Base(p), ".md")
		if i := strings.Index(title, " - "); i >= 0 {
			title = title[i+3:]
		}
		sc := bufio.NewScanner(f)
		sc.Buffer(make([]byte, 64*1024), 4*1024*1024)
		first := true
		for sc.Scan() {
			line := sc.Text()
			if first && strings.HasPrefix(line, "# ") {
				title = strings.TrimSpace(line[2:])
			}
			first = false
			if i := strings.Index(strings.ToLower(line), lq); i >= 0 {
				out = append(out, hit{
					Account: filepath.Base(filepath.Dir(p)),
					Title:   title,
					File:    strings.TrimSuffix(p, filepath.Ext(p)) + ".html",
					Date:    info.ModTime().Format("Jan 2, 2006"),
					Snippet: snippet(line, i, len(q)),
					when:    info.ModTime(),
				})
				break
			}
		}
		return nil
	})
	sort.SliceStable(out, func(i, j int) bool { return out[i].when.After(out[j].when) })
	if len(out) > max {
		out = out[:max]
	}
	return out
}

// snippet cuts ~140 characters around the match.
func snippet(line string, at, n int) string {
	r := []rune(line)
	start := len([]rune(line[:at]))
	from, to := max(0, start-60), min(len(r), start+n+80)
	s := strings.TrimSpace(string(r[from:to]))
	if from > 0 {
		s = "..." + s
	}
	if to < len(r) {
		s += "..."
	}
	return s
}
