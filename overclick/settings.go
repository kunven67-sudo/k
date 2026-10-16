package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Speed modes, slowest preset to fastest. "custom" and "max" read Value+Unit.
var presetIntervals = map[string]time.Duration{
	"normal": 100 * time.Millisecond, // 10 clicks/s
	"fast":   40 * time.Millisecond,  // 25 clicks/s
	"turbo":  20 * time.Millisecond,  // 50 clicks/s
	"insane": 10 * time.Millisecond,  // 100 clicks/s
}

var modeNames = map[string]string{
	"custom": "CUSTOM",
	"normal": "NORMAL",
	"fast":   "FAST",
	"turbo":  "TURBO",
	"insane": "INSANE",
	"max":    "MAX POWER",
}

const (
	customMinInterval = 20 * time.Millisecond // Custom can't go faster than Turbo
	maxInterval       = 24 * time.Hour
)

var hotkeys = []string{"F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"}

type Speed struct {
	Mode  string  `json:"mode"`
	Value float64 `json:"value"`
	Unit  string  `json:"unit"` // ms, s, min, cps
}

type ClickerCfg struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	On       bool   `json:"on"`
	Follow   bool   `json:"follow"` // click wherever the mouse is instead of a fixed spot
	X        int    `json:"x"`
	Y        int    `json:"y"`
	Button   string `json:"button"` // left, right, middle
	Double   bool   `json:"double"`
	OwnSpeed bool   `json:"ownSpeed"`
	Speed    Speed  `json:"speed"`
}

type StopRule struct {
	Mode    string  `json:"mode"` // never, clicks, time
	Clicks  int64   `json:"clicks"`
	Seconds float64 `json:"seconds"`
}

type Settings struct {
	Main        Speed           `json:"main"`
	Clickers    []ClickerCfg    `json:"clickers"`
	NextID      int             `json:"nextId"`
	Stop        StopRule        `json:"stop"`
	Hotkey      string          `json:"hotkey"`
	ShowTargets bool            `json:"showTargets"`
	ShowBadge   bool            `json:"showBadge"`
	ReturnMouse bool            `json:"returnMouse"`
	Sounds      bool            `json:"sounds"`
	OnTop       bool            `json:"onTop"`
	Warned      map[string]bool `json:"warned"`
	AllTime     int64           `json:"allTime"`
}

func defaultSettings() Settings {
	return Settings{
		Main: Speed{Mode: "normal", Value: 1, Unit: "ms"},
		Clickers: []ClickerCfg{{
			ID: 1, Name: "Clicker 1", On: true, Follow: true, Button: "left",
			Speed: Speed{Mode: "normal", Value: 1, Unit: "ms"},
		}},
		NextID:      2,
		Stop:        StopRule{Mode: "never", Clicks: 1000, Seconds: 60},
		Hotkey:      "F6",
		ShowTargets: true,
		ShowBadge:   true,
		ReturnMouse: true,
		Sounds:      true,
		Warned:      map[string]bool{},
	}
}

// Interval turns a speed into the wait between clicks. 0 means "no wait at all".
func (s Speed) Interval() time.Duration {
	if d, ok := presetIntervals[s.Mode]; ok {
		return d
	}
	v := s.Value
	if math.IsNaN(v) || math.IsInf(v, 0) || v < 0 {
		v = 0
	}
	var ns float64
	switch s.Unit {
	case "s":
		ns = v * float64(time.Second)
	case "min":
		ns = v * float64(time.Minute)
	case "cps":
		if v <= 0 {
			ns = float64(maxInterval)
		} else {
			ns = float64(time.Second) / v
		}
	default: // ms
		ns = v * float64(time.Millisecond)
	}
	d := maxInterval
	if ns < float64(maxInterval) {
		d = time.Duration(ns)
	}
	if s.Mode == "custom" && d < customMinInterval {
		d = customMinInterval
	}
	return d
}

func (s Speed) Name() string { return modeNames[s.Mode] }

// rank orders modes by how wild they are, for picking the HUD color.
func (s Speed) rank() int {
	switch s.Mode {
	case "max":
		return 5
	case "insane":
		return 4
	case "turbo":
		return 3
	case "fast":
		return 2
	case "normal":
		return 1
	}
	return 0
}

func (c ClickerCfg) EffectiveSpeed(main Speed) Speed {
	if c.OwnSpeed {
		return c.Speed
	}
	return main
}

func normSpeed(s *Speed) {
	if _, ok := modeNames[s.Mode]; !ok {
		s.Mode = "normal"
	}
	switch s.Unit {
	case "ms", "s", "min", "cps":
	default:
		s.Unit = "ms"
	}
	if math.IsNaN(s.Value) || math.IsInf(s.Value, 0) || s.Value < 0 {
		s.Value = 0
	}
	if s.Value > 1e9 {
		s.Value = 1e9
	}
}

// Normalize fixes anything broken or out of range, so a bad settings file or a
// bad value from the UI can never crash the engine.
func (st *Settings) Normalize() {
	normSpeed(&st.Main)
	if st.Warned == nil {
		st.Warned = map[string]bool{}
	}
	valid := false
	for _, h := range hotkeys {
		if st.Hotkey == h {
			valid = true
		}
	}
	if !valid {
		st.Hotkey = "F6"
	}
	switch st.Stop.Mode {
	case "never", "clicks", "time":
	default:
		st.Stop.Mode = "never"
	}
	if st.Stop.Clicks < 1 {
		st.Stop.Clicks = 1
	}
	if math.IsNaN(st.Stop.Seconds) || st.Stop.Seconds < 0.1 {
		st.Stop.Seconds = 0.1
	}
	if st.Stop.Seconds > 7*24*3600 {
		st.Stop.Seconds = 7 * 24 * 3600
	}
	if len(st.Clickers) > maxClickers {
		st.Clickers = st.Clickers[:maxClickers]
	}
	seen := map[int]bool{}
	maxID := 0
	for i := range st.Clickers {
		c := &st.Clickers[i]
		if c.ID <= 0 || seen[c.ID] {
			c.ID = 0 // fixed below
		} else {
			seen[c.ID] = true
			if c.ID > maxID {
				maxID = c.ID
			}
		}
	}
	for i := range st.Clickers {
		c := &st.Clickers[i]
		if c.ID == 0 {
			maxID++
			c.ID = maxID
		}
		c.Name = strings.TrimSpace(c.Name)
		if r := []rune(c.Name); len(r) > 24 {
			c.Name = string(r[:24])
		}
		if c.Name == "" {
			c.Name = fmt.Sprintf("Clicker %d", c.ID)
		}
		switch c.Button {
		case "left", "right", "middle":
		default:
			c.Button = "left"
		}
		normSpeed(&c.Speed)
	}
	if len(st.Clickers) == 0 {
		st.Clickers = defaultSettings().Clickers
		maxID = 1
	}
	if st.NextID <= maxID {
		st.NextID = maxID + 1
	}
	if st.AllTime < 0 {
		st.AllTime = 0
	}
}

const maxClickers = 20

func settingsPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	return filepath.Join(dir, "OVERCLICK", "settings.json")
}

func loadSettings(path string) Settings {
	st := defaultSettings()
	if b, err := os.ReadFile(path); err == nil {
		var loaded Settings
		if json.Unmarshal(b, &loaded) == nil && len(loaded.Clickers) > 0 {
			st = loaded
		}
	}
	st.Normalize()
	return st
}

// saveSettings writes to a temp file first so a crash mid-write can't wipe the save.
func saveSettings(path string, st Settings) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
