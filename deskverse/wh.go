package main

// Windhawk mod installer. Does the same steps the Windhawk 1.7 app does when you
// press Install on a mod: download the mod's ready-made DLL from mods.windhawk.net,
// save the source, write the default settings and the mod's config in the registry.
// The Windhawk engine watches that registry key, so changes apply live.

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// Reg is the Windhawk "Engine\Mods" registry key (or a fake one in tests).
// key is a path under it, like "windows-11-taskbar-styler" or "...\Settings".
type Reg interface {
	GetString(key, name string) (string, bool)
	GetDWORD(key, name string) (uint32, bool)
	SetString(key, name, v string) error
	SetDWORD(key, name string, v uint32) error
}

type Windhawk struct {
	AppData string // e.g. C:\ProgramData\Windhawk
	Version string // installed Windhawk version, e.g. "1.7.3"
	Reg     Reg
	ModsURL string // https://mods.windhawk.net/mods/
	HTTP    *http.Client
}

type ModMeta struct {
	ID, Version, Name   string
	Include, Exclude    []string
	Architecture        []string
}

var (
	reMetaBlock     = regexp.MustCompile(`(?m)^//[ \t]+==WindhawkMod==[ \t]*$([\s\S]+?)^//[ \t]+==/WindhawkMod==[ \t]*$`)
	reMetaLine      = regexp.MustCompile(`^//[ \t]+@(_?[a-zA-Z]+)(?::([a-z]{2}(?:-[A-Z]{2})?))?[ \t]+(.*)$`)
	reSettingsBlock = regexp.MustCompile(`(?m)^//[ \t]+==WindhawkModSettings==[ \t]*$\s*/\*\s*([\s\S]+?)\s*\*/\s*^//[ \t]+==/WindhawkModSettings==[ \t]*$`)
	reModID         = regexp.MustCompile(`^[0-9a-z-]+$`)
	reYAMLInt       = regexp.MustCompile(`^[-+]?(?:0b[01_]+|0x[0-9a-fA-F_]+|0o[0-7_]+|[0-9][0-9_]*)$`)
	reYAMLFloat     = regexp.MustCompile(`^(?:[-+]?[0-9][0-9_]*(?:\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$`)
)

func normalizeSource(src string) string { return strings.ReplaceAll(src, "\r\n", "\n") }

func ParseMeta(src string) (ModMeta, error) {
	var m ModMeta
	b := reMetaBlock.FindStringSubmatch(normalizeSource(src))
	if b == nil {
		return m, errors.New("no metadata block in the mod source")
	}
	for _, line := range strings.Split(b[1], "\n") {
		line = strings.TrimRight(line, " \t\r")
		if line == "" {
			continue
		}
		x := reMetaLine.FindStringSubmatch(line)
		if x == nil {
			return m, fmt.Errorf("bad metadata line: %.20s", line)
		}
		key, lang, val := strings.TrimPrefix(x[1], "_"), x[2], x[3]
		switch key {
		case "id":
			m.ID = val
		case "version":
			m.Version = val
		case "name":
			if lang == "" {
				m.Name = val
			}
		case "include":
			m.Include = append(m.Include, val)
		case "exclude":
			m.Exclude = append(m.Exclude, val)
		case "architecture":
			m.Architecture = append(m.Architecture, val)
		}
	}
	if !reModID.MatchString(m.ID) {
		return m, fmt.Errorf("bad mod id %q", m.ID)
	}
	if m.Version == "" {
		return m, errors.New("mod has no version")
	}
	return m, nil
}

// InitialSettings flattens the mod's settings block the way Windhawk's
// extractInitialSettingsForEngine does: "a", "list[0]", "group.b", "styles[1].x".
// Values are string or int64 (booleans become 1/0).
func InitialSettings(src string) (map[string]any, error) {
	out := map[string]any{}
	b := reSettingsBlock.FindStringSubmatch(normalizeSource(src))
	if b == nil {
		return out, nil
	}
	var doc yaml.Node
	if err := yaml.Unmarshal([]byte(b[1]), &doc); err != nil {
		return nil, fmt.Errorf("settings yaml: %w", err)
	}
	if len(doc.Content) == 0 || doc.Content[0].Kind != yaml.SequenceNode {
		return nil, errors.New("settings are not a list")
	}
	if err := flattenList(doc.Content[0], "", out); err != nil {
		return nil, err
	}
	return out, nil
}

func flattenList(seq *yaml.Node, prefix string, out map[string]any) error {
	for _, item := range seq.Content {
		if item.Kind != yaml.MappingNode {
			return errors.New("settings item is not a map")
		}
		var key string
		var val *yaml.Node
		n := 0
		for i := 0; i+1 < len(item.Content); i += 2 {
			k := item.Content[i].Value
			if strings.HasPrefix(k, "$") {
				continue
			}
			key, val = k, item.Content[i+1]
			n++
		}
		if n != 1 {
			return fmt.Errorf("settings item has %d keys", n)
		}
		if prefix != "" {
			key = prefix + "." + key
		}
		if err := flattenValue(val, key, out); err != nil {
			return err
		}
	}
	return nil
}

// scalar resolves a plain YAML value the way js-yaml's JSON_SCHEMA does (what Windhawk uses).
func scalar(n *yaml.Node) any {
	if n.Style&(yaml.DoubleQuotedStyle|yaml.SingleQuotedStyle|yaml.LiteralStyle|yaml.FoldedStyle) != 0 {
		return n.Value
	}
	v := n.Value
	switch v {
	case "true", "True", "TRUE":
		return int64(1)
	case "false", "False", "FALSE":
		return int64(0)
	}
	if reYAMLInt.MatchString(v) {
		body := strings.ReplaceAll(strings.TrimLeft(v, "+-"), "_", "")
		var u uint64
		var err error
		if len(body) > 1 && body[0] == '0' && strings.ContainsAny(body[1:2], "bxo") {
			u, err = strconv.ParseUint(body, 0, 64)
		} else {
			u, err = strconv.ParseUint(body, 10, 64)
		}
		if err == nil {
			x := int64(u)
			if v[0] == '-' {
				x = -x
			}
			return x
		}
	}
	if reYAMLFloat.MatchString(v) {
		f, err := strconv.ParseFloat(strings.ReplaceAll(v, "_", ""), 64)
		if err != nil || math.IsNaN(f) || math.IsInf(f, 0) {
			return int64(0) // JS ToUint32 of NaN/Infinity
		}
		return int64(uint32(uint64(int64(math.Mod(math.Trunc(f), 4294967296))))) // like ">>> 0"
	}
	return v
}

func flattenValue(n *yaml.Node, key string, out map[string]any) error {
	if n.Kind == yaml.AliasNode {
		n = n.Alias
	}
	switch n.Kind {
	case yaml.ScalarNode:
		out[key] = scalar(n)
		return nil
	case yaml.SequenceNode:
		if len(n.Content) == 0 {
			return nil
		}
		switch n.Content[0].Kind {
		case yaml.ScalarNode:
			for i, it := range n.Content {
				out[fmt.Sprintf("%s[%d]", key, i)] = scalar(it)
			}
			return nil
		case yaml.SequenceNode:
			for i, it := range n.Content {
				if err := flattenList(it, fmt.Sprintf("%s[%d]", key, i), out); err != nil {
					return err
				}
			}
			return nil
		default:
			return flattenList(n, key, out)
		}
	case yaml.MappingNode:
		return errors.New("settings value is a map")
	}
	return nil
}

// ArchFolders: which Engine\Mods\<folder> DLLs a mod needs on an x64 PC.
func ArchFolders(arch []string) ([]string, error) {
	if len(arch) == 0 {
		arch = []string{"x86", "x86-64"}
	}
	seen := map[string]bool{}
	var out []string
	for _, a := range arch {
		var f string
		switch a {
		case "x86":
			f = "32"
		case "x86-64", "amd64":
			f = "64"
		case "arm64":
			continue
		default:
			return nil, fmt.Errorf("unknown architecture %q", a)
		}
		if !seen[f] {
			seen[f] = true
			out = append(out, f)
		}
	}
	if len(out) == 0 {
		return nil, errors.New("mod doesn't run on this PC")
	}
	return out, nil
}

func versionLess(a, b string) bool { // "1.6" < "1.7.3"
	pa, pb := strings.Split(a, "."), strings.Split(b, ".")
	for i := 0; i < 3; i++ {
		var x, y int
		if i < len(pa) {
			x, _ = strconv.Atoi(strings.TrimLeft(pa[i], "v"))
		}
		if i < len(pb) {
			y, _ = strconv.Atoi(pb[i])
		}
		if x != y {
			return x < y
		}
	}
	return false
}

func (w *Windhawk) get(url string) ([]byte, error) {
	c := w.HTTP
	if c == nil {
		c = &http.Client{Timeout: 90 * time.Second}
	}
	var last error
	for try := 0; try < 3; try++ {
		resp, err := c.Get(url)
		if err == nil {
			b, rerr := io.ReadAll(resp.Body)
			resp.Body.Close()
			if resp.StatusCode == 200 && rerr == nil {
				return b, nil
			}
			if rerr != nil {
				err = rerr
			} else {
				err = fmt.Errorf("%s: %s", url, resp.Status)
			}
			if resp.StatusCode == 404 {
				return nil, err
			}
		}
		last = err
		time.Sleep(time.Duration(try+1) * time.Second)
	}
	return nil, last
}

type ModState struct {
	Installed bool   `json:"installed"`
	Enabled   bool   `json:"enabled"`
	Version   string `json:"version"`
}

func (w *Windhawk) State(id string) ModState {
	lib, ok := w.Reg.GetString(id, "LibraryFileName")
	if !ok || lib == "" {
		return ModState{}
	}
	d, _ := w.Reg.GetDWORD(id, "Disabled")
	v, _ := w.Reg.GetString(id, "Version")
	return ModState{Installed: true, Enabled: d == 0, Version: v}
}

// Install downloads + installs (or updates) a mod and turns it on.
func (w *Windhawk) Install(id string, say func(string)) error {
	if say == nil {
		say = func(string) {}
	}
	say("Downloading " + id)
	srcB, err := w.get(w.ModsURL + id + ".wh.cpp")
	if err != nil {
		return err
	}
	src := string(srcB)
	meta, err := ParseMeta(src)
	if err != nil {
		return err
	}
	if meta.ID != id {
		return fmt.Errorf("mod id mismatch: %s", meta.ID)
	}
	settings, err := InitialSettings(src)
	if err != nil {
		return err
	}
	if vj, err := w.get(w.ModsURL + id + "/versions.json"); err == nil {
		var vers []struct {
			Version            string `json:"version"`
			MinWindhawkVersion string `json:"minWindhawkVersion"`
		}
		if json.Unmarshal(vj, &vers) == nil {
			for _, v := range vers {
				if v.Version == meta.Version && v.MinWindhawkVersion != "" && w.Version != "" && versionLess(w.Version, v.MinWindhawkVersion) {
					return fmt.Errorf("needs Windhawk %s or newer (you have %s)", v.MinWindhawkVersion, w.Version)
				}
			}
		}
	}
	folders, err := ArchFolders(meta.Architecture)
	if err != nil {
		return err
	}
	dll := fmt.Sprintf("%s_%s_%d.dll", id, meta.Version, 100000+rand.Intn(900000))
	data := map[string][]byte{}
	for _, f := range folders {
		b, err := w.get(fmt.Sprintf("%s%s/%s_%s.dll", w.ModsURL, id, meta.Version, f))
		if err != nil {
			return err
		}
		if len(b) < 2 || b[0] != 'M' || b[1] != 'Z' {
			return errors.New("downloaded mod file is not a DLL")
		}
		data[f] = b
	}
	say("Installing " + id)
	for _, f := range folders {
		dir := filepath.Join(w.AppData, "Engine", "Mods", f)
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(dir, dll), data[f], 0o644); err != nil {
			return err
		}
	}
	// Default settings first (keep anything already set, like a picked theme).
	changed := false
	for k, v := range settings {
		sk := id + `\Settings`
		if _, ok := w.Reg.GetString(sk, k); ok {
			continue
		}
		if _, ok := w.Reg.GetDWORD(sk, k); ok {
			continue
		}
		switch x := v.(type) {
		case int64:
			err = w.Reg.SetDWORD(sk, k, uint32(x))
		default:
			err = w.Reg.SetString(sk, k, fmt.Sprint(x))
		}
		if err != nil {
			return err
		}
		changed = true
	}
	if changed {
		w.bumpSettings(id)
	}
	src = normalizeSource(src)
	if err := os.MkdirAll(filepath.Join(w.AppData, "ModsSource"), 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(w.AppData, "ModsSource", id+".wh.cpp"), []byte(src), 0o644); err != nil {
		return err
	}
	for _, s := range []struct{ k, v string }{
		{"Include", strings.Join(meta.Include, "|")},
		{"Exclude", strings.Join(meta.Exclude, "|")},
		{"Architecture", strings.Join(meta.Architecture, "|")},
		{"Version", meta.Version},
	} {
		if err := w.Reg.SetString(id, s.k, s.v); err != nil {
			return err
		}
	}
	if err := w.Reg.SetDWORD(id, "Disabled", 0); err != nil {
		return err
	}
	if err := w.Reg.SetString(id, "LibraryFileName", dll); err != nil { // last: this makes the engine load it
		return err
	}
	w.deleteOld(id, folders, dll)
	w.profileVersion(id, meta.Version)
	return nil
}

func (w *Windhawk) deleteOld(id string, folders []string, keep string) {
	for _, f := range folders {
		dir := filepath.Join(w.AppData, "Engine", "Mods", f)
		ents, _ := os.ReadDir(dir)
		for _, e := range ents {
			n := e.Name()
			if n != keep && strings.HasPrefix(n, id+"_") && strings.HasSuffix(strings.ToLower(n), ".dll") {
				os.Remove(filepath.Join(dir, n)) // may be in use: fine
			}
		}
	}
}

func (w *Windhawk) profileVersion(id, ver string) {
	p := filepath.Join(w.AppData, "userprofile.json")
	b, err := os.ReadFile(p)
	if err != nil {
		return
	}
	var prof map[string]any
	if json.Unmarshal(b, &prof) != nil {
		return
	}
	mods, _ := prof["mods"].(map[string]any)
	if mods == nil {
		mods = map[string]any{}
	}
	m, _ := mods[id].(map[string]any)
	if m == nil {
		m = map[string]any{}
	}
	m["version"] = ver
	delete(m, "latestVersion")
	mods[id] = m
	prof["mods"] = mods
	if nb, err := json.MarshalIndent(prof, "", "\t"); err == nil {
		os.WriteFile(p, nb, 0o644)
	}
}

func (w *Windhawk) bumpSettings(id string) {
	t := uint32(time.Now().Unix()) & 0x7fffffff
	if old, ok := w.Reg.GetDWORD(id, "SettingsChangeTime"); ok && t <= old {
		t = old + 1
	}
	w.Reg.SetDWORD(id, "SettingsChangeTime", t)
}

func (w *Windhawk) SetEnabled(id string, on bool) error {
	if !w.State(id).Installed {
		if !on {
			return nil
		}
		return errors.New("mod not installed")
	}
	v := uint32(1)
	if on {
		v = 0
	}
	return w.Reg.SetDWORD(id, "Disabled", v)
}

func (w *Windhawk) Setting(id, name string) string {
	s, _ := w.Reg.GetString(id+`\Settings`, name)
	return s
}

func (w *Windhawk) SetSetting(id, name, value string) error {
	if err := w.Reg.SetString(id+`\Settings`, name, value); err != nil {
		return err
	}
	w.bumpSettings(id)
	return nil
}
