//go:build !clip

package main

// Phone sign-in. On Claude's sign-in page ALTS shows a QR code. The phone (same Wi-Fi) opens a small
// page that ALTS itself serves: tap or type your Gmail, then type the code Claude emails you. ALTS types
// both into Claude's own sign-in page in that account. Only the email address and the one-time code pass
// through here, never a password. No Windows calls in this file, so it's tested anywhere.

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"rsc.io/qr"
)

const (
	phonePort    = 47821            // fixed, so Windows asks to allow ALTS only once
	phoneLife    = 20 * time.Minute // a QR code works this long
	phoneMaxTry  = 12               // codes per QR before it's locked
	maxPhoneMail = 20
)

type phoneSession struct {
	Token   string    `json:"-"`
	Account string    `json:"-"`
	Name    string    `json:"name"`
	Step    string    `json:"step"` // email, code, done
	Note    string    `json:"note"`
	Email   string    `json:"email"`
	Emails  []string  `json:"emails"`
	Made    time.Time `json:"-"`
	Tries   int       `json:"-"`
}

// phoneHub keeps the open QR sessions and the little web server. The callbacks run on the server's
// goroutines: the app moves them onto its own thread.
type phoneHub struct {
	mu       sync.Mutex
	sessions map[string]*phoneSession // by token
	byAcc    map[string]string        // account id -> token
	srv      *http.Server
	addr     string
	page     []byte
	onEmail  func(acc, email string)
	onCode   func(acc, code string)
	onLink   func(acc, link string)
	now      func() time.Time
	ip       func() string // lanIP (tests use their own)
}

func newPhoneHub(page []byte) *phoneHub {
	return &phoneHub{sessions: map[string]*phoneSession{}, byAcc: map[string]string{}, page: page, now: time.Now, ip: lanIP}
}

func newToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// session returns the QR session of an account, making a new one when there's none or it ran out.
func (h *phoneHub) session(acc, name string, emails []string) *phoneSession {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.sweep()
	if t, ok := h.byAcc[acc]; ok {
		if s := h.sessions[t]; s != nil && s.Step != "done" {
			s.Name, s.Emails = name, emails
			return s
		}
	}
	s := &phoneSession{Token: newToken(), Account: acc, Name: name, Step: "email", Emails: emails, Made: h.now()}
	h.sessions[s.Token] = s
	h.byAcc[acc] = s.Token
	return s
}

// sweep drops sessions older than phoneLife (h.mu held).
func (h *phoneHub) sweep() {
	for t, s := range h.sessions {
		if h.now().Sub(s.Made) > phoneLife {
			delete(h.sessions, t)
			if h.byAcc[s.Account] == t {
				delete(h.byAcc, s.Account)
			}
		}
	}
}

// state is what the Claude page in ALTS reports back (typed the email, code box showed up, signed in...).
func (h *phoneHub) state(acc, step, note string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	s := h.sessions[h.byAcc[acc]]
	if s == nil {
		return
	}
	if step != "" {
		s.Step = step
	}
	s.Note = note
}

// signedIn is true when an account had a QR session going (so the page can say "signed in").
func (h *phoneHub) active(acc string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	s := h.sessions[h.byAcc[acc]]
	return s != nil && s.Step != "done"
}

var emailRe = regexp.MustCompile(`^[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9.\-]{1,190}\.[A-Za-z]{2,24}$`)

func cleanEmail(s string) (string, bool) {
	s = strings.ToLower(strings.TrimSpace(s))
	if !strings.Contains(s, "@") && s != "" && emailRe.MatchString(s+"@gmail.com") {
		s += "@gmail.com" // typed just the name part of a Gmail
	}
	return s, emailRe.MatchString(s)
}

var codeRe = regexp.MustCompile(`^[A-Za-z0-9\-]{4,16}$`)

// cleanCode takes what was typed in the code box: a login code, or a Claude login link pasted from the
// email. kind is "code" or "link".
func cleanCode(s string) (val, kind string, ok bool) {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(strings.ToLower(s), "https://") {
		u, err := url.Parse(s)
		if err != nil || len(s) > 4000 {
			return "", "", false
		}
		host := strings.ToLower(u.Hostname())
		if host == "claude.ai" || strings.HasSuffix(host, ".claude.ai") {
			return u.String(), "link", true
		}
		return "", "", false
	}
	s = strings.ReplaceAll(s, " ", "")
	return s, "code", codeRe.MatchString(s)
}

// fromLAN: only phones on your own network (or this PC) may use the page.
func fromLAN(remote string) bool {
	host, _, err := net.SplitHostPort(remote)
	if err != nil {
		host = remote
	}
	ip := net.ParseIP(host)
	return ip != nil && (ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast())
}

// lanIP is this PC's address on the Wi-Fi/network (what the phone has to reach).
func lanIP() string {
	if c, err := net.Dial("udp4", "8.8.8.8:80"); err == nil { // UDP: nothing is sent, it only picks the route
		ip := c.LocalAddr().(*net.UDPAddr).IP
		c.Close()
		if ip.IsPrivate() {
			return ip.String()
		}
	}
	best := ""
	addrs, _ := net.InterfaceAddrs()
	for _, a := range addrs {
		if n, ok := a.(*net.IPNet); ok {
			if ip := n.IP.To4(); ip != nil && ip.IsPrivate() {
				if strings.HasPrefix(ip.String(), "192.168.") {
					return ip.String()
				}
				if best == "" {
					best = ip.String()
				}
			}
		}
	}
	return best
}

// start runs the web server once. The address is what goes in the QR code.
func (h *phoneHub) start() (string, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.srv != nil {
		return h.addr, nil
	}
	ip := h.ip()
	if ip == "" {
		return "", errors.New("this PC isn't on a Wi-Fi or home network")
	}
	ln, err := net.Listen("tcp4", ":"+itoa(phonePort))
	if err != nil {
		ln, err = net.Listen("tcp4", ":0")
		if err != nil {
			return "", err
		}
	}
	h.addr = ip + ":" + itoa(ln.Addr().(*net.TCPAddr).Port)
	h.srv = &http.Server{Handler: h, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, MaxHeaderBytes: 16 << 10}
	go h.srv.Serve(ln)
	return h.addr, nil
}

func (h *phoneHub) url(s *phoneSession) string { return "http://" + h.addr + "/p/" + s.Token }

// qrDataURL is the QR code as a picture for the page.
func qrDataURL(text string) (string, error) {
	c, err := qr.Encode(text, qr.M)
	if err != nil {
		return "", err
	}
	c.Scale = 6
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(c.PNG()), nil
}

func (h *phoneHub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	if !fromLAN(r.RemoteAddr) {
		http.Error(w, "Only phones on your own Wi-Fi.", http.StatusForbidden)
		return
	}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 2 || parts[0] != "p" {
		http.NotFound(w, r)
		return
	}
	h.mu.Lock()
	h.sweep()
	s := h.sessions[parts[1]]
	h.mu.Unlock()
	if s == nil {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusGone)
		w.Write([]byte(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="background:#141417;color:#ececf1;font:18px system-ui;padding:24px">This QR code ran out. Scan the new one on your PC.`))
		return
	}
	what := ""
	if len(parts) > 2 {
		what = parts[2]
	}
	switch {
	case what == "" && r.Method == http.MethodGet:
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'")
		w.Write(h.page)
	case what == "state" && r.Method == http.MethodGet:
		h.mu.Lock()
		b, _ := json.Marshal(s)
		h.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.Write(b)
	case (what == "email" || what == "code") && r.Method == http.MethodPost:
		var in struct {
			V string `json:"v"`
		}
		if json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&in) != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		h.mu.Lock()
		s.Tries++
		tooMany := s.Tries > phoneMaxTry*2
		h.mu.Unlock()
		if tooMany {
			http.Error(w, "Too many tries. Scan the QR code again.", http.StatusTooManyRequests)
			return
		}
		if what == "email" {
			e, ok := cleanEmail(in.V)
			if !ok {
				http.Error(w, "That doesn't look like an email address.", http.StatusBadRequest)
				return
			}
			h.mu.Lock()
			s.Email, s.Step, s.Note = e, "code", "ALTS is typing your Gmail on the PC..."
			h.mu.Unlock()
			if h.onEmail != nil {
				h.onEmail(s.Account, e)
			}
		} else {
			v, kind, ok := cleanCode(in.V)
			if !ok {
				http.Error(w, "Type the code from the email (or paste the Claude link from it).", http.StatusBadRequest)
				return
			}
			h.mu.Lock()
			s.Step, s.Note = "wait", "ALTS is signing you in on the PC..."
			h.mu.Unlock()
			if kind == "link" && h.onLink != nil {
				h.onLink(s.Account, v)
			} else if h.onCode != nil {
				h.onCode(s.Account, v)
			}
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		http.NotFound(w, r)
	}
}

// rememberEmail puts an address first in the list (newest first, no doubles, at most maxPhoneMail).
func rememberEmail(list []string, e string) []string {
	out := []string{e}
	for _, x := range list {
		if x != e && len(out) < maxPhoneMail {
			out = append(out, x)
		}
	}
	return out
}

// emailsFor lists the account's own Gmail first, then every other one ALTS knows.
func emailsFor(own string, all []string) []string {
	var out []string
	if own != "" {
		out = append(out, own)
	}
	for _, e := range all {
		if e != own {
			out = append(out, e)
		}
	}
	return out
}

// idleStop closes the web server once no QR code is left, so nothing keeps listening for no reason.
func (h *phoneHub) idleStop() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.sweep()
	if h.srv != nil && len(h.sessions) == 0 {
		h.srv.Close()
		h.srv = nil
	}
}
