package main

import (
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io/fs"
	"net"
	"net/http"
	"strings"
	"sync"
)

const (
	appVersion   = "1.0.0"
	taskbarMod   = "windows-11-taskbar-styler"
	startMenuMod = "windows-11-start-menu-styler"
)

//go:embed ui catalog-themes.json catalog-mods.json
var files embed.FS

// WHStatus: is Windhawk there and can DeskVerse drive it.
type WHStatus struct {
	Installed bool   `json:"installed"`
	OK        bool   `json:"ok"`
	Version   string `json:"version"`
	Why       string `json:"why,omitempty"`
}

// Platform = the PC side (real Windows, or a fake for tests on Linux).
type Platform interface {
	Windhawk() (*Windhawk, WHStatus)
	InstallWindhawk(say func(string)) error
	OpenWindhawk() error
	FxOn() bool
	SetFx(on bool) error
	Lively() bool
	OpenLively() error
}

type modInfo struct {
	ID    string `json:"id"`
	Group string `json:"group"`
}

type App struct {
	P     Platform
	token string
	mu    sync.Mutex // one change at a time
	busy  string
	bmu   sync.Mutex
	mods  []modInfo
}

func NewApp(p Platform) *App {
	b := make([]byte, 16)
	rand.Read(b)
	a := &App{P: p, token: hex.EncodeToString(b)}
	if j, err := files.ReadFile("catalog-mods.json"); err == nil {
		json.Unmarshal(j, &a.mods)
	}
	return a
}

func (a *App) say(s string) { a.bmu.Lock(); a.busy = s; a.bmu.Unlock() }

func (a *App) knownMod(id string) bool {
	if id == taskbarMod || id == startMenuMod {
		return true
	}
	for _, m := range a.mods {
		if m.ID == id {
			return true
		}
	}
	return false
}

type status struct {
	WH      WHStatus            `json:"wh"`
	Taskbar string              `json:"taskbar"`
	Start   string              `json:"start"`
	Mods    map[string]ModState `json:"mods"`
	Fx      bool                `json:"fx"`
	Lively  bool                `json:"lively"`
	Busy    string              `json:"busy"`
	Version string              `json:"version"`
}

func (a *App) status() status {
	s := status{Mods: map[string]ModState{}, Version: appVersion}
	w, st := a.P.Windhawk()
	s.WH = st
	if w != nil && st.OK {
		for _, m := range a.mods {
			s.Mods[m.ID] = w.State(m.ID)
		}
		for _, x := range []struct {
			id  string
			out *string
		}{{taskbarMod, &s.Taskbar}, {startMenuMod, &s.Start}} {
			ms := w.State(x.id)
			s.Mods[x.id] = ms
			if ms.Installed && ms.Enabled {
				*x.out = w.Setting(x.id, "theme")
			}
		}
	}
	s.Fx = a.P.FxOn()
	s.Lively = a.P.Lively()
	a.bmu.Lock()
	s.Busy = a.busy
	a.bmu.Unlock()
	return s
}

func (a *App) wh() (*Windhawk, error) {
	w, st := a.P.Windhawk()
	if w == nil || !st.OK {
		if st.Why != "" {
			return nil, errors.New(st.Why)
		}
		return nil, errors.New("Windhawk isn't installed yet")
	}
	return w, nil
}

func (a *App) ensure(w *Windhawk, id string) error {
	if w.State(id).Installed {
		return w.SetEnabled(id, true)
	}
	return w.Install(id, a.say)
}

type req struct {
	Kind string   `json:"kind"`
	V    string   `json:"v"`
	ID   string   `json:"id"`
	On   bool     `json:"on"`
	Off  []string `json:"off"`
}

func (a *App) do(cmd string, r req) (any, error) {
	if cmd == "status" {
		return a.status(), nil
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	defer a.say("")
	switch cmd {
	case "windhawk/install":
		a.say("Installing Windhawk")
		if err := a.P.InstallWindhawk(a.say); err != nil {
			return nil, err
		}
	case "windhawk/open":
		return nil, a.P.OpenWindhawk()
	case "theme":
		id := map[string]string{"taskbar": taskbarMod, "start": startMenuMod}[r.Kind]
		if id == "" {
			return nil, errors.New("unknown theme kind")
		}
		w, err := a.wh()
		if err != nil {
			return nil, err
		}
		if r.V == "" {
			if w.State(id).Installed {
				if err := w.SetSetting(id, "theme", ""); err != nil {
					return nil, err
				}
				if err := w.SetEnabled(id, false); err != nil {
					return nil, err
				}
			}
			break
		}
		if err := a.ensure(w, id); err != nil {
			return nil, err
		}
		if err := w.SetSetting(id, "theme", r.V); err != nil {
			return nil, err
		}
	case "mod":
		if !a.knownMod(r.ID) {
			return nil, errors.New("unknown mod")
		}
		w, err := a.wh()
		if err != nil {
			return nil, err
		}
		for _, o := range r.Off {
			if a.knownMod(o) && o != r.ID {
				if err := w.SetEnabled(o, false); err != nil {
					return nil, err
				}
			}
		}
		if r.On {
			err = a.ensure(w, r.ID)
		} else {
			err = w.SetEnabled(r.ID, false)
		}
		if err != nil {
			return nil, err
		}
	case "fx":
		if err := a.P.SetFx(r.On); err != nil {
			return nil, err
		}
	case "lively":
		return nil, a.P.OpenLively()
	case "reset":
		if w, err := a.wh(); err == nil {
			for _, id := range []string{taskbarMod, startMenuMod} {
				if w.State(id).Installed {
					w.SetSetting(id, "theme", "")
					w.SetEnabled(id, false)
				}
			}
			for _, m := range a.mods {
				w.SetEnabled(m.ID, false)
			}
		}
		if a.P.FxOn() {
			if err := a.P.SetFx(false); err != nil {
				return nil, err
			}
		}
	default:
		return nil, errors.New("unknown command")
	}
	return a.status(), nil
}

// Serve starts the local page + API on 127.0.0.1 and returns the URL to open.
func (a *App) Serve() (string, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", err
	}
	host := ln.Addr().String()
	ui, _ := fs.Sub(files, "ui")
	static := http.FileServer(http.FS(ui))
	mux := http.NewServeMux()
	mux.HandleFunc("/catalog.json", func(wr http.ResponseWriter, r *http.Request) {
		t, _ := files.ReadFile("catalog-themes.json")
		m, _ := files.ReadFile("catalog-mods.json")
		wr.Header().Set("Content-Type", "application/json")
		wr.Write([]byte(`{"themes":` + string(t) + `,"mods":` + string(m) + `}`))
	})
	mux.HandleFunc("/api/", func(wr http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.Header.Get("X-DV") != a.token {
			http.Error(wr, "no", http.StatusForbidden)
			return
		}
		var q req
		json.NewDecoder(http.MaxBytesReader(wr, r.Body, 1<<16)).Decode(&q)
		res, err := a.do(strings.TrimPrefix(r.URL.Path, "/api/"), q)
		wr.Header().Set("Content-Type", "application/json")
		if err != nil {
			json.NewEncoder(wr).Encode(map[string]any{"error": err.Error(), "status": a.status()})
			return
		}
		json.NewEncoder(wr).Encode(map[string]any{"ok": true, "status": res})
	})
	mux.Handle("/", static)
	srv := &http.Server{Handler: http.HandlerFunc(func(wr http.ResponseWriter, r *http.Request) {
		if r.Host != host { // blocks DNS-rebinding pages
			http.Error(wr, "no", http.StatusForbidden)
			return
		}
		wr.Header().Set("Cache-Control", "no-store")
		mux.ServeHTTP(wr, r)
	})}
	go srv.Serve(ln)
	return "http://" + host + "/#" + a.token, nil
}
