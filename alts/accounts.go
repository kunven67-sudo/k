package main

// Account list + settings. No Windows calls in here, so it can be tested anywhere.

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"unicode"
)

type Account struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

// Place is the saved window spot (normal size + whether it was maximized).
type Place struct {
	L, T, R, B int32
	Max        bool
}

type Settings struct {
	Accounts []Account `json:"accounts"`
	Last     string    `json:"last"`
	Place    *Place    `json:"place,omitempty"`
}

type loadState int

const (
	fileMissing loadState = iota
	fileOK
	fileBroken
)

// Same list as the swatches in ui/index.html.
var palette = []string{
	"#d97757", "#4f8ef7", "#3dbe8b", "#9b6bff", "#f06aa8",
	"#f2c14e", "#2ec4c4", "#ef5b5b", "#8a8f98", "#e8e8ea",
}

const maxName = 24

var (
	idRe    = regexp.MustCompile(`^[0-9a-f]{8,32}$`)
	colorRe = regexp.MustCompile(`^#[0-9a-f]{6}$`)
)

// The ID is also the account's folder name, so only plain hex is allowed.
func validID(id string) bool { return idRe.MatchString(id) }

func cleanName(s, fallback string) string {
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return ' '
		}
		return r
	}, s)
	s = strings.Join(strings.Fields(s), " ")
	if r := []rune(s); len(r) > maxName {
		s = strings.TrimSpace(string(r[:maxName]))
	}
	if s == "" {
		return fallback
	}
	return s
}

func cleanColor(c string) string {
	c = strings.ToLower(strings.TrimSpace(c))
	if colorRe.MatchString(c) {
		return c
	}
	return palette[0]
}

func (s *Settings) find(id string) int {
	for i, a := range s.Accounts {
		if a.ID == id {
			return i
		}
	}
	return -1
}

func (s *Settings) newID() string {
	for {
		b := make([]byte, 4)
		if _, err := rand.Read(b); err != nil {
			panic(err)
		}
		id := hex.EncodeToString(b)
		if s.find(id) < 0 {
			return id
		}
	}
}

func (s *Settings) defaultName() string {
	for n := len(s.Accounts) + 1; ; n++ {
		name := fmt.Sprintf("Account %d", n)
		taken := false
		for _, a := range s.Accounts {
			if strings.EqualFold(a.Name, name) {
				taken = true
				break
			}
		}
		if !taken {
			return name
		}
	}
}

// nextColor picks the first palette color nobody uses yet.
func (s *Settings) nextColor() string {
	for _, c := range palette {
		used := false
		for _, a := range s.Accounts {
			if a.Color == c {
				used = true
				break
			}
		}
		if !used {
			return c
		}
	}
	return palette[len(s.Accounts)%len(palette)]
}

func (s *Settings) add(name, color string) Account {
	a := Account{ID: s.newID(), Name: cleanName(name, s.defaultName()), Color: cleanColor(color)}
	s.Accounts = append(s.Accounts, a)
	return a
}

// move shifts an account one spot up (dir -1) or down (dir +1).
func (s *Settings) move(id string, dir int) bool {
	i := s.find(id)
	j := i + dir
	if i < 0 || (dir != -1 && dir != 1) || j < 0 || j >= len(s.Accounts) {
		return false
	}
	s.Accounts[i], s.Accounts[j] = s.Accounts[j], s.Accounts[i]
	return true
}

func (s *Settings) remove(id string) int {
	i := s.find(id)
	if i >= 0 {
		s.Accounts = append(s.Accounts[:i], s.Accounts[i+1:]...)
	}
	if s.Last == id {
		s.Last = ""
	}
	return i
}

// cycle returns the account after (dir +1) or before (dir -1) the active one, wrapping around.
func (s *Settings) cycle(active string, dir int) string {
	n := len(s.Accounts)
	if n == 0 {
		return ""
	}
	i := s.find(active)
	if i < 0 {
		return s.Accounts[0].ID
	}
	return s.Accounts[((i+dir)%n+n)%n].ID
}

// byNumber is Ctrl+1..Ctrl+9. Ctrl+9 always means the last one, like in Chrome.
func (s *Settings) byNumber(n int) string {
	if n < 1 || n > 9 || len(s.Accounts) == 0 {
		return ""
	}
	if n == 9 {
		return s.Accounts[len(s.Accounts)-1].ID
	}
	if n > len(s.Accounts) {
		return ""
	}
	return s.Accounts[n-1].ID
}

// tidy fixes a hand-edited or old file: bad IDs out, no doubles, clean names and colors.
func (s *Settings) tidy() {
	seen := map[string]bool{}
	out := s.Accounts[:0]
	for _, a := range s.Accounts {
		if !validID(a.ID) || seen[a.ID] {
			continue
		}
		seen[a.ID] = true
		a.Name = cleanName(a.Name, "Account")
		a.Color = cleanColor(a.Color)
		out = append(out, a)
	}
	s.Accounts = out
	if s.find(s.Last) < 0 {
		s.Last = ""
	}
}

func loadSettings(path string) (Settings, loadState) {
	var s Settings
	b, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return s, fileMissing
	}
	if err != nil || json.Unmarshal(b, &s) != nil {
		return Settings{}, fileBroken
	}
	s.tidy()
	return s, fileOK
}

func saveSettings(path string, s Settings) error {
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// accountFolders lists the login folders on disk (only real account IDs).
func accountFolders(dir string) []string {
	ents, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var ids []string
	for _, e := range ents {
		if e.IsDir() && validID(e.Name()) {
			ids = append(ids, e.Name())
		}
	}
	return ids
}

// adopt brings back accounts whose folder is still on disk but missing from the list
// (settings file deleted or broken), so nobody gets logged out by accident.
func (s *Settings) adopt(dir string) {
	for _, id := range accountFolders(dir) {
		if s.find(id) < 0 {
			s.Accounts = append(s.Accounts, Account{ID: id, Name: s.defaultName(), Color: s.nextColor()})
		}
	}
}

// orphans are folders of accounts that were deleted (their delete didn't finish last time).
func (s *Settings) orphans(dir string) []string {
	var out []string
	for _, id := range accountFolders(dir) {
		if s.find(id) < 0 {
			out = append(out, filepath.Join(dir, id))
		}
	}
	return out
}

// opensOutside says if a link that wants a new window should go to the normal browser.
// Claude, its logins and payments stay inside ALTS (they need that account's login);
// everything else opens in the PC's normal browser.
func opensOutside(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return false
	}
	host := strings.ToLower(u.Hostname())
	if host == "" {
		return false
	}
	for _, d := range []string{"claude.ai", "claude.com", "anthropic.com", "stripe.com"} {
		if host == d || strings.HasSuffix(host, "."+d) {
			return false
		}
	}
	switch host {
	case "accounts.google.com", "appleid.apple.com":
		return false
	case "github.com":
		// Connecting GitHub to Claude Code happens in a popup and must stay in this account.
		for _, p := range []string{"/login", "/apps/", "/settings/", "/sessions"} {
			if strings.HasPrefix(u.Path, p) {
				return false
			}
		}
	}
	return true
}
