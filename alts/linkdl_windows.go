//go:build windows && !clip

package main

// A download link in a chat (a GitHub file: .exe, .zip, .apk...): ALTS saves it into Downloads itself
// instead of sending you to Edge. Files from a GitHub account you said is yours open with no Windows
// warning (asked once); from anywhere else Windows checks them like any download.

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	mbYesNo      = 0x0004
	mbIconQuest  = 0x0020
	idYes        = 6
	mbTopmostSet = 0x50000 // on top + to the front
)

func (a *App) trustedOwner(owner string) bool {
	if o, _, ok := strings.Cut(a.st.MemoryRepo, "/"); ok && strings.EqualFold(o, owner) {
		return true
	}
	for _, t := range a.st.TrustedGitHub {
		if strings.EqualFold(t, owner) {
			return true
		}
	}
	return false
}

func (a *App) downloadLink(id, link string) {
	dl, owner, name := githubFile(link)
	name = cleanDownloadName(name)
	dir := a.filesDir()
	if dl == "" || name == "" || dir == "" {
		shellOpen(link)
		return
	}
	os.MkdirAll(dir, 0o755)
	target := uniqueName(dir, name, func(p string) bool {
		if a.dlTaken[strings.ToLower(p)] {
			return true
		}
		_, err := os.Lstat(p)
		return err == nil
	})
	a.dlTaken[strings.ToLower(target)] = true
	acct := ""
	if i := a.st.find(id); i >= 0 {
		acct = a.st.Accounts[i].Name
	}
	tmp := target + ".alts-part"
	a.toast("Downloading " + name + "...")
	a.fileLog("link download: " + dl + " -> " + target)
	go func() {
		tick := func(done, total int64) {
			a.post(func() { a.toast(fmt.Sprintf("Downloading %s... %d%%", name, done*100/total)) })
		}
		size, hash, err := fetchTo(dl, tmp, "", tick)
		if err != nil {
			if alt := rawLink(dl); alt != "" || strings.HasPrefix(dl, "https://raw.githubusercontent.com/") {
				if alt == "" {
					alt = dl
				}
				if out, gerr := ghRun("auth", "token"); gerr == nil { // a private repo: try with your GitHub sign-in
					if s2, h2, e2 := fetchTo(alt, tmp, strings.TrimSpace(string(out)), tick); e2 == nil {
						size, hash, err = s2, h2, nil
					}
				}
			}
		}
		a.post(func() {
			delete(a.dlTaken, strings.ToLower(target))
			if err != nil {
				os.Remove(tmp)
				a.fileLog("link download failed: " + dl + ": " + err.Error())
				a.toast("Couldn't download " + name + ": " + err.Error() + ". Tell Claude.")
				return
			}
			final := target
			if _, e := os.Lstat(final); e == nil {
				final = uniqueName(dir, name, func(p string) bool { _, e := os.Lstat(p); return e == nil })
			}
			if e := os.Rename(tmp, final); e != nil {
				os.Remove(tmp)
				a.toast("Couldn't save " + name + ": " + e.Error())
				return
			}
			trusted := a.trustedOwner(owner)
			if !trusted {
				remark(final) // Windows checks it like any other download
			}
			a.files.add(fileRec{ID: newFileID(), Name: filepath.Base(final), Path: final, Size: size, Hash: hash,
				Added: time.Now().Unix(), From: "github.com/" + owner, Account: acct})
			a.files.New = true
			a.saveFileList()
			a.push()
			a.sendFiles()
			a.fileLog("link download saved: " + final + " (" + itoa(int(size)) + " bytes, sha256 " + hash + ", trusted " + fmt.Sprint(trusted) + ")")
			if !trusted && msgBox("Saved "+filepath.Base(final)+" to Downloads.\n\nIt came from github.com/"+owner+
				". Is that YOUR GitHub (where Claude puts your apps)?\n\nYes = files from there open with no Windows warning from now on.\nNo = Windows keeps checking them.",
				mbYesNo|mbIconQuest|mbTopmostSet) == idYes {
				a.st.TrustedGitHub = append(a.st.TrustedGitHub, owner)
				a.save()
				unmark(final)
				trusted = true
			}
			if trusted {
				a.toast("Saved " + filepath.Base(final) + " to Downloads (" + mbText(size) + "). No warning.")
			} else {
				a.toast("Saved " + filepath.Base(final) + " to Downloads (" + mbText(size) + ").")
			}
		})
	}()
}
