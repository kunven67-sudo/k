//go:build windows && !clip

package main

// Phone sign-in, the Windows side: the QR card on Claude's sign-in page and typing what the phone sends.

import (
	_ "embed"
	"encoding/json"
	"os"
	"strings"
	"sync"
	"time"
)

//go:embed ui/phone.js
var phoneJS string

//go:embed ui/phone.html
var phoneHTML []byte

var (
	hubOnce sync.Once
	hub     *phoneHub
)

func phoneCall(fn string, v any) string {
	b, _ := json.Marshal(v)
	return "window.__altsPhone&&__altsPhone." + fn + "(" + string(b) + ")"
}

// phones starts the hub the first time it's needed and wires it to the app (callbacks come from the
// web server's goroutines, so they hop onto the app's thread with a.post).
func (a *App) phones() *phoneHub {
	hubOnce.Do(func() {
		hub = newPhoneHub(phoneHTML)
		hub.onEmail = func(acc, e string) {
			a.post(func() {
				i := a.st.find(acc)
				if i < 0 {
					return
				}
				a.st.Accounts[i].Email = e
				a.st.Emails = rememberEmail(a.st.Emails, e)
				a.save()
				a.open(acc) // bring that account up on the PC so you see it happen
				a.evalIn(acc, phoneCall("email", e))
			})
		}
		hub.onCode = func(acc, c string) {
			a.post(func() { a.evalIn(acc, phoneCall("code", c)) })
		}
		hub.onLink = func(acc, link string) {
			a.post(func() {
				if v := a.views[acc]; v != nil {
					a.open(acc)
					v.c.Navigate(link)
				}
			})
		}
		go func() { // the server closes itself when no QR code is left
			for range time.Tick(time.Minute) {
				hub.idleStop()
			}
		}()
	})
	return hub
}

func (a *App) phonePage(id string, m pageMsg) {
	i := a.st.find(id)
	if i < 0 {
		return
	}
	acc := a.st.Accounts[i]
	h := a.phones()
	switch m.T {
	case "phone-login":
		s := h.session(id, acc.Name, emailsFor(acc.Email, a.st.Emails))
		addr, err := h.start()
		if err != nil {
			a.evalIn(id, phoneCall("qr", map[string]string{"error": "Phone sign-in needs Wi-Fi: " + err.Error()}))
			return
		}
		_ = addr
		png, err := qrDataURL(h.url(s))
		if err != nil {
			a.evalIn(id, phoneCall("qr", map[string]string{"error": err.Error()}))
			return
		}
		a.evalIn(id, phoneCall("qr", map[string]string{"png": png, "url": h.url(s)}))
	case "phone-state":
		h.state(id, m.Kind, m.Text)
	case "phone-left":
		if h.active(id) {
			h.state(id, "done", "Signed in")
			a.toast("Signed in on " + acc.Name + " with your phone.")
		}
	}
}

// googleCrashFix: Google's sign-in window crashed ALTS's page (STATUS_BREAKPOINT, a check inside
// WebView2 157 itself, crash reports 11-08) right as Google's page set up its passkey / digital
// credential sign-in. ALTS turns those browser features off so the normal password + "tap Yes on your
// phone" Google sign-in is used. Unknown feature names are ignored by WebView2, so this can't break it.
func googleCrashFix() {
	const flags = "--disable-features=WebAuthenticationConditionalUI,WebAuthConditionalUI,WebIdentityDigitalCredentials,DigitalCredentials,WebAuthenticationPasskeyUpgrade " +
		"--disable-blink-features=WebIdentityDigitalCredentials,DigitalCredentials"
	old := os.Getenv("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS")
	if strings.Contains(old, "WebIdentityDigitalCredentials") {
		return
	}
	os.Setenv("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", strings.TrimSpace(old+" "+flags))
}
