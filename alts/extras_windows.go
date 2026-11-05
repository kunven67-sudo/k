//go:build windows

package main

// What ui/extras.js asks for: the emoji list + stickers for the chat-box picker, a sticker's
// picture, and the "your limit is back" ping.

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"unsafe"
)

var (
	pMessageBeep   = user32.NewProc("MessageBeep")
	pFlashWindowEx = user32.NewProc("FlashWindowEx")
)

type sticker struct {
	File  string `json:"file"`
	Name  string `json:"name"`
	Thumb string `json:"thumb"`
	Mine  bool   `json:"mine,omitempty"`
}

func (a *App) clipDir() string { return filepath.Join(a.base, "clip") }

func (a *App) emojiData() map[string]any {
	em, _ := clipUI.ReadFile("ui/emoji.txt")
	var list []sticker
	st := loadClip(filepath.Join(a.clipDir(), "clip.json"))
	for _, f := range st.Stickers {
		if b, err := os.ReadFile(filepath.Join(a.clipDir(), "stickers", f)); err == nil && len(b) < 8<<20 {
			list = append(list, sticker{File: f, Name: "mine", Thumb: "data:image/png;base64," + base64.StdEncoding.EncodeToString(b), Mine: true})
		}
	}
	if es, err := builtinStickers.ReadDir("ui/stickers"); err == nil {
		for _, e := range es {
			b, err := builtinStickers.ReadFile("ui/stickers/" + e.Name())
			if err != nil {
				continue
			}
			name := strings.ReplaceAll(strings.TrimSuffix(e.Name(), ".png"), "_", " ")
			list = append(list, sticker{File: e.Name(), Name: name, Thumb: "data:image/png;base64," + base64.StdEncoding.EncodeToString(b)})
		}
	}
	return map[string]any{"emoji": string(em), "stickers": list}
}

func (a *App) stickerBytes(file string, mine bool) ([]byte, string) {
	name, ok := stickerName(file)
	if !ok {
		return nil, ""
	}
	if mine {
		b, err := os.ReadFile(filepath.Join(a.clipDir(), "stickers", name))
		if err != nil {
			return nil, ""
		}
		return b, "sticker.png"
	}
	b, err := builtinStickers.ReadFile("ui/stickers/" + name)
	if err != nil {
		return nil, ""
	}
	return b, name
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
	fg, _, _ := pGetForegroundWin.Call()
	me, _, _ := pGetCurrentThread.Call()
	ft, _, _ := pGetWindowThreadID.Call(fg, 0)
	if ft != 0 && ft != me {
		pAttachThreadInput.Call(me, ft, 1)
	}
	pSetForegroundWindow.Call(a.main)
	if ft != 0 && ft != me {
		pAttachThreadInput.Call(me, ft, 0)
	}
	if id != a.active && a.views[id] != nil {
		a.show(id)
	}
	if text != "" {
		a.toast(text)
	}
}
