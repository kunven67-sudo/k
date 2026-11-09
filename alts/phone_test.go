//go:build !clip

package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestCleanEmailAndCode(t *testing.T) {
	for in, want := range map[string]string{" Sam.Player@Gmail.com ": "sam.player@gmail.com", "samplayer": "samplayer@gmail.com", "a.b+c@x.co": "a.b+c@x.co"} {
		if got, ok := cleanEmail(in); !ok || got != want {
			t.Errorf("cleanEmail(%q) = %q %v", in, got, ok)
		}
	}
	for _, bad := range []string{"", "@gmail.com", "a@b", "a b@gmail.com", "<x>@gmail.com", strings.Repeat("a", 70) + "@gmail.com"} {
		if _, ok := cleanEmail(bad); ok {
			t.Errorf("cleanEmail(%q) should fail", bad)
		}
	}
	if v, k, ok := cleanCode(" 123 456 "); !ok || v != "123456" || k != "code" {
		t.Errorf("code: %q %q %v", v, k, ok)
	}
	if v, k, ok := cleanCode("https://claude.ai/magic-link#abc"); !ok || k != "link" || !strings.HasPrefix(v, "https://claude.ai/") {
		t.Errorf("link: %q %q %v", v, k, ok)
	}
	for _, bad := range []string{"https://evil.com/claude.ai", "https://claude.ai.evil.com/x", "12", "javascript:alert(1)", "<script>"} {
		if _, _, ok := cleanCode(bad); ok {
			t.Errorf("cleanCode(%q) should fail", bad)
		}
	}
}

func TestFromLANAndLists(t *testing.T) {
	for _, ok := range []string{"192.168.1.5:5000", "10.0.0.7:1", "172.20.1.1:2", "127.0.0.1:3", "[::1]:4", "[fe80::1]:5"} {
		if !fromLAN(ok) {
			t.Errorf("%s should be allowed", ok)
		}
	}
	for _, bad := range []string{"8.8.8.8:1", "1.2.3.4:5", "[2001:4860::8888]:1", "nonsense"} {
		if fromLAN(bad) {
			t.Errorf("%s must be refused", bad)
		}
	}
	l := rememberEmail([]string{"a@x.com", "b@x.com"}, "b@x.com")
	if strings.Join(l, ",") != "b@x.com,a@x.com" {
		t.Errorf("remember %v", l)
	}
	for i := 0; i < 30; i++ {
		l = rememberEmail(l, string(rune('a'+i%26))+itoa(i)+"@x.com")
	}
	if len(l) != maxPhoneMail {
		t.Errorf("max %d", len(l))
	}
	if e := emailsFor("own@x.com", []string{"a@x.com", "own@x.com"}); strings.Join(e, ",") != "own@x.com,a@x.com" {
		t.Errorf("emailsFor %v", e)
	}
}

func TestPhoneHubFlow(t *testing.T) {
	h := newPhoneHub([]byte("PAGE"))
	var got []string
	h.onEmail = func(acc, e string) { got = append(got, "email "+acc+" "+e) }
	h.onCode = func(acc, c string) { got = append(got, "code "+acc+" "+c) }
	h.onLink = func(acc, l string) { got = append(got, "link "+acc+" "+l) }
	s := h.session("aaaa1111", "Main", []string{"sam.player@gmail.com"})
	if again := h.session("aaaa1111", "Main", nil); again.Token != s.Token {
		t.Fatal("same account should keep its QR")
	}
	do := func(method, path, body, from string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.RemoteAddr = from
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	lan := "192.168.1.20:5555"
	if w := do("GET", "/p/"+s.Token, "", "8.8.8.8:1"); w.Code != 403 {
		t.Fatalf("internet must be refused, got %d", w.Code)
	}
	if w := do("GET", "/p/nope", "", lan); w.Code != 410 {
		t.Fatalf("wrong token %d", w.Code)
	}
	if w := do("GET", "/p/"+s.Token, "", lan); w.Code != 200 || w.Body.String() != "PAGE" || !strings.Contains(w.Header().Get("Content-Security-Policy"), "default-src 'none'") {
		t.Fatalf("page %d %q", w.Code, w.Body.String())
	}
	if w := do("POST", "/p/"+s.Token+"/email", `{"v":"not an email"}`, lan); w.Code != 400 {
		t.Fatalf("bad email %d", w.Code)
	}
	if w := do("POST", "/p/"+s.Token+"/email", `{"v":"Sam.Player@gmail.com"}`, lan); w.Code != 204 {
		t.Fatalf("email %d", w.Code)
	}
	h.state("aaaa1111", "code", "Claude sent the code.")
	w := do("GET", "/p/"+s.Token+"/state", "", lan)
	var st phoneSession
	json.Unmarshal(w.Body.Bytes(), &st)
	if st.Step != "code" || st.Email != "sam.player@gmail.com" || st.Name != "Main" || st.Note == "" {
		t.Fatalf("state %+v", st)
	}
	if strings.Contains(w.Body.String(), s.Token) || strings.Contains(w.Body.String(), "aaaa1111") {
		t.Fatal("state must not leak the token or account id")
	}
	if w := do("POST", "/p/"+s.Token+"/code", `{"v":"https://evil.com/x"}`, lan); w.Code != 400 {
		t.Fatalf("evil link %d", w.Code)
	}
	do("POST", "/p/"+s.Token+"/code", `{"v":"482 913"}`, lan)
	do("POST", "/p/"+s.Token+"/code", `{"v":"https://claude.ai/magic-link#t"}`, lan)
	want := "email aaaa1111 sam.player@gmail.com|code aaaa1111 482913|link aaaa1111 https://claude.ai/magic-link#t"
	if strings.Join(got, "|") != want {
		t.Fatalf("calls\n%s\nwant\n%s", strings.Join(got, "|"), want)
	}
	if !h.active("aaaa1111") {
		t.Fatal("should be active")
	}
	h.state("aaaa1111", "done", "Signed in")
	if h.active("aaaa1111") {
		t.Fatal("done = not active")
	}
	// too many tries locks the QR
	s2 := h.session("bbbb2222", "Alt", nil)
	for i := 0; i < phoneMaxTry*2; i++ {
		do("POST", "/p/"+s2.Token+"/code", `{"v":"1"}`, lan)
	}
	if w := do("POST", "/p/"+s2.Token+"/code", `{"v":"123456"}`, lan); w.Code != 429 {
		t.Fatalf("lock %d", w.Code)
	}
	// QR codes run out
	now := time.Now()
	h.now = func() time.Time { return now.Add(phoneLife + time.Minute) }
	if w := do("GET", "/p/"+s2.Token+"/state", "", lan); w.Code != 410 {
		t.Fatalf("expired %d", w.Code)
	}
	if u, err := qrDataURL("http://192.168.1.20:47821/p/" + s.Token); err != nil || !strings.HasPrefix(u, "data:image/png;base64,") {
		t.Fatalf("qr %v", err)
	}
}

// TestPhoneE2E runs the real phone page in a phone-sized browser against the real server, and the real
// ALTS helper (ui/phone.js) on a fake Claude sign-in page. Needs node + Playwright: ALTS_E2E=1 go test -run E2E
func TestPhoneE2E(t *testing.T) {
	if os.Getenv("ALTS_E2E") == "" {
		t.Skip("set ALTS_E2E=1")
	}
	page, _ := os.ReadFile("ui/phone.html")
	h := newPhoneHub(page)
	var mu sync.Mutex
	var calls []string
	h.onEmail = func(acc, e string) {
		mu.Lock()
		calls = append(calls, "email "+e)
		mu.Unlock()
		go func() {
			time.Sleep(300 * time.Millisecond)
			h.state(acc, "code", "Claude sent the code. Type it here.")
		}()
	}
	h.onCode = func(acc, c string) {
		mu.Lock()
		calls = append(calls, "code "+c)
		mu.Unlock()
		go func() { time.Sleep(300 * time.Millisecond); h.state(acc, "done", "Signed in") }()
	}
	s := h.session("aaaa1111", "Main", []string{"sam.player@gmail.com", "alt.one@gmail.com"})
	h.ip = func() string { return "127.0.0.1" } // this box has no Wi-Fi; the phone page talks to the same server either way
	if _, err := h.start(); err != nil {
		t.Skip("no network here: " + err.Error())
	}
	shots := os.Getenv("ALTS_SHOTS")
	qrURL, _ := qrDataURL(h.url(s))
	qrFile := filepath.Join(t.TempDir(), "qr.txt")
	os.WriteFile(qrFile, []byte(qrURL), 0o644)
	cmd := exec.Command("node", filepath.Join("test", "phone_e2e.js"), h.url(s), shots, qrFile)
	var out bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &out
	err := cmd.Run()
	t.Log(out.String())
	if err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	defer mu.Unlock()
	if strings.Join(calls, "|") != "email alt.one@gmail.com|code 482913" {
		t.Fatalf("calls %v", calls)
	}
}
