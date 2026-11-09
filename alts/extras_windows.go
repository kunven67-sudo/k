//go:build windows && !clip

package main

// What ui/extras.js asks for: the emoji list + stickers for the chat-box picker, a sticker's
// picture, and the "your limit is back" ping.

import (
	"encoding/base64"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unsafe"

	"golang.org/x/sys/windows/registry"
)

// startClipHelper starts ALTS Clipboard (ALTS-Clip.exe, a separate app next to ALTS.exe) if it isn't running.
// It also clears the start-with-Windows entry the first 1.5.0 test build left (that one pointed at ALTS.exe).
func startClipHelper() {
	if k, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Run`, registry.QUERY_VALUE|registry.SET_VALUE); err == nil {
		if v, _, err := k.GetStringValue("ALTS Clipboard"); err == nil && strings.Contains(v, "--clip") {
			k.DeleteValue("ALTS Clipboard")
		}
		k.Close()
	}
	if w, _, _ := pFindWindowW.Call(uintptr(unsafe.Pointer(u16("ALTS.Clip"))), 0); w != 0 {
		return
	}
	exe, err := os.Executable()
	if err != nil {
		return
	}
	// the newest one next to ALTS (Edge names a second download "ALTS-Clip (1).exe")
	clip, newest := "", time.Time{}
	if m, _ := filepath.Glob(filepath.Join(filepath.Dir(exe), "ALTS-Clip*.exe")); len(m) > 0 {
		for _, f := range m {
			if st, err := os.Stat(f); err == nil && st.ModTime().After(newest) {
				clip, newest = f, st.ModTime()
			}
		}
	}
	if clip != "" {
		exec.Command(clip, "--boot").Start() // quiet: it doesn't pop up when ALTS starts it
	}
}

// getMemes downloads the meme stickers for ALTS Clipboard and the chat-box picker when they're missing or old.
func (a *App) getMemes() {
	dir := filepath.Join(a.clipDir(), "memes")
	if !loadMemes(dir).stale() {
		return
	}
	go func() {
		x, err := refreshMemes(dir, webGet)
		if err != nil {
			a.post(func() { a.fileLog("memes: " + err.Error()) })
			return
		}
		a.post(func() { a.fileLog("memes: " + itoa(len(x.Memes)) + " ready") })
	}()
}

var (
	pMessageBeep   = user32.NewProc("MessageBeep")
	pFlashWindowEx = user32.NewProc("FlashWindowEx")
)

type sticker struct {
	File  string `json:"file"`
	Name  string `json:"name"`
	Thumb string `json:"thumb"`
	Kind  string `json:"kind"` // "meme" or "mine"
}

func (a *App) clipDir() string { return filepath.Join(a.base, "clip") }

func (a *App) emojiData() map[string]any {
	em, _ := clipUI.ReadFile("ui/emoji.txt")
	list := []sticker{}
	data := func(p string) string {
		b, err := os.ReadFile(p)
		if err != nil || len(b) > 8<<20 {
			return ""
		}
		mime := "image/png"
		if strings.HasSuffix(strings.ToLower(p), ".jpg") {
			mime = "image/jpeg"
		}
		return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(b)
	}
	st := loadClip(filepath.Join(a.clipDir(), "clip.json"))
	for _, f := range st.Stickers {
		if d := data(filepath.Join(a.clipDir(), "stickers", f)); d != "" {
			list = append(list, sticker{File: f, Name: "mine", Thumb: d, Kind: "mine"})
		}
	}
	memeDir := filepath.Join(a.clipDir(), "memes")
	for _, m := range loadMemes(memeDir).Memes { // ALTS Clipboard downloads these
		if d := data(filepath.Join(memeDir, memeThumb(m.File))); d != "" {
			list = append(list, sticker{File: m.File, Name: strings.ToLower(m.Name), Thumb: d, Kind: "meme"})
		}
	}
	return map[string]any{"emoji": string(em), "stickers": list}
}

// stickerBytes: the picture to attach, its file name and type.
func (a *App) stickerBytes(file, kind string) ([]byte, string, string) {
	var p string
	if kind == "meme" {
		name, ok := memeFile(file)
		if !ok {
			return nil, "", ""
		}
		p = filepath.Join(a.clipDir(), "memes", name)
	} else {
		name, ok := stickerName(file)
		if !ok {
			return nil, "", ""
		}
		p = filepath.Join(a.clipDir(), "stickers", name)
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return nil, "", ""
	}
	if strings.HasSuffix(strings.ToLower(p), ".jpg") {
		return b, "meme.jpg", "image/jpeg"
	}
	return b, "sticker.png", "image/png"
}

type flashInfo struct {
	Size    uint32
	Hwnd    uintptr
	Flags   uint32
	Count   uint32
	Timeout uint32
}

// ping: the limit is back and there are saved messages. Sound, flash, and ALTS comes up on that account.
func (a *App) ping(id, text string) {
	pMessageBeep.Call(0x40)                                // the "info" sound
	fi := flashInfo{Hwnd: a.main, Flags: 3 | 12, Count: 5} // flash caption + taskbar until ALTS is in front
	fi.Size = uint32(unsafe.Sizeof(fi))
	pFlashWindowEx.Call(uintptr(unsafe.Pointer(&fi)))
	if r, _, _ := pIsIconic.Call(a.main); r != 0 {
		pShowWindow.Call(a.main, swRestore)
	}
	pSetForegroundWindow.Call(a.main) // if Windows won't bring it up, the flashing taskbar button shows it
	if id != a.active && a.views[id] != nil {
		a.show(id)
	}
	if text != "" {
		a.toast(text)
	}
}
