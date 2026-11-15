package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

const (
	whSetupURL    = "https://github.com/ramensoftware/windhawk/releases/download/v1.7.3/windhawk_setup.exe"
	whSetupSHA256 = "5116cc1703384aac88b8d7a3b57f172aea5da32b6df7355fb2f8247d23813c8f"
	livelyStoreID = "9NTM2QC6QWS7"
)

var (
	user32          = windows.NewLazySystemDLL("user32.dll")
	procSPI         = user32.NewProc("SystemParametersInfoW")
	procSendMsgTO   = user32.NewProc("SendMessageTimeoutW")
	procFindWindow  = user32.NewProc("FindWindowW")
	procSetFg       = user32.NewProc("SetForegroundWindow")
	procShowWindow  = user32.NewProc("ShowWindow")
	procMessageBox  = user32.NewProc("MessageBoxW")
)

// ---------- registry (Windhawk Engine\Mods key) ----------

type winReg struct {
	root registry.Key
	base string // e.g. SOFTWARE\Windhawk\Engine\Mods
}

func (r winReg) open(key string, acc uint32) (registry.Key, error) {
	return registry.OpenKey(r.root, r.base+`\`+key, acc|registry.WOW64_64KEY)
}
func (r winReg) create(key string) (registry.Key, error) {
	k, _, err := registry.CreateKey(r.root, r.base+`\`+key, registry.SET_VALUE|registry.QUERY_VALUE|registry.WOW64_64KEY)
	return k, err
}
func (r winReg) GetString(key, name string) (string, bool) {
	k, err := r.open(key, registry.QUERY_VALUE)
	if err != nil {
		return "", false
	}
	defer k.Close()
	v, t, err := k.GetStringValue(name)
	return v, err == nil && t == registry.SZ || err == nil && t == registry.EXPAND_SZ
}
func (r winReg) GetDWORD(key, name string) (uint32, bool) {
	k, err := r.open(key, registry.QUERY_VALUE)
	if err != nil {
		return 0, false
	}
	defer k.Close()
	v, t, err := k.GetIntegerValue(name)
	return uint32(v), err == nil && t == registry.DWORD
}
func (r winReg) SetString(key, name, v string) error {
	k, err := r.create(key)
	if err != nil {
		return err
	}
	defer k.Close()
	return k.SetStringValue(name, v)
}
func (r winReg) SetDWORD(key, name string, v uint32) error {
	k, err := r.create(key)
	if err != nil {
		return err
	}
	defer k.Close()
	return k.SetDWordValue(name, v)
}

// ---------- finding Windhawk ----------

type winPlatform struct{ base string } // %LOCALAPPDATA%\DeskVerse

func whUninstallKey() (string, string) { // install dir, version
	for _, view := range []uint32{registry.WOW64_64KEY, registry.WOW64_32KEY} {
		k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Windhawk`, registry.QUERY_VALUE|view)
		if err != nil {
			continue
		}
		dir, _, _ := k.GetStringValue("InstallLocation")
		ver, _, _ := k.GetStringValue("DisplayVersion")
		if dir == "" {
			if u, _, err := k.GetStringValue("UninstallString"); err == nil {
				dir = filepath.Dir(strings.Trim(u, `" `))
			}
		}
		k.Close()
		return strings.Trim(dir, `"`), ver
	}
	return "", ""
}

func whRoot() (string, string) {
	dir, ver := whUninstallKey()
	cands := []string{dir, filepath.Join(os.Getenv("ProgramFiles"), "Windhawk"), filepath.Join(os.Getenv("ProgramFiles(x86)"), "Windhawk")}
	for _, c := range cands {
		if c != "" {
			if _, err := os.Stat(filepath.Join(c, "windhawk.ini")); err == nil {
				return c, ver
			}
		}
	}
	return "", ver
}

func expandIniPath(root, p string) string {
	p, _ = registry.ExpandString(p)
	if !filepath.IsAbs(p) {
		p = filepath.Join(root, p)
	}
	return filepath.Clean(p)
}

func (p *winPlatform) Windhawk() (*Windhawk, WHStatus) {
	root, ver := whRoot()
	if root == "" {
		return nil, WHStatus{}
	}
	st := WHStatus{Installed: true, Version: ver}
	if ver != "" && !versionLess(ver, "2.0") {
		st.Why = "You have Windhawk " + ver + ". This DeskVerse only knows Windhawk 1.x, it needs an update for 2.x."
		return nil, st
	}
	ini := readIni(filepath.Join(root, "windhawk.ini"))["storage"]
	if ini["portable"] == "1" {
		st.Why = "Your Windhawk is the portable kind. DeskVerse needs the normal install (press Get Windhawk)."
		return nil, st
	}
	appData := expandIniPath(root, ini["appdatapath"])
	rk := ini["registrykey"]
	var rootKey registry.Key
	switch {
	case strings.HasPrefix(rk, `HKEY_LOCAL_MACHINE\`), strings.HasPrefix(rk, `HKLM\`):
		rootKey = registry.LOCAL_MACHINE
	case strings.HasPrefix(rk, `HKEY_CURRENT_USER\`), strings.HasPrefix(rk, `HKCU\`):
		rootKey = registry.CURRENT_USER
	default:
		st.Why = "Couldn't read Windhawk's settings (windhawk.ini RegistryKey=" + rk + "). Reinstall Windhawk, then try again."
		return nil, st
	}
	sub := rk[strings.IndexByte(rk, '\\')+1:]
	st.OK = true
	return &Windhawk{AppData: appData, Compiler: expandIniPath(root, ini["compilerpath"]), Version: ver, Reg: winReg{root: rootKey, base: sub + `\Engine\Mods`}, ModsURL: "https://mods.windhawk.net/mods/"}, st
}

func procRunning(name string) bool {
	snap, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return false
	}
	defer windows.CloseHandle(snap)
	var e windows.ProcessEntry32
	e.Size = uint32(unsafe.Sizeof(e))
	for err = windows.Process32First(snap, &e); err == nil; err = windows.Process32Next(snap, &e) {
		if strings.EqualFold(windows.UTF16ToString(e.ExeFile[:]), name) {
			return true
		}
	}
	return false
}

func hidden(c *exec.Cmd) *exec.Cmd {
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000} // CREATE_NO_WINDOW
	return c
}

func (p *winPlatform) InstallWindhawk(say func(string)) error {
	say("Downloading Windhawk")
	dir := filepath.Join(p.base, "download")
	os.MkdirAll(dir, 0o755)
	exe := filepath.Join(dir, "windhawk_setup.exe")
	resp, err := (&http.Client{Timeout: 5 * time.Minute}).Get(whSetupURL)
	if err != nil {
		return fmt.Errorf("couldn't download Windhawk: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("couldn't download Windhawk: %s", resp.Status)
	}
	f, err := os.Create(exe)
	if err != nil {
		return err
	}
	h := sha256.New()
	_, err = io.Copy(io.MultiWriter(f, h), resp.Body)
	f.Close()
	if err != nil {
		return err
	}
	if hex.EncodeToString(h.Sum(nil)) != whSetupSHA256 {
		os.Remove(exe)
		return errors.New("the Windhawk download didn't match the real one, stopped")
	}
	say("Installing Windhawk")
	c := hidden(exec.Command(exe, "/S", "/STANDARD"))
	if err := c.Start(); err != nil {
		return err
	}
	done := make(chan error, 1)
	go func() { done <- c.Wait() }()
	select {
	case err = <-done:
	case <-time.After(5 * time.Minute):
		c.Process.Kill()
		return errors.New("Windhawk setup took too long")
	}
	if err != nil {
		return fmt.Errorf("Windhawk setup failed: %w", err)
	}
	os.Remove(exe)
	for i := 0; i < 30; i++ {
		if root, _ := whRoot(); root != "" {
			if !procRunning("windhawk.exe") {
				hidden(exec.Command(filepath.Join(root, "windhawk.exe"), "-tray-only")).Start()
			}
			return nil
		}
		time.Sleep(time.Second)
	}
	return errors.New("Windhawk installed but can't be found")
}

func (p *winPlatform) OpenWindhawk() error {
	root, _ := whRoot()
	if root == "" {
		return errors.New("Windhawk isn't installed yet")
	}
	return exec.Command(filepath.Join(root, "windhawk.exe")).Start()
}

// ---------- Windows animations ----------

type spiFlag struct {
	name     string
	get, set uint32
	viaUI    bool // value goes in uiParam (else pvParam)
}

var spiFlags = []spiFlag{
	{"uieffects", 0x103E, 0x103F, false},
	{"clientanim", 0x1042, 0x1043, false},
	{"menuanim", 0x1002, 0x1003, false},
	{"menufade", 0x1012, 0x1013, false},
	{"comboanim", 0x1004, 0x1005, false},
	{"listsmooth", 0x1006, 0x1007, false},
	{"tipanim", 0x1016, 0x1017, false},
	{"tipfade", 0x1018, 0x1019, false},
	{"selfade", 0x1014, 0x1015, false},
	{"cursorshadow", 0x101A, 0x101B, false},
	{"dropshadow", 0x1024, 0x1025, false},
	{"hottrack", 0x100E, 0x100F, false},
	{"gradcaption", 0x1008, 0x1009, false},
	{"dragfull", 0x0026, 0x0025, true},
	{"fontsmooth", 0x004A, 0x004B, true},
}

type fxReg struct {
	path, name string
	on         uint32
}

var fxRegs = []fxReg{
	{`Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced`, "TaskbarAnimations", 1},
	{`Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced`, "ListviewAlphaSelect", 1},
	{`Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced`, "ListviewShadow", 1},
	{`Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects`, "VisualFXSetting", 1},
	{`Software\Microsoft\Windows\DWM`, "EnableAeroPeek", 1},
	{`Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`, "EnableTransparency", 1},
}

func spiGetBool(f spiFlag) bool {
	var v int32
	procSPI.Call(uintptr(f.get), 0, uintptr(unsafe.Pointer(&v)), 0)
	return v != 0
}

func spiSetBool(f spiFlag, on bool) {
	b := uintptr(0)
	if on {
		b = 1
	}
	if f.viaUI {
		procSPI.Call(uintptr(f.set), b, 0, 3)
	} else {
		procSPI.Call(uintptr(f.set), 0, b, 3) // SPIF_UPDATEINIFILE|SPIF_SENDCHANGE
	}
}

type animInfo struct {
	cb  uint32
	min int32
}

func minAnim() bool {
	a := animInfo{cb: 8}
	procSPI.Call(0x0048, 8, uintptr(unsafe.Pointer(&a)), 0)
	return a.min != 0
}

func setMinAnim(on bool) {
	a := animInfo{cb: 8}
	if on {
		a.min = 1
	}
	procSPI.Call(0x0049, 8, uintptr(unsafe.Pointer(&a)), 3)
}

type fxBackup struct {
	SPI     map[string]bool    `json:"spi"`
	MinAnim bool               `json:"minAnim"`
	Reg     map[string]*uint32 `json:"reg"` // nil = value didn't exist
}

func (p *winPlatform) fxBackupPath() string { return filepath.Join(p.base, "windows-animations-before.json") }

func (p *winPlatform) FxOn() bool {
	for _, f := range spiFlags {
		if !spiGetBool(f) {
			return false
		}
	}
	return minAnim()
}

func broadcast() {
	for _, s := range []string{"ImmersiveColorSet", "TraySettings", "WindowMetrics"} {
		ptr, _ := windows.UTF16PtrFromString(s)
		var res uintptr
		procSendMsgTO.Call(0xFFFF, 0x001A, 0, uintptr(unsafe.Pointer(ptr)), 0x0002, 1000, uintptr(unsafe.Pointer(&res)))
	}
}

func (p *winPlatform) SetFx(on bool) error {
	if on {
		if _, err := os.Stat(p.fxBackupPath()); err != nil { // remember how it was, once
			b := fxBackup{SPI: map[string]bool{}, MinAnim: minAnim(), Reg: map[string]*uint32{}}
			for _, f := range spiFlags {
				b.SPI[f.name] = spiGetBool(f)
			}
			for _, r := range fxRegs {
				if k, err := registry.OpenKey(registry.CURRENT_USER, r.path, registry.QUERY_VALUE); err == nil {
					if v, _, err := k.GetIntegerValue(r.name); err == nil {
						x := uint32(v)
						b.Reg[r.path+`\`+r.name] = &x
					} else {
						b.Reg[r.path+`\`+r.name] = nil
					}
					k.Close()
				}
			}
			j, _ := json.MarshalIndent(b, "", " ")
			os.MkdirAll(p.base, 0o755)
			if err := os.WriteFile(p.fxBackupPath(), j, 0o644); err != nil {
				return err
			}
		}
		for _, f := range spiFlags {
			spiSetBool(f, true)
		}
		setMinAnim(true)
		for _, r := range fxRegs {
			k, _, err := registry.CreateKey(registry.CURRENT_USER, r.path, registry.SET_VALUE)
			if err == nil {
				k.SetDWordValue(r.name, r.on)
				k.Close()
			}
		}
		broadcast()
		return nil
	}
	j, err := os.ReadFile(p.fxBackupPath())
	if err != nil {
		return errors.New("nothing to undo: DeskVerse didn't change your Windows animations")
	}
	var b fxBackup
	if err := json.Unmarshal(j, &b); err != nil {
		return err
	}
	for _, f := range spiFlags {
		if v, ok := b.SPI[f.name]; ok {
			spiSetBool(f, v)
		}
	}
	setMinAnim(b.MinAnim)
	for _, r := range fxRegs {
		v, ok := b.Reg[r.path+`\`+r.name]
		if !ok {
			continue
		}
		k, _, err := registry.CreateKey(registry.CURRENT_USER, r.path, registry.SET_VALUE)
		if err != nil {
			continue
		}
		if v == nil {
			k.DeleteValue(r.name)
		} else {
			k.SetDWordValue(r.name, *v)
		}
		k.Close()
	}
	broadcast()
	os.Remove(p.fxBackupPath())
	return nil
}

// ---------- Lively Wallpaper (Microsoft Store) ----------

func livelyPFN() string {
	m, _ := filepath.Glob(filepath.Join(os.Getenv("LOCALAPPDATA"), "Packages", "*rocksdanister.LivelyWallpaper_*"))
	if len(m) == 0 {
		return ""
	}
	return filepath.Base(m[0])
}

func (p *winPlatform) Lively() bool { return livelyPFN() != "" }

func (p *winPlatform) OpenLively() error {
	// explorer.exe starts things as the normal (not admin) you.
	if pfn := livelyPFN(); pfn != "" {
		return exec.Command("explorer.exe", `shell:AppsFolder\`+pfn+`!App`).Start()
	}
	return exec.Command("explorer.exe", "ms-windows-store://pdp/?ProductId="+livelyStoreID).Start()
}
