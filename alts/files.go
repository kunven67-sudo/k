package main

// Claude's files (the Safe Lane). Windows marks every download as "from the internet", and that
// mark is what makes it warn ("Windows protected your PC", "this file could harm your device").
// ALTS takes the mark off ONLY for files that came from Claude inside ALTS, and remembers each
// one's fingerprint so it only vouches for the file exactly as Claude sent it. Every other file
// keeps its mark and gets checked by Windows like normal.
// No Windows calls in here, so it's tested anywhere.

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"unicode"
)

const (
	filesFolder = "Claude files" // inside your Downloads folder
	maxFiles    = 500
)

type fileRec struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Path    string `json:"path"`
	Size    int64  `json:"size"`
	Hash    string `json:"hash"`  // SHA-256 of the file as Claude sent it
	Added   int64  `json:"added"` // unix seconds
	From    string `json:"from"`  // the Claude site it came from
	Account string `json:"account,omitempty"`
	Old     bool   `json:"old,omitempty"` // found later by "Fix my old Claude files"
}

type fileList struct {
	Files []fileRec `json:"files"`
	New   bool      `json:"new"` // a file came in since you last looked
}

// claudeHost: Claude's own sites (claude.ai, anthropic.com, and the sandbox Claude's previews run in).
func claudeHost(host string) bool {
	host = strings.TrimSuffix(strings.ToLower(host), ".")
	if host == "" {
		return false
	}
	for _, d := range []string{"claude.ai", "claude.com", "anthropic.com", "claudeusercontent.com"} {
		if host == d || strings.HasSuffix(host, "."+d) {
			return true
		}
	}
	return false
}

// blobHost is the site a blob: link belongs to (blob:https://claude.ai/1234 -> claude.ai).
func blobHost(raw string) string {
	if len(raw) < 5 || !strings.EqualFold(raw[:5], "blob:") {
		return ""
	}
	u, err := url.Parse(raw[5:])
	if err != nil || u.Scheme != "https" {
		return ""
	}
	return strings.ToLower(u.Hostname())
}

// fromClaude says if a download that started inside ALTS came from Claude. The account has to be
// on a Claude page, and the file has to come from Claude's own sites (or be made by that page).
// The second value is where it came from, for the list (or for the "not from Claude" note).
func fromClaude(link, page string) (bool, string) {
	u, err := url.Parse(link)
	if err != nil {
		return false, ""
	}
	from := strings.ToLower(u.Hostname())
	scheme := strings.ToLower(u.Scheme)
	switch scheme {
	case "blob":
		from = blobHost(link)
	case "data":
		from = ""
	}
	p, err := url.Parse(page)
	if err != nil || p.Scheme != "https" || !claudeHost(p.Hostname()) {
		if from == "" {
			from = "another site"
		}
		return false, from
	}
	switch scheme {
	case "https", "blob":
		return claudeHost(from), from
	case "data": // a file the Claude page made itself (like Copy's chat file)
		return true, strings.ToLower(p.Hostname())
	}
	if from == "" {
		from = scheme
	}
	return false, from
}

// zoneInfo reads Windows' download note (the Zone.Identifier stream every downloaded file gets).
func zoneInfo(zone string) (host, referrer string) {
	for _, line := range strings.Split(zone, "\n") {
		k, v, ok := strings.Cut(strings.TrimSpace(line), "=")
		if !ok {
			continue
		}
		switch strings.ToLower(strings.TrimSpace(k)) {
		case "hosturl":
			host = strings.TrimSpace(v)
		case "referrerurl":
			referrer = strings.TrimSpace(v)
		}
	}
	return
}

// zoneFromClaude says if Windows' download note shows the file came from Claude: downloaded from a
// Claude site, or made by a Claude page (blob/data links, which the browser writes as about:internet
// or leaves out) while that page was the one you were on.
func zoneFromClaude(zone string) (bool, string) {
	host, ref := zoneInfo(zone)
	lh := strings.ToLower(host)
	switch {
	case strings.HasPrefix(lh, "http://") || strings.HasPrefix(lh, "https://"):
		u, err := url.Parse(host)
		if err != nil {
			return false, ""
		}
		return u.Scheme == "https" && claudeHost(u.Hostname()), strings.ToLower(u.Hostname())
	case strings.HasPrefix(lh, "blob:"):
		h := blobHost(host)
		return claudeHost(h), h
	case lh != "" && lh != "about:internet" && !strings.HasPrefix(lh, "data:"):
		return false, ""
	}
	u, err := url.Parse(ref)
	if err != nil || u.Scheme != "https" {
		return false, ""
	}
	return claudeHost(u.Hostname()), strings.ToLower(u.Hostname())
}

// zoneParent is the zip a file came out of, when Windows wrote that down (Explorer puts the zip's
// path in ReferrerUrl when it unzips a downloaded zip).
func zoneParent(zone string) string {
	_, ref := zoneInfo(zone)
	if len(ref) >= 3 && ref[1] == ':' && (ref[2] == '\\' || ref[2] == '/') && unicode.IsLetter(rune(ref[0])) {
		return ref
	}
	if strings.HasPrefix(ref, `\\`) || (ref != "" && !strings.Contains(ref, "://") && filepath.IsAbs(ref)) {
		return ref
	}
	return ""
}

// cleanDownloadName keeps a downloaded file's name, minus anything Windows won't take.
func cleanDownloadName(name string) string {
	name = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || strings.ContainsRune(`<>:"/\|?*`, r) {
			return '_'
		}
		return r
	}, strings.TrimSpace(name))
	name = strings.TrimRight(name, ". ")
	ext := filepath.Ext(name)
	if len(ext) > 16 {
		ext = ""
	}
	base := strings.TrimSuffix(name, ext)
	if r := []rune(base); len(r) > 120 {
		base = strings.TrimSpace(string(r[:120]))
	}
	stem := strings.ToUpper(strings.SplitN(base, ".", 2)[0])
	switch stem {
	case "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "LPT1", "LPT2", "LPT3":
		base = "_" + base
	}
	if base == "" {
		base = "download"
	}
	return base + ext
}

// uniqueName is dir\name, or dir\name (2).ext, (3)... when that spot is taken.
func uniqueName(dir, name string, taken func(string) bool) string {
	ext := filepath.Ext(name)
	base := strings.TrimSuffix(name, ext)
	p := filepath.Join(dir, name)
	for i := 2; taken(p) && i < 10000; i++ {
		p = filepath.Join(dir, base+" ("+itoa(i)+")"+ext)
	}
	return p
}

func loadFiles(path string) fileList {
	var l fileList
	if b, err := os.ReadFile(path); err == nil {
		if json.Unmarshal(b, &l) != nil {
			l = fileList{}
		}
	}
	var keep []fileRec
	for _, r := range l.Files {
		if r.ID != "" && r.Path != "" && filepath.IsAbs(r.Path) {
			keep = append(keep, r)
		}
	}
	l.Files = keep
	return l
}

func saveFiles(path string, l fileList) error {
	if l.Files == nil {
		l.Files = []fileRec{}
	}
	b, err := json.MarshalIndent(l, "", " ")
	if err != nil {
		return err
	}
	return writeFileAtomic(path, b)
}

// add puts a file at the top of the list (replacing an older entry for the same file).
func (l *fileList) add(r fileRec) {
	out := []fileRec{r}
	for _, o := range l.Files {
		if !strings.EqualFold(o.Path, r.Path) {
			out = append(out, o)
		}
	}
	if len(out) > maxFiles {
		out = out[:maxFiles]
	}
	l.Files = out
}

func (l *fileList) find(id string) int {
	for i, r := range l.Files {
		if r.ID == id {
			return i
		}
	}
	return -1
}

func (l *fileList) remove(id string) bool {
	if i := l.find(id); i >= 0 {
		l.Files = append(l.Files[:i], l.Files[i+1:]...)
		return true
	}
	return false
}

func (l *fileList) has(path string) bool {
	for _, r := range l.Files {
		if strings.EqualFold(r.Path, path) {
			return true
		}
	}
	return false
}

func newFileID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// hashFile is the file's fingerprint (SHA-256) and size.
func hashFile(path string) (string, int64, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", 0, err
	}
	defer f.Close()
	h := sha256.New()
	n, err := io.Copy(h, f)
	if err != nil {
		return "", 0, err
	}
	return hex.EncodeToString(h.Sum(nil)), n, nil
}

// fileState: "ok" (exactly what Claude sent), "changed" (something changed it since) or "gone".
func fileState(r fileRec, size int64, hash string, err error) string {
	switch {
	case err != nil:
		return "gone"
	case size != r.Size, hash != "" && r.Hash != "" && hash != r.Hash:
		return "changed"
	}
	return "ok"
}

// marks is how fixOldIn reads and clears Windows' internet mark (real Windows calls, or a fake in tests).
type marks struct {
	read  func(path string) (string, bool)
	clear func(path string) error
	skip  func(info fs.FileInfo) bool // OneDrive files that aren't really on the PC
}

// fixOldIn does "Fix my old Claude files": files right in the roots that Windows' notes say came
// from Claude (these go on the list), plus files in folders under them (up to 5 deep) that came out
// of a Claude zip or kept Claude's note (these just lose the mark).
func fixOldIn(roots, knownZips []string, m marks) ([]fileRec, int) {
	var found []fileRec
	zips := map[string]bool{}
	for _, z := range knownZips {
		zips[z] = true
	}
	seen := map[string]bool{}
	// 1) files sitting right in Downloads / on the Desktop
	for _, root := range roots {
		if root == "" || seen[strings.ToLower(root)] {
			continue
		}
		seen[strings.ToLower(root)] = true
		ents, _ := os.ReadDir(root)
		for _, e := range ents {
			if !e.Type().IsRegular() {
				continue
			}
			info, _ := e.Info()
			if m.skip(info) {
				continue
			}
			p := filepath.Join(root, e.Name())
			zone, has := m.read(p)
			if !has {
				continue
			}
			yes, from := zoneFromClaude(zone)
			if !yes || m.clear(p) != nil {
				continue
			}
			hash, size, err := hashFile(p)
			if err != nil {
				continue
			}
			added := info.ModTime().Unix()
			found = append(found, fileRec{ID: newFileID(), Name: e.Name(), Path: p, Size: size, Hash: hash, Added: added, From: from, Old: true})
			if strings.EqualFold(filepath.Ext(p), ".zip") {
				zips[strings.ToLower(p)] = true
			}
		}
	}
	// 2) files in folders under them that came out of a Claude zip (or kept Claude's note)
	inside, looked := 0, 0
	walked := map[string]bool{}
	for _, root := range roots {
		if root == "" || walked[strings.ToLower(root)] {
			continue
		}
		walked[strings.ToLower(root)] = true
		filepath.WalkDir(root, func(p string, e fs.DirEntry, err error) error {
			if err != nil {
				if e != nil && e.IsDir() {
					return fs.SkipDir
				}
				return nil
			}
			if looked++; looked > 40000 {
				return fs.SkipAll
			}
			rel, _ := filepath.Rel(root, p)
			depth := strings.Count(rel, string(filepath.Separator))
			if e.IsDir() {
				n := strings.ToLower(e.Name())
				if p != root && (depth >= 5 || n == "node_modules" || n == ".git" || strings.HasPrefix(n, "$")) {
					return fs.SkipDir
				}
				return nil
			}
			if depth == 0 || !e.Type().IsRegular() {
				return nil // the top level was step 1
			}
			if info, _ := e.Info(); m.skip(info) {
				return nil
			}
			zone, has := m.read(p)
			if !has {
				return nil
			}
			yes, _ := zoneFromClaude(zone)
			if !yes {
				parent := strings.ToLower(zoneParent(zone))
				yes = parent != "" && zips[parent]
			}
			if yes && m.clear(p) == nil {
				inside++
			}
			return nil
		})
	}
	return found, inside
}
