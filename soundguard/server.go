package main

// server.go = the local web server the SOUNDGUARD window talks to.
// Only 127.0.0.1, random port, random token (never written to disk),
// Host header checked (no DNS-rebinding tricks from web pages).

import (
	"crypto/rand"
	"crypto/subtle"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io/fs"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

//go:embed ui
var uiFiles embed.FS

type Req struct {
	Act string  `json:"act"`
	ID  string  `json:"id"`
	On  bool    `json:"on"`
	V   float64 `json:"v"`
}

// Server modes: "guard" (the real thing), "setup" (first run, not installed yet), "demo" (Linux tests).
type Server struct {
	G     *Guardian
	Mode  string
	token string
	port  int
	// platform hooks (nil = not available)
	OnShow  func()
	OnQuit  func()
	Extra   map[string]func(Req) (any, error)
	SetupSt func() any
	showMu  sync.Mutex
	showAt  time.Time
	hits    int64 // how many times a window asked for state (tests)
}

func (s *Server) stateHits() int64 { return atomic.LoadInt64(&s.hits) }

func newToken() string {
	b := make([]byte, 24)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// Start listens on 127.0.0.1 (port 0 = random). Returns the page URL with the token.
func (s *Server) Start(port int) (string, error) {
	s.token = newToken()
	ln, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(port))
	if err != nil {
		return "", err
	}
	s.port = ln.Addr().(*net.TCPAddr).Port
	sub, _ := fs.Sub(uiFiles, "ui")
	static := http.FileServer(http.FS(sub))
	mux := http.NewServeMux()
	mux.HandleFunc("/api/", s.api)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'")
		static.ServeHTTP(w, r)
	})
	srv := &http.Server{Handler: s.hostCheck(mux), ReadHeaderTimeout: 10 * time.Second}
	go srv.Serve(ln)
	return s.URL(""), nil
}

func (s *Server) Port() int { return s.port }

func (s *Server) URL(view string) string {
	u := "http://127.0.0.1:" + strconv.Itoa(s.port) + "/"
	if view != "" {
		u += "?view=" + view
	}
	return u + "#t=" + s.token
}

func (s *Server) hostCheck(h http.Handler) http.Handler {
	ok1 := "127.0.0.1:" + strconv.Itoa(s.port)
	ok2 := "localhost:" + strconv.Itoa(s.port)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Host != ok1 && r.Host != ok2 {
			http.Error(w, "bad host", http.StatusForbidden)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func (s *Server) authed(r *http.Request) bool {
	t := r.Header.Get("X-SG-Token")
	return len(t) == len(s.token) && subtle.ConstantTimeCompare([]byte(t), []byte(s.token)) == 1
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(v)
}

func (s *Server) api(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/api/ping": // no token: tells a 2nd copy of the exe that we're running
		writeJSON(w, map[string]any{"app": "soundguard", "version": appVersion, "mode": s.Mode})
		return
	case "/api/show": // no token: only opens the window (2nd copy started = they want the window)
		if r.Method != http.MethodPost {
			http.Error(w, "post only", http.StatusMethodNotAllowed)
			return
		}
		s.showMu.Lock()
		ok := time.Since(s.showAt) > time.Second
		if ok {
			s.showAt = time.Now()
		}
		s.showMu.Unlock()
		if ok && s.OnShow != nil {
			go s.OnShow()
		}
		writeJSON(w, map[string]any{"ok": true})
		return
	}
	if !s.authed(r) {
		http.Error(w, "no", http.StatusForbidden)
		return
	}
	switch r.URL.Path {
	case "/api/state":
		atomic.AddInt64(&s.hits, 1)
		if s.G == nil {
			st := map[string]any{"version": appVersion, "mode": s.Mode}
			if s.SetupSt != nil {
				st["setup"] = s.SetupSt()
			}
			writeJSON(w, st)
			return
		}
		st := s.G.State()
		st.Mode = s.Mode
		writeJSON(w, st)
	case "/api/live":
		if s.G == nil {
			writeJSON(w, map[string]float64{"out": 0, "in": 0})
			return
		}
		o, i := s.G.Live()
		writeJSON(w, map[string]float64{"out": o, "in": i})
	case "/api/do":
		if r.Method != http.MethodPost {
			http.Error(w, "post only", http.StatusMethodNotAllowed)
			return
		}
		var q Req
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&q); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		res, err := s.do(q)
		if err != nil {
			writeJSON(w, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, map[string]any{"ok": true, "res": res})
	default:
		http.NotFound(w, r)
	}
}

func (s *Server) do(q Req) (any, error) {
	if f, ok := s.Extra[q.Act]; ok {
		return f(q)
	}
	g := s.G
	if g == nil {
		return nil, errors.New("not running yet")
	}
	switch q.Act {
	case "fix":
		g.Do(g.FixNow)
	case "testSound":
		g.Do(g.StartSoundTest)
	case "heard":
		on := q.On
		g.Do(func() { g.HeardAnswer(on) })
	case "testMic":
		g.Do(g.StartMicTest)
	case "look":
		if q.ID != "rack" && q.ID != "mix" && q.ID != "simple" {
			return nil, errors.New("bad look")
		}
		g.mu.Lock()
		g.set.Look = q.ID
		g.saveLocked()
		g.mu.Unlock()
		g.Do(func() {})
	case "setting":
		g.SetSetting(q.ID, q.On)
		g.Do(func() {})
	case "volume":
		id, v := q.ID, q.V
		if v < 0 || v > 1 {
			return nil, errors.New("volume must be 0..1")
		}
		g.Do(func() { g.UserVolume(id, v) })
	case "mute":
		id, on := q.ID, q.On
		g.Do(func() { g.UserMute(id, on) })
	case "default":
		id := q.ID
		g.Do(func() { g.UserDefault(id) })
	case "restartNow":
		return nil, g.b.RebootPC()
	case "restartLater":
		g.Do(g.RestartLater)
	case "popupClosed":
		g.Do(g.PopupClosed)
	case "useTV":
		errc := make(chan error, 1)
		g.Do(func() { errc <- g.UseTV() })
		select {
		case err := <-errc:
			return nil, err
		case <-time.After(8 * time.Second):
			return nil, errors.New("timed out")
		}
	case "driverCheck":
		g.DriverCheck()
	case "driverInstall":
		g.DriverInstall(q.ID)
	case "openSound":
		return nil, g.b.OpenSoundSettings()
	case "clearLog":
		g.mu.Lock()
		g.events = nil
		g.saveLocked()
		g.mu.Unlock()
		g.Do(func() {})
	default:
		return nil, errors.New("unknown action " + strings.ReplaceAll(q.Act, "\n", ""))
	}
	return nil, nil
}

// ---- manual changes from the window (they count as "you did it") ----

func (g *Guardian) UserVolume(id string, v float64) {
	if err := g.b.SetVolume(id, v); err != nil {
		g.event("warn", "Couldn't change the volume: "+err.Error())
		return
	}
	delete(g.fixedAt, id+"|vol")
	if v < 0.15 {
		g.respect[id+"|vol"] = true // they turned it down themselves: leave it
	}
	g.Tick()
}

func (g *Guardian) UserMute(id string, on bool) {
	if err := g.b.SetMute(id, on); err != nil {
		g.event("warn", "Couldn't change mute: "+err.Error())
		return
	}
	if on {
		g.respect[id+"|mute"] = true
	}
	g.Tick()
}

func (g *Guardian) UserDefault(id string) {
	d := g.snap.dev(id)
	if err := g.b.SetDefault(id); err != nil {
		g.event("warn", "Windows wouldn't switch the device: "+err.Error())
		return
	}
	g.event("info", "Switched to "+d.short()+".")
	g.Tick()
}
