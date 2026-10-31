//go:build windows

package main

// What the page helper (ui/page.js) asks for: saving chats, Continue on another account,
// Eyes pictures, the counter and the usage bar. Plus GitHub (saved chats can also go to a repo).

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	newCodeURL  = "https://claude.ai/code"
	wvGetSource = 4
)

type pageMsg struct {
	T       string  `json:"t"`
	Why     string  `json:"why"`
	Title   string  `json:"title"`
	URL     string  `json:"url"`
	HTML    string  `json:"html"`
	MD      string  `json:"md"`
	Error   string  `json:"error"`
	File    string  `json:"file"`
	Words   int     `json:"words"`
	Pics    int     `json:"pics"`
	Msgs    int     `json:"msgs"`
	More    bool    `json:"more"`
	Stopped bool    `json:"stopped"`
	S       float64 `json:"s"`
	W       float64 `json:"w"`
	SR      string  `json:"sr"`
	WR      string  `json:"wr"`
}

type countInfo struct {
	Msgs  int  `json:"msgs"`
	Words int  `json:"words"`
	More  bool `json:"more"`
}

type usageInfo struct {
	S  float64 `json:"s"` // this session, % used (-1 = unknown)
	W  float64 `json:"w"` // this week
	SR string  `json:"sr"`
	WR string  `json:"wr"`
}

type contState struct{ from, to string }

func (a *App) savedRoot() string { return filepath.Join(a.base, savedFolder) }

// sourceOf is the page an account is showing right now.
func sourceOf(v *view) string {
	var p *uint16
	if v == nil || comCall(v.wv, wvGetSource, uintptr(unsafe.Pointer(&p))) != 0 || p == nil {
		return ""
	}
	s := windows.UTF16PtrToString(p)
	pCoTaskMemFree.Call(uintptr(unsafe.Pointer(p)))
	return s
}

// onClaude: only claude.ai itself gets to use the page helper (never a login or payment page).
func onClaude(v *view) bool {
	u, err := url.Parse(sourceOf(v))
	return err == nil && u.Scheme == "https" && u.Hostname() == "claude.ai"
}

func (a *App) evalIn(id, js string) {
	if v := a.views[id]; v != nil {
		v.c.Eval(js)
	}
}

func jsCall(fn string, v any) string {
	b, _ := json.Marshal(v)
	return "window.__alts&&__alts." + fn + "(" + string(b) + ")"
}

// onPage handles one message from an account's page. It runs inside a WebView2 event, so the
// real work happens later from the message loop (a.post).
func (a *App) onPage(id string) func(string) {
	return func(s string) {
		var m pageMsg
		if json.Unmarshal([]byte(s), &m) != nil || m.T == "" {
			return
		}
		a.post(func() { a.page(id, m) })
	}
}

func (a *App) page(id string, m pageMsg) {
	v := a.views[id]
	if v == nil || !onClaude(v) {
		return
	}
	switch m.T {
	case "hello":
		if p := a.pendingCont[id]; p != "" {
			if u, err := url.Parse(sourceOf(v)); err == nil && strings.HasPrefix(u.Path, "/code") {
				delete(a.pendingCont, id)
				v.c.Eval("window.__alts&&__alts.continueWith(" + p + ")")
			}
		}
	case "save":
		a.onSave(id, m)
	case "save-failed":
		if m.Why == "continue" && a.cont != nil {
			a.cont = nil
			a.toast("Couldn't save the chat, so Continue stopped.")
		}
	case "count":
		a.counts[id] = countInfo{m.Msgs, m.Words, m.More}
		if id == a.active {
			a.push()
		}
	case "usage":
		a.usage[id] = usageInfo{m.S, m.W, m.SR, m.WR}
		a.push()
		a.writeUsage()
	case "open-saved":
		if m.File != "" && insideDir(a.savedRoot(), m.File) {
			shellOpen(m.File)
		}
	case "open-folder":
		a.openFolder(m.File)
	}
}

func (a *App) openFolder(file string) {
	dir := a.savedRoot()
	if file != "" && insideDir(dir, file) {
		dir = filepath.Dir(file)
	}
	os.MkdirAll(dir, 0o755)
	shellOpen(dir)
}

// onSave writes the chat to the PC (and to GitHub when that's set up), then tells the page.
func (a *App) onSave(id string, m pageMsg) {
	i := a.st.find(id)
	if i < 0 {
		return
	}
	acc := a.st.Accounts[i]
	dir := filepath.Join(a.savedRoot(), safeFileName(acc.Name))
	repo := a.st.MemoryRepo
	cont := a.cont
	go func() {
		hp, mp, err := saveChat(dir, m.URL, m.Title, []byte(m.HTML), []byte(m.MD), time.Now())
		res := map[string]any{"why": m.Why, "ok": err == nil, "html": hp, "words": m.Words, "pics": m.Pics}
		memPath := ""
		if err != nil {
			res["error"] = err.Error()
		} else if repo != "" {
			memPath = "chats/" + safeFileName(acc.Name) + "/" + filepath.Base(mp)
			if uerr := ghUpload(repo, memPath, []byte(m.MD), "Saved chat: "+m.Title); uerr != nil {
				res["uploadError"] = uerr.Error()
				memPath = ""
			} else {
				res["uploaded"] = true
			}
		}
		a.post(func() {
			a.evalIn(id, jsCall("saved", res))
			if m.Why != "continue" || cont == nil || cont.from != id || a.cont != cont {
				return
			}
			a.cont = nil
			if err != nil {
				a.toast("Couldn't save the chat: " + err.Error())
				return
			}
			a.continueTo(cont.to, m, filepath.Base(mp), hp, repo, memPath)
		})
	}()
}

// startContinue saves the open chat; when that's done, continueTo opens the other account.
func (a *App) startContinue(to string) {
	from := a.active
	if from == "" || from == to || a.st.find(to) < 0 {
		return
	}
	v := a.views[from]
	if v == nil || !onClaude(v) {
		a.toast("Open the chat you want to continue first.")
		return
	}
	a.cont = &contState{from, to}
	v.c.Eval("window.__alts&&__alts.save({why:'continue'})")
}

func (a *App) continueTo(to string, m pageMsg, mdName, htmlPath, repo, memPath string) {
	i := a.st.find(to)
	if i < 0 {
		return
	}
	text := "Continue from my chat on my other account (\"" + m.Title + "\"). The whole chat is attached as " + mdName
	if memPath != "" {
		text += ", and it's also in " + repo + " at " + memPath
	}
	text += ". Read it first, then keep going from where it stopped."
	b, _ := json.Marshal(map[string]any{"text": text, "md": m.MD, "name": mdName, "saved": htmlPath})
	a.pendingCont[to] = string(b)
	a.toast("Saved. Opening a new chat on " + a.st.Accounts[i].Name + "...")
	if v := a.views[to]; v != nil {
		a.show(to)
		v.c.Navigate(newCodeURL)
		return
	}
	a.openAt(to, newCodeURL)
}

// ---------- GitHub (through the official GitHub CLI) ----------

func ghPath() string {
	if p, err := exec.LookPath("gh"); err == nil {
		return p
	}
	for _, p := range []string{
		filepath.Join(os.Getenv("ProgramFiles"), "GitHub CLI", "gh.exe"),
		filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "GitHub CLI", "gh.exe"),
	} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

func ghRun(args ...string) ([]byte, error) {
	gh := ghPath()
	if gh == "" {
		return nil, errors.New("GitHub CLI isn't installed")
	}
	cmd := exec.Command(gh, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000} // no console window
	out, err := cmd.Output()
	if ee, ok := err.(*exec.ExitError); ok {
		msg := strings.TrimSpace(strings.SplitN(strings.TrimSpace(string(ee.Stderr)), "\n", 2)[0])
		if msg == "" {
			msg = ee.Error()
		}
		return out, errors.New(msg)
	}
	return out, err
}

func ghSignedIn() bool {
	_, err := ghRun("auth", "status", "-h", "github.com")
	return err == nil
}

func ghUpload(repo, path string, content []byte, msg string) error {
	segs := strings.Split(path, "/")
	for i, s := range segs {
		segs[i] = url.PathEscape(s)
	}
	api := "repos/" + repo + "/contents/" + strings.Join(segs, "/")
	body := map[string]string{"message": msg, "content": base64.StdEncoding.EncodeToString(content)}
	if out, err := ghRun("api", api, "--jq", ".sha"); err == nil {
		if sha := strings.TrimSpace(string(out)); sha != "" {
			body["sha"] = sha // replacing an older save of the same chat
		}
	}
	f, err := os.CreateTemp("", "alts-*.json")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	json.NewEncoder(f).Encode(body)
	f.Close()
	_, err = ghRun("api", "--method", "PUT", api, "--input", f.Name())
	return err
}

// ghSetup installs the GitHub CLI and signs in when needed (in a window you can see), then lists
// your repos so you can pick where saved chats go.
func (a *App) ghSetup() {
	go func() {
		if ghPath() == "" || !ghSignedIn() {
			script := `$ErrorActionPreference='Continue'; Write-Host 'ALTS: setting up GitHub for saved chats' -ForegroundColor Cyan;` +
				`$gh = (Get-Command gh -ErrorAction SilentlyContinue).Source; if (-not $gh) { $gh = Join-Path $env:ProgramFiles 'GitHub CLI\gh.exe' };` +
				`if (-not (Test-Path $gh)) { winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements };` +
				`& $gh auth status -h github.com 2>$null; if ($LASTEXITCODE -ne 0) { & $gh auth login -h github.com -p https -w };` +
				`Write-Host 'Done. This window closes by itself.' -ForegroundColor Green; Start-Sleep 3`
			cmd := exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script)
			cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x00000010} // its own console window
			cmd.Run()
		}
		if !ghSignedIn() {
			a.post(func() { a.uiCall("repos", map[string]any{"error": "GitHub sign-in didn't finish. Try again."}) })
			return
		}
		out, err := ghRun("repo", "list", "--limit", "200", "--json", "nameWithOwner,isPrivate")
		var repos []map[string]any
		if err == nil {
			err = json.Unmarshal(out, &repos)
		}
		a.post(func() {
			if err != nil {
				a.uiCall("repos", map[string]any{"error": "Couldn't list your repos: " + err.Error()})
				return
			}
			a.uiCall("repos", map[string]any{"repos": repos})
		})
	}()
}

func (a *App) uiCall(fn string, v any) {
	if a.ui == nil || !a.uiReady {
		return
	}
	b, _ := json.Marshal(v)
	a.ui.Eval("window.ALTS&&ALTS." + fn + "(" + string(b) + ")")
}

// writeUsage leaves your usage where LINK picks it up for Claude (so Claude can pace itself).
func (a *App) writeUsage() {
	type acc struct {
		Name string  `json:"name"`
		S    float64 `json:"s"`
		W    float64 `json:"w"`
		SR   string  `json:"sr"`
		WR   string  `json:"wr"`
	}
	out := struct {
		Updated  string `json:"updated"`
		Active   string `json:"active"`
		Accounts []acc  `json:"accounts"`
	}{Updated: time.Now().Format(time.RFC3339)}
	for _, x := range a.st.Accounts {
		if u, ok := a.usage[x.ID]; ok {
			out.Accounts = append(out.Accounts, acc{x.Name, u.S, u.W, u.SR, u.WR})
		}
		if x.ID == a.active {
			out.Active = x.Name
		}
	}
	b, _ := json.MarshalIndent(out, "", " ")
	writeFileAtomic(filepath.Join(a.base, "usage.json"), b)
}

// tasks reads Claude's task list (notes/tasks.md in the memory repo) for the Tasks box.
func (a *App) tasks() {
	repo := a.st.MemoryRepo
	go func() {
		res := map[string]any{}
		if repo == "" {
			res["error"] = "Connect GitHub first (Saved chats > Set up, pick Claude's memory repo)."
		} else if out, err := ghRun("api", "repos/"+repo+"/contents/notes/tasks.md", "--jq", ".content"); err != nil {
			res["error"] = "Couldn't read the task list: " + err.Error()
		} else if b, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(out))); err != nil { // (Go skips GitHub's line breaks)
			res["error"] = "The task list looks broken."
		} else {
			res["list"] = parseTasks(string(b))
		}
		a.post(func() { a.uiCall("tasks", res) })
	}()
}

func (a *App) search(q string) {
	root := a.savedRoot()
	go func() {
		hits := searchChats(root, q, 60)
		if hits == nil {
			hits = []hit{}
		}
		a.post(func() { a.uiCall("results", map[string]any{"q": q, "hits": hits}) })
	}()
}
