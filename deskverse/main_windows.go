package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"unsafe"

	webview2 "github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
)

func msg(text string) {
	t, _ := windows.UTF16PtrFromString(text)
	c, _ := windows.UTF16PtrFromString("DeskVerse")
	procMessageBox.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), 0x40)
}

func main() {
	base := filepath.Join(os.Getenv("LOCALAPPDATA"), "DeskVerse")
	os.MkdirAll(base, 0o755)
	p := &winPlatform{base: base}

	// DeskVerse.exe -selftest <out.json> : used by the Windows test run.
	if len(os.Args) > 2 && os.Args[1] == "-selftest" {
		os.Exit(selftest(NewApp(p), os.Args[2]))
	}

	name, _ := windows.UTF16PtrFromString("DeskVerse-one-window")
	if _, err := windows.CreateMutex(nil, false, name); err == windows.ERROR_ALREADY_EXISTS {
		title, _ := windows.UTF16PtrFromString("DeskVerse")
		if h, _, _ := procFindWindow.Call(0, uintptr(unsafe.Pointer(title))); h != 0 {
			procShowWindow.Call(h, 9) // SW_RESTORE
			procSetFg.Call(h)
		}
		return
	}

	app := NewApp(p)
	url, err := app.Serve()
	if err != nil {
		msg("DeskVerse couldn't start: " + err.Error())
		return
	}
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		AutoFocus: true,
		DataPath:  filepath.Join(base, "webview"),
		WindowOptions: webview2.WindowOptions{
			Title: "DeskVerse", Width: 1320, Height: 860, IconId: 1, Center: true,
		},
	})
	if w == nil {
		msg("DeskVerse needs Microsoft Edge WebView2 (it comes with Windows 11). Update Windows or install WebView2 Runtime from microsoft.com, then open DeskVerse again.")
		return
	}
	defer w.Destroy()
	w.SetSize(1320, 860, webview2.HintNone)
	w.SetSize(1000, 640, webview2.HintMin)
	w.Navigate(url)
	w.Run()
}

func selftest(a *App, out string) int {
	log := map[string]any{}
	step := func(name, cmd string, r req) bool {
		res, err := a.do(cmd, r)
		e := ""
		if err != nil {
			e = err.Error()
		}
		log[name] = map[string]any{"err": e, "status": res}
		return err == nil
	}
	ok := true
	if _, st := a.P.Windhawk(); !st.Installed {
		ok = step("1-install-windhawk", "windhawk/install", req{}) && ok
	}
	ok = step("2-taskbar-bubbles", "theme", req{Kind: "taskbar", V: "Bubbles"}) && ok
	ok = step("3-start-sidebyside", "theme", req{Kind: "start", V: "SideBySide"}) && ok
	ok = step("4-genie-on", "mod", req{ID: "macos-minimize-animation", On: true, Off: []string{"classic-min-max-animations"}}) && ok
	ok = step("5-classic-on", "mod", req{ID: "classic-min-max-animations", On: true, Off: []string{"macos-minimize-animation"}}) && ok
	ok = step("6-fx-on", "fx", req{On: true}) && ok
	ok = step("7-fx-off", "fx", req{On: false}) && ok
	if os.Getenv("DV_NORESET") == "" {
		ok = step("8-reset", "reset", req{}) && ok
	} else {
		step("8-theme-again", "theme", req{Kind: "taskbar", V: "DockLike"})
	}
	w, st := a.P.Windhawk()
	log["windhawk"] = st
	if w != nil {
		filesFound := map[string][]string{}
		for _, d := range []string{"Engine/Mods/32", "Engine/Mods/64", "ModsSource"} {
			ents, _ := os.ReadDir(filepath.Join(w.AppData, d))
			for _, e := range ents {
				filesFound[d] = append(filesFound[d], e.Name())
			}
		}
		log["files"] = filesFound
		log["appdata"] = w.AppData
		reg := map[string]any{}
		for _, id := range []string{taskbarMod, startMenuMod, "macos-minimize-animation", "classic-min-max-animations"} {
			lib, _ := w.Reg.GetString(id, "LibraryFileName")
			inc, _ := w.Reg.GetString(id, "Include")
			dis, _ := w.Reg.GetDWORD(id, "Disabled")
			sct, _ := w.Reg.GetDWORD(id, "SettingsChangeTime")
			reg[id] = map[string]any{"lib": lib, "include": inc, "disabled": dis, "settingsChangeTime": sct, "theme": w.Setting(id, "theme")}
		}
		log["reg"] = reg
	}
	log["ok"] = ok
	j, _ := json.MarshalIndent(log, "", " ")
	os.WriteFile(out, j, 0o644)
	if ok {
		return 0
	}
	return 1
}
