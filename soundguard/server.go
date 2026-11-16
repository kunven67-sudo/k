package main

import (
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"strings"
	"time"
)

//go:embed ui
var uiFiles embed.FS

type req struct {
	Cmd  string          `json:"cmd"`
	ID   string          `json:"id"`
	V    float64         `json:"v"`
	On   bool            `json:"on"`
	Side string          `json:"side"`
	Key  string          `json:"key"`
	Set  json.RawMessage `json:"set"`
}

// Serve starts the local page + API on 127.0.0.1 (random port, random token).
func (a *App) Serve(port int) (string, error) {
	b := make([]byte, 16)
	rand.Read(b)
	a.token = hex.EncodeToString(b)
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return "", err
	}
	host := ln.Addr().String()
	sub, _ := fs.Sub(uiFiles, "ui")
	static := http.FileServer(http.FS(sub))
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Host != host {
			http.Error(w, "no", 403)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			if r.Header.Get("X-SG-Token") != a.token {
				http.Error(w, "no", 403)
				return
			}
			a.api(w, r)
			return
		}
		static.ServeHTTP(w, r)
	})
	go http.Serve(ln, mux)
	return "http://" + host + "/?t=" + a.token, nil
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func (a *App) api(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/api/state":
		writeJSON(w, a.State())
	case "/api/live":
		writeJSON(w, a.Live())
	case "/api/do":
		var q req
		if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		res, err := a.Do(q)
		if err != nil {
			writeJSON(w, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, map[string]any{"ok": true, "res": res})
	default:
		if a.extraAPI != nil && a.extraAPI(w, r) {
			return
		}
		http.NotFound(w, r)
	}
}

func (a *App) State() map[string]any {
	st, head, sub := a.Status()
	a.mu.Lock()
	defer a.mu.Unlock()
	alerts := []*Alert{}
	for _, al := range a.alerts {
		if time.Now().After(al.snooze) {
			alerts = append(alerts, al)
		}
	}
	logs := make([]LogEntry, 0, len(a.log))
	for i := len(a.log) - 1; i >= 0 && len(logs) < 80; i-- {
		logs = append(logs, a.log[i])
	}
	usb := ""
	for _, d := range a.devs {
		if d.USB() && d.State == "active" {
			usb = d.Name
		}
	}
	pausedUntil := int64(0)
	if time.Now().Before(a.pausedAll) {
		pausedUntil = a.pausedAll.UnixMilli()
	}
	return map[string]any{
		"v": appVersion, "admin": a.PC.Admin(), "installed": a.PC.Installed(), "startup": a.PC.Startup(),
		"status": st, "headline": head, "sub": sub,
		"out": a.out, "in": a.in, "outPlugged": a.outPlugged, "inPlugged": a.inPlugged,
		"devices": a.devs, "sessions": a.sessions, "log": logs, "alerts": alerts, "settings": a.set,
		"engine": a.engine, "engineWhy": a.engineWhy, "driver": a.driverInfo, "drivers": a.drivers,
		"services": a.services, "privacyOK": a.privacyOK, "fixesToday": a.fixesToday, "pausedUntil": pausedUntil,
		"since": a.started.UnixMilli(), "usb": usb, "busy": a.busy, "now": time.Now().UnixMilli(),
	}
}

var lastSess struct {
	t time.Time
	s []Session
}

func (a *App) Live() map[string]any {
	a.mu.Lock()
	out, in := a.out, a.in
	a.mu.Unlock()
	res := map[string]any{"o": 0.0, "i": 0.0}
	if out != nil && out.State == "active" {
		res["o"] = a.PC.Peak(out.ID)
		if time.Since(lastSess.t) > 250*time.Millisecond {
			lastSess.t = time.Now()
			lastSess.s = a.PC.Sessions(out.ID)
		}
		list := []map[string]any{}
		for _, s := range lastSess.s {
			if s.PID == a.pid {
				continue
			}
			list = append(list, map[string]any{"n": s.Name, "p": s.Peak, "a": s.Active})
		}
		res["s"] = list
	}
	if in != nil && in.State == "active" {
		a.PC.MicListen(in.ID)
		res["i"] = a.PC.MicLevel()
		res["listen"] = true
	}
	return res
}

func (a *App) Do(q req) (any, error) {
	switch q.Cmd {
	case "volume":
		v := q.V
		if v < 0 {
			v = 0
		}
		if v > 1 {
			v = 1
		}
		err := a.PC.SetVolume(q.ID, v)
		a.mu.Lock()
		if a.in != nil && q.ID == a.in.ID && v >= 0.3 {
			a.set.MicLevel = v
			a.saveSettings()
		}
		if a.out != nil && q.ID == a.out.ID && v >= 0.1 {
			a.set.LastVol = v
		}
		a.mu.Unlock()
		return nil, err
	case "mute":
		err := a.PC.SetMute(q.ID, q.On)
		if q.On { // muting from SoundGuard = on purpose: don't fight it for an hour
			a.mu.Lock()
			key := "outMute"
			if a.in != nil && q.ID == a.in.ID {
				key = "inMute"
			}
			a.fixers[key] = &fixer{paused: time.Now().Add(time.Hour)}
			a.mu.Unlock()
		} else {
			a.mu.Lock()
			delete(a.fixers, "outMute")
			delete(a.fixers, "inMute")
			a.mu.Unlock()
		}
		return nil, err
	case "test":
		a.mu.Lock()
		out := a.out
		a.busy = "test"
		a.mu.Unlock()
		defer func() { a.mu.Lock(); a.busy = ""; a.mu.Unlock() }()
		if out == nil || out.State != "active" {
			return nil, fmt.Errorf("no headphones to play on")
		}
		peak, err := a.PC.PlayTest(out.ID, q.Side)
		if err == nil && peak <= 0.0005 {
			a.mu.Lock()
			a.retestAt = time.Now()
			a.mu.Unlock()
		}
		return map[string]any{"peak": peak}, err
	case "heard":
		a.mu.Lock()
		a.addLog("info", "Test sound", map[string]string{"both": "You heard both sides", "one": "You heard only one side", "none": "You heard nothing"}[q.Key])
		a.mu.Unlock()
		return nil, nil
	case "pick":
		a.mu.Lock()
		if q.Key == "out" {
			a.set.OutID = q.ID
		} else {
			a.set.InID = q.ID
		}
		a.saveSettings()
		a.mu.Unlock()
		go a.Tick()
		return nil, nil
	case "settings":
		a.mu.Lock()
		keep := a.set
		if err := json.Unmarshal(q.Set, &a.set); err != nil {
			a.set = keep
			a.mu.Unlock()
			return nil, err
		}
		if a.set.MicLevel < 0.3 || a.set.MicLevel > 1 {
			a.set.MicLevel = keep.MicLevel
		}
		a.saveSettings()
		a.mu.Unlock()
		return nil, nil
	case "fixnow":
		a.mu.Lock()
		a.pausedAll = time.Time{}
		a.fixers = map[string]*fixer{}
		a.retestAt = time.Now()
		a.mu.Unlock()
		a.Tick()
		return nil, nil
	case "pause":
		a.mu.Lock()
		if q.On {
			a.pausedAll = time.Now().Add(time.Hour)
			a.addLog("info", "Fixes paused for 1 hour", "Still watching, not changing anything")
		} else {
			a.pausedAll = time.Time{}
			a.addLog("info", "Fixes back on", "")
		}
		a.mu.Unlock()
		return nil, nil
	case "restartAudio":
		err := a.PC.RestartAudio()
		a.mu.Lock()
		if err == nil {
			a.addLog("fix", "You asked to restart Windows Audio", "Restarted it")
			a.retestAt = time.Now().Add(3 * time.Second)
		}
		a.mu.Unlock()
		return nil, err
	case "restartPC":
		return nil, a.PC.RestartPC()
	case "later":
		a.mu.Lock()
		for _, al := range a.alerts {
			al.snooze = time.Now().Add(30 * time.Minute)
			al.told = false
		}
		a.mu.Unlock()
		return nil, nil
	case "startup":
		return nil, a.PC.SetStartup(q.On)
	case "uninstall":
		err := a.PC.Uninstall()
		if err == nil && a.Quit != nil {
			go func() { time.Sleep(500 * time.Millisecond); a.Quit() }()
		}
		return nil, err
	}
	return nil, fmt.Errorf("unknown command %q", q.Cmd)
}
