//go:build !windows

package main

// Linux/Mac = preview build with the pretend PC (for screenshots + click tests).
//   go run . -port 8787 -scenario restart

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"time"
)

func main() {
	port := flag.Int("port", 8787, "port")
	scen := flag.String("scenario", "ok", "ok, fixed, muted, micmissing, restart, frozen, usb, calls, setup, update, popup")
	flag.Parse()
	logEcho = true

	if *scen == "setup" || *scen == "update" {
		srv := &Server{Mode: "setup"}
		srv.SetupSt = func() any {
			if *scen == "update" {
				return map[string]any{"update": true, "running": "0.9.0"}
			}
			return map[string]any{}
		}
		srv.Extra = map[string]func(Req) (any, error){
			"install": func(Req) (any, error) { time.Sleep(time.Second); return nil, errors.New("(preview) this would ask Windows for permission") },
		}
		url, err := srv.Start(*port)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		fmt.Println(url)
		select {}
	}

	f := newFakePC()
	f.Demo = true
	ui := &nopUI{}
	g := NewGuardian(f, ui, "")
	startup := true
	g.startsWithW = func() bool { return startup }
	t0 := time.Now()
	ev := func(ago time.Duration, kind, text string) {
		g.events = append(g.events, Event{T: t0.Add(-ago).UnixMilli(), Kind: kind, Text: text})
	}
	switch *scen {
	case "fixed", "ok":
		if *scen == "fixed" {
			ev(26*time.Hour, "fix", "Calls (Discord, games' voice chat) were going to HDMI TV. Moved them to Speakers / Headphones (Realtek Audio).")
			ev(3*time.Hour, "warn", "Your headphones are plugged in but your mic isn't detected. Pull the plug out and push it all the way back in.")
			ev(3*time.Hour-40*time.Second, "good", "Your mic is back.")
			ev(52*time.Minute, "fix", "Your mic was muted. Unmuted it.")
			ev(14*time.Minute, "fix", "Sound froze (Speakers / Headphones (Realtek Audio) stopped taking sound). Restarting the Windows sound service, 2 second blip.")
			ev(14*time.Minute-6*time.Second, "good", "Fixed! Sound is moving to Speakers / Headphones (Realtek Audio) again.")
		}
	case "muted":
		f.dev(idHP).Muted = true
	case "micmissing":
		f.dev(idMic).State = "unplugged"
		f.S.DefIn, f.S.DefInComm = "", ""
		g.SetSetting("micReminder", true)
	case "restart", "popup":
		f.Frozen, f.HardFrozen = true, true
		ev(2*time.Minute, "fix", "Sound froze (Speakers / Headphones (Realtek Audio) stopped taking sound). Restarting the Windows sound service, 2 second blip.")
		g.svcAt = time.Now()
		g.needRestartNow(time.Now(), "Restarting the sound service didn't unfreeze it.")
	case "frozen":
		f.Frozen = true
	case "usb":
		f.addUSB()
		f.S.DefOut, f.S.DefOutComm, f.S.DefIn, f.S.DefInComm = idUSBo, idUSBo, idUSBi, idUSBi
		ev(10*time.Second, "fix", "Headphones (USB Audio Device) plugged in. Sound and calls now go to them.")
	case "calls":
		f.S.DefOutComm = idTV
	}

	srv := &Server{G: g, Mode: "demo"}
	srv.Extra = map[string]func(Req) (any, error){
		"startup":   func(q Req) (any, error) { startup = q.On; return nil, nil },
		"uninstall": func(Req) (any, error) { return nil, errors.New("(preview) this would remove SOUNDGUARD") },
		"scenario": func(q Req) (any, error) {
			f.Set(func(f *FakePC) {
				switch q.ID {
				case "mute":
					f.dev(idHP).Muted = true
				case "freeze":
					f.Frozen = true
				case "unplugmic":
					f.dev(idMic).State = "unplugged"
					f.S.DefIn, f.S.DefInComm = "", ""
				}
			})
			return nil, nil
		},
	}
	url, err := srv.Start(*port)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println(url)
	if *scen == "popup" {
		fmt.Println(srv.URL("popup"))
	}
	g.Run(make(chan struct{}))
}
