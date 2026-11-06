//go:build windows && !clip

package main

// Files from claude.ai's Files panel (the Download button in extras.js): the page already has the
// file, it sends it here in pieces and ALTS writes it into Downloads itself. Handing an .exe to the
// browser part instead gets it blocked ("this type of file can harm your device"). Only Claude pages
// reach this (page() checks), the name is cleaned, and it only ever writes into your Downloads folder.

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"hash"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type panelSave struct {
	f           *os.File
	tmp, target string
	name, acct  string
	size, got   int64
	h           hash.Hash
}

var panelSaves = map[string]*panelSave{}

func (a *App) panelSave(id string, m pageMsg) {
	v := a.views[id]
	reply := func(ok bool, path, errText string, size int64) {
		if v != nil {
			v.c.Eval(jsCall("fileSaved", map[string]any{"id": m.ID, "ok": ok, "path": path, "name": filepath.Base(path), "size": size, "error": errText}))
		}
	}
	switch m.T {
	case "fsave-start":
		name := cleanDownloadName(m.Name)
		dir := a.filesDir()
		if m.ID == "" || len(m.ID) > 40 || panelSaves[m.ID] != nil || name == "" || dir == "" || m.Size < 0 || m.Size > 4<<30 {
			reply(false, "", "bad file", 0)
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
		tmp := target + ".alts-part"
		f, err := os.Create(tmp)
		if err != nil {
			reply(false, "", err.Error(), 0)
			return
		}
		acct := ""
		if i := a.st.find(id); i >= 0 {
			acct = a.st.Accounts[i].Name
		}
		a.dlTaken[strings.ToLower(target)] = true
		panelSaves[m.ID] = &panelSave{f: f, tmp: tmp, target: target, name: name, acct: acct, size: m.Size, h: sha256.New()}
	case "fsave-part":
		s := panelSaves[m.ID]
		if s == nil {
			return
		}
		b, err := base64.StdEncoding.DecodeString(m.B64)
		if err == nil && s.got+int64(len(b)) <= s.size {
			_, err = s.f.Write(b)
		} else if err == nil {
			err = os.ErrInvalid
		}
		if err != nil {
			a.dropPanelSave(m.ID)
			reply(false, "", "couldn't write it: "+err.Error(), 0)
			return
		}
		s.h.Write(b)
		s.got += int64(len(b))
	case "fsave-end":
		s := panelSaves[m.ID]
		if s == nil {
			return
		}
		if s.got != s.size {
			a.dropPanelSave(m.ID)
			reply(false, "", "it came in cut short", 0)
			return
		}
		s.f.Close()
		delete(panelSaves, m.ID)
		delete(a.dlTaken, strings.ToLower(s.target))
		target := s.target
		if _, err := os.Lstat(target); err == nil { // something took that name meanwhile
			target = uniqueName(filepath.Dir(target), s.name, func(p string) bool { _, err := os.Lstat(p); return err == nil })
		}
		if err := os.Rename(s.tmp, target); err != nil {
			os.Remove(s.tmp)
			reply(false, "", err.Error(), 0)
			return
		}
		hash := hex.EncodeToString(s.h.Sum(nil))
		a.files.add(fileRec{ID: newFileID(), Name: filepath.Base(target), Path: target, Size: s.size, Hash: hash,
			Added: time.Now().Unix(), From: "claude.ai Files panel", Account: s.acct})
		a.files.New = true
		a.saveFileList()
		a.push()
		a.sendFiles()
		a.fileLog("files panel: saved " + target + " (" + itoa(int(s.size)) + " bytes, sha256 " + hash + ")")
		reply(true, target, "", s.size)
		a.toast("Saved " + filepath.Base(target) + " to Downloads. No warning.")
	case "fsave-show":
		if a.files.has(m.Path) {
			showInFolder(m.Path)
		}
	}
}

func (a *App) dropPanelSave(key string) {
	if s := panelSaves[key]; s != nil {
		s.f.Close()
		os.Remove(s.tmp)
		delete(a.dlTaken, strings.ToLower(s.target))
		delete(panelSaves, key)
	}
}
