//go:build !windows

package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"unicode/utf16"
)

// DV_MODS_DIR = a windhawk-mods/mods checkout, DV_JSREF = node script with Windhawk's own parser.
func TestSettingsMatchWindhawk(t *testing.T) {
	dir, ref := os.Getenv("DV_MODS_DIR"), os.Getenv("DV_JSREF")
	if dir == "" || ref == "" {
		t.Skip("set DV_MODS_DIR and DV_JSREF")
	}
	all, _ := filepath.Glob(filepath.Join(dir, "*.wh.cpp"))
	checked := 0
	for _, f := range all {
		out, err := exec.Command("node", ref, f).Output()
		if err != nil {
			continue // Windhawk itself can't parse it either
		}
		var want map[string]any
		json.Unmarshal(out, &want)
		src, _ := os.ReadFile(f)
		got, err := InitialSettings(string(src))
		if err != nil {
			t.Errorf("%s: %v", filepath.Base(f), err)
			continue
		}
		if len(got) != len(want) {
			t.Errorf("%s: %d keys, Windhawk has %d", filepath.Base(f), len(got), len(want))
			continue
		}
		for k, w := range want {
			g, ok := got[k]
			if !ok {
				t.Errorf("%s: missing %s", filepath.Base(f), k)
				continue
			}
			switch wv := w.(type) {
			case float64:
				gi, isI := g.(int64)
				if !isI || uint32(gi) != uint32(wv) {
					t.Errorf("%s: %s = %v, Windhawk %v", filepath.Base(f), k, g, wv)
				}
			case string:
				if g != wv {
					t.Errorf("%s: %s = %q, Windhawk %q", filepath.Base(f), k, g, wv)
				}
			}
		}
		checked++
	}
	t.Logf("settings match Windhawk for %d of %d mods", checked, len(all))
	if checked < 50 {
		t.Fatalf("only %d mods checked", checked)
	}
}

const fakeMod = `// ==WindhawkMod==
// @id              test-mod
// @name            Test mod
// @name:fr         Mod de test
// @version         1.2.3
// @include         explorer.exe
// @include         notepad.exe
// @architecture    x86-64
// ==/WindhawkMod==

// ==WindhawkModSettings==
/*
- theme: ""
  $options:
  - "": None
  - Bubbles: Bubbles
- speed: 250
- on: true
- list:
  - - target: a
    - styles: [x, y]
*/
// ==/WindhawkModSettings==
int x;
`

func modServer(t *testing.T) (*httptest.Server, *int) {
	hits := 0
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		switch r.URL.Path {
		case "/mods/test-mod.wh.cpp":
			fmt.Fprint(w, strings.ReplaceAll(fakeMod, "\n", "\r\n"))
		case "/mods/test-mod/versions.json":
			fmt.Fprint(w, `[{"version":"1.2.3","minWindhawkVersion":"1.5"}]`)
		case "/mods/test-mod/1.2.3_64.dll":
			w.Write([]byte("MZfake-dll"))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(s.Close)
	return s, &hits
}

func TestInstallLikeWindhawk(t *testing.T) {
	s, _ := modServer(t)
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "userprofile.json"), []byte(`{"id":"x","mods":{"test-mod":{"version":"1.0","latestVersion":"1.2.3"}}}`), 0o644)
	reg := &memReg{}
	comp := t.TempDir()
	for _, tg := range []string{"i686-w64-mingw32", "x86_64-w64-mingw32"} {
		os.MkdirAll(filepath.Join(comp, tg, "bin"), 0o755)
		for _, f := range []string{"libc++.dll", "libunwind.dll", "windhawk-mod-shim.dll"} {
			os.WriteFile(filepath.Join(comp, tg, "bin", f), []byte(tg+f), 0o644)
		}
	}
	w := &Windhawk{AppData: dir, Compiler: comp, Version: "1.7.3", Reg: reg, ModsURL: s.URL + "/mods/"}
	if err := w.Install("test-mod", nil); err != nil {
		t.Fatal(err)
	}
	for _, c := range [][3]string{{"64", "libc++.whl", "x86_64-w64-mingw32libc++.dll"}, {"32", "libunwind.whl", "i686-w64-mingw32libunwind.dll"}, {"64", "windhawk-mod-shim.dll", "x86_64-w64-mingw32windhawk-mod-shim.dll"}} {
		if b, _ := os.ReadFile(filepath.Join(dir, "Engine", "Mods", c[0], c[1])); string(b) != c[2] {
			t.Errorf("lib %s/%s = %q", c[0], c[1], b)
		}
	}
	lib, _ := reg.GetString("test-mod", "LibraryFileName")
	if !strings.HasPrefix(lib, "test-mod_1.2.3_") || !strings.HasSuffix(lib, ".dll") {
		t.Fatalf("lib %q", lib)
	}
	if b, _ := os.ReadFile(filepath.Join(dir, "Engine", "Mods", "64", lib)); string(b) != "MZfake-dll" {
		t.Fatal("dll not written")
	}
	if m, _ := filepath.Glob(filepath.Join(dir, "Engine", "Mods", "32", "test-mod_*")); len(m) != 0 {
		t.Fatal("32-bit dll made for an x86-64 mod")
	}
	if src, _ := os.ReadFile(filepath.Join(dir, "ModsSource", "test-mod.wh.cpp")); strings.Contains(string(src), "\r") || !strings.Contains(string(src), "@id") {
		t.Fatal("source not saved right")
	}
	for k, want := range map[string]string{"Include": "explorer.exe|notepad.exe", "Exclude": "", "Architecture": "x86-64", "Version": "1.2.3"} {
		if v, _ := reg.GetString("test-mod", k); v != want {
			t.Errorf("%s = %q want %q", k, v, want)
		}
	}
	if d, ok := reg.GetDWORD("test-mod", "Disabled"); !ok || d != 0 {
		t.Error("not enabled")
	}
	if v, _ := reg.GetDWORD(`test-mod\Settings`, "speed"); v != 250 {
		t.Error("speed", v)
	}
	if v, _ := reg.GetDWORD(`test-mod\Settings`, "on"); v != 1 {
		t.Error("bool setting", v)
	}
	if v, _ := reg.GetString(`test-mod\Settings`, "list[0].styles[1]"); v != "y" {
		t.Error("nested", v)
	}
	sct, ok := reg.GetDWORD("test-mod", "SettingsChangeTime")
	if !ok || sct == 0 {
		t.Error("no SettingsChangeTime")
	}
	var prof map[string]map[string]map[string]any
	b, _ := os.ReadFile(filepath.Join(dir, "userprofile.json"))
	json.Unmarshal(b, &prof)
	if prof["mods"]["test-mod"]["version"] != "1.2.3" || prof["mods"]["test-mod"]["latestVersion"] != nil {
		t.Error("userprofile", string(b))
	}

	// pick a theme, then reinstall: theme stays, old dll removed, time goes up
	if err := w.SetSetting("test-mod", "theme", "Bubbles"); err != nil {
		t.Fatal(err)
	}
	sct2, _ := reg.GetDWORD("test-mod", "SettingsChangeTime")
	if sct2 <= sct {
		t.Error("SettingsChangeTime didn't go up")
	}
	if err := w.Install("test-mod", nil); err != nil {
		t.Fatal(err)
	}
	if w.Setting("test-mod", "theme") != "Bubbles" {
		t.Error("reinstall wiped the theme")
	}
	ents, _ := filepath.Glob(filepath.Join(dir, "Engine", "Mods", "64", "test-mod_*.dll"))
	if len(ents) != 1 {
		t.Errorf("%d dlls left, want 1", len(ents))
	}
	if err := w.SetEnabled("test-mod", false); err != nil || w.State("test-mod").Enabled {
		t.Error("disable failed")
	}
	if st := w.State("test-mod"); !st.Installed || st.Version != "1.2.3" {
		t.Error("state", st)
	}

	// too-old Windhawk is refused
	w.Version = "1.4"
	if err := w.Install("test-mod", nil); err == nil || !strings.Contains(err.Error(), "needs Windhawk 1.5") {
		t.Error("old windhawk not refused:", err)
	}
}

func TestMeta(t *testing.T) {
	m, err := ParseMeta(fakeMod)
	if err != nil || m.ID != "test-mod" || m.Name != "Test mod" || len(m.Include) != 2 {
		t.Fatal(m, err)
	}
	if f, _ := ArchFolders(nil); strings.Join(f, ",") != "32,64" {
		t.Error(f)
	}
	if f, _ := ArchFolders([]string{"x86-64"}); strings.Join(f, ",") != "64" {
		t.Error(f)
	}
	if !versionLess("1.4", "1.5") || versionLess("1.7.3", "1.7") || !versionLess("1.7.3", "2.0") {
		t.Error("versionLess")
	}
}

func TestAPIGuards(t *testing.T) {
	a := NewApp(&fakePlatform{reg: &memReg{}, dir: t.TempDir()})
	url, err := a.Serve()
	if err != nil {
		t.Fatal(err)
	}
	base := strings.SplitN(url, "/#", 2)[0]
	r, _ := http.Post(base+"/api/status", "application/json", strings.NewReader("{}"))
	if r.StatusCode != 403 {
		t.Error("no token allowed:", r.StatusCode)
	}
	q, _ := http.NewRequest("POST", base+"/api/status", strings.NewReader("{}"))
	q.Header.Set("X-DV", a.token)
	r, _ = http.DefaultClient.Do(q)
	if r.StatusCode != 200 {
		t.Error("token refused:", r.StatusCode)
	}
	q, _ = http.NewRequest("POST", base+"/api/status", strings.NewReader("{}"))
	q.Header.Set("X-DV", a.token)
	q.Host = "evil.example:80"
	r, _ = http.DefaultClient.Do(q)
	if r.StatusCode != 403 {
		t.Error("wrong host allowed:", r.StatusCode)
	}
	if _, err := a.do("mod", req{ID: "not-in-catalog", On: true}); err == nil {
		t.Error("unknown mod allowed")
	}
}

func TestIniUTF16(t *testing.T) {
	text := "[Storage]\r\nPortable=0\r\nAppDataPath=%ProgramData%\\Windhawk\r\nRegistryKey=HKEY_LOCAL_MACHINE\\SOFTWARE\\Windhawk\r\n"
	u := utf16.Encode([]rune(text))
	b := []byte{0xFF, 0xFE}
	for _, c := range u {
		b = append(b, byte(c), byte(c>>8))
	}
	p := filepath.Join(t.TempDir(), "windhawk.ini")
	os.WriteFile(p, b, 0o644)
	got := readIni(p)["storage"]
	if got["registrykey"] != `HKEY_LOCAL_MACHINE\SOFTWARE\Windhawk` || got["appdatapath"] != `%ProgramData%\Windhawk` || got["portable"] != "0" {
		t.Fatalf("%q", got)
	}
	os.WriteFile(p, []byte(text), 0o644)
	if readIni(p)["storage"]["registrykey"] != `HKEY_LOCAL_MACHINE\SOFTWARE\Windhawk` {
		t.Fatal("utf8 ini")
	}
}
