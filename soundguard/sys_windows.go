//go:build windows

package main

import (
	"fmt"
	"html"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
	"unicode/utf16"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

var (
	user32            = windows.NewLazySystemDLL("user32.dll")
	procMessageBox    = user32.NewProc("MessageBoxW")
	procFindWindow    = user32.NewProc("FindWindowW")
	procShowWindow    = user32.NewProc("ShowWindow")
	procSetFg         = user32.NewProc("SetForegroundWindow")
	procAllowFg       = user32.NewProc("AllowSetForegroundWindow")
	procRegMsg        = user32.NewProc("RegisterWindowMessageW")
	procPostMsg       = user32.NewProc("PostMessageW")
	procRegClass      = user32.NewProc("RegisterClassExW")
	procCreateWin     = user32.NewProc("CreateWindowExW")
	procDefWinProc    = user32.NewProc("DefWindowProcW")
	procGetMsg        = user32.NewProc("GetMessageW")
	procTranslate     = user32.NewProc("TranslateMessage")
	procDispatch      = user32.NewProc("DispatchMessageW")
	procPostQuit      = user32.NewProc("PostQuitMessage")
	procLoadImage     = user32.NewProc("LoadImageW")
	procSysMetrics    = user32.NewProc("GetSystemMetrics")
	procMsgFilter     = user32.NewProc("ChangeWindowMessageFilterEx")
	procCreateMenu    = user32.NewProc("CreatePopupMenu")
	procAppendMenu    = user32.NewProc("AppendMenuW")
	procTrackMenu     = user32.NewProc("TrackPopupMenu")
	procDestroyMenu   = user32.NewProc("DestroyMenu")
	procGetCursorPos  = user32.NewProc("GetCursorPos")
	procIsWindow      = user32.NewProc("IsWindow")
	shell32           = windows.NewLazySystemDLL("shell32.dll")
	procNotifyIcon    = shell32.NewProc("Shell_NotifyIconW")
	cfgmgr            = windows.NewLazySystemDLL("cfgmgr32.dll")
	procCMListSize    = cfgmgr.NewProc("CM_Get_Device_ID_List_SizeW")
	procCMList        = cfgmgr.NewProc("CM_Get_Device_ID_ListW")
	procCMLocate      = cfgmgr.NewProc("CM_Locate_DevNodeW")
	procCMStatus      = cfgmgr.NewProc("CM_Get_DevNode_Status")
	procCMProp        = cfgmgr.NewProc("CM_Get_DevNode_Registry_PropertyW")
	dwmapi            = windows.NewLazySystemDLL("dwmapi.dll")
	procDwmSetAttr    = dwmapi.NewProc("DwmSetWindowAttribute")
	secur32           = windows.NewLazySystemDLL("secur32.dll")
	procGetUserNameEx = secur32.NewProc("GetUserNameExW")
)

func u16(s string) *uint16 { p, _ := windows.UTF16PtrFromString(s); return p }

var quiet bool

func msgBox(text string, warn bool) {
	if quiet {
		os.Stderr.WriteString(text + "\n")
		return
	}
	flags := uintptr(0x40)
	if warn {
		flags = 0x30
	}
	procMessageBox.Call(0, ptr(u16(text)), ptr(u16("SoundGuard")), flags)
}

func isAdmin() bool { return windows.GetCurrentProcessToken().IsElevated() }

func hidden(name string, args ...string) *exec.Cmd {
	c := exec.Command(name, args...)
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	return c
}

func sys32(exe string) string { return filepath.Join(os.Getenv("SystemRoot"), "System32", exe) }

func regMsg(name string) uint32 {
	r, _, _ := procRegMsg.Call(ptr(u16(name)))
	return uint32(r)
}

var (
	msgShow    = regMsg("SoundGuard-Show")
	msgQuit    = regMsg("SoundGuard-Quit")
	msgTaskbar = regMsg("TaskbarCreated")
)

const trayClass = "SoundGuardTray"

func findWin(class, title string) uintptr {
	var c, t uintptr
	if class != "" {
		c = ptr(u16(class))
	}
	if title != "" {
		t = ptr(u16(title))
	}
	h, _, _ := procFindWindow.Call(c, t)
	return h
}

func bringToFront(h uintptr) {
	procShowWindow.Call(h, 9)
	procSetFg.Call(h)
}

// ---------- the PC ----------

type winPC struct {
	*winAudio
	tray      *tray
	admin     bool
	mu        sync.Mutex
	installed bool
	startup   bool
	url       string
	winCmd    *exec.Cmd
}

func newWinPC() *winPC {
	p := &winPC{winAudio: newWinAudio(), admin: isAdmin()}
	p.refreshInstall()
	return p
}

func (p *winPC) refreshInstall() {
	inst := installedVersion() != ""
	st := false
	if inst {
		out, _ := hidden(sys32("schtasks.exe"), "/Query", "/TN", "SoundGuard", "/FO", "CSV", "/NH").Output()
		st = len(out) > 0 && !strings.Contains(strings.ToLower(string(out)), "disabled")
	}
	p.mu.Lock()
	p.installed, p.startup = inst, st
	p.mu.Unlock()
}

func (p *winPC) Admin() bool { return p.admin }
func (p *winPC) Installed() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.installed
}
func (p *winPC) Startup() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.startup
}

func (p *winPC) SetStartup(on bool) error {
	if !p.Installed() {
		return fmt.Errorf("open SoundGuard again and press Yes once, then it can start with Windows")
	}
	f := "/DISABLE"
	if on {
		f = "/ENABLE"
	}
	out, err := hidden(sys32("schtasks.exe"), "/Change", "/TN", "SoundGuard", f).CombinedOutput()
	p.refreshInstall()
	if err != nil {
		return fmt.Errorf("%v: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func svcState(name string) string {
	m, err := windows.OpenSCManager(nil, nil, windows.SC_MANAGER_CONNECT)
	if err != nil {
		return "unknown"
	}
	defer windows.CloseServiceHandle(m)
	s, err := windows.OpenService(m, u16(name), windows.SERVICE_QUERY_STATUS)
	if err != nil {
		return "unknown"
	}
	defer windows.CloseServiceHandle(s)
	var st windows.SERVICE_STATUS
	if windows.QueryServiceStatus(s, &st) != nil {
		return "unknown"
	}
	switch st.CurrentState {
	case windows.SERVICE_RUNNING:
		return "running"
	case windows.SERVICE_STOPPED:
		return "stopped"
	}
	return "starting"
}

func (p *winPC) Services() map[string]string {
	return map[string]string{"Audiosrv": svcState("Audiosrv"), "AudioEndpointBuilder": svcState("AudioEndpointBuilder")}
}

func waitSvc(s *mgr.Service, want svc.State, d time.Duration) error {
	end := time.Now().Add(d)
	for time.Now().Before(end) {
		st, err := s.Query()
		if err == nil && st.State == want {
			return nil
		}
		time.Sleep(200 * time.Millisecond)
	}
	return fmt.Errorf("Windows didn't finish in %v", d)
}

func (p *winPC) StartService(name string) error {
	if !p.admin {
		return fmt.Errorf("needs SoundGuard's one-time Yes (open it again)")
	}
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()
	s, err := m.OpenService(name)
	if err != nil {
		return err
	}
	defer s.Close()
	if c, err := s.Config(); err == nil && c.StartType == mgr.StartDisabled {
		c.StartType = mgr.StartAutomatic
		s.UpdateConfig(c)
	}
	if err := s.Start(); err != nil && !strings.Contains(err.Error(), "already running") {
		return err
	}
	return waitSvc(s, svc.Running, 15*time.Second)
}

func (p *winPC) RestartAudio() error {
	if !p.admin {
		return fmt.Errorf("needs SoundGuard's one-time Yes (open it again)")
	}
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()
	s, err := m.OpenService("Audiosrv")
	if err != nil {
		return err
	}
	defer s.Close()
	p.dropMeters()
	if st, err := s.Query(); err == nil && st.State != svc.Stopped {
		s.Control(svc.Stop)
		if err := waitSvc(s, svc.Stopped, 12*time.Second); err != nil {
			return fmt.Errorf("Windows Audio wouldn't stop: %v", err)
		}
	}
	if err := s.Start(); err != nil {
		return err
	}
	err = waitSvc(s, svc.Running, 15*time.Second)
	p.dropMeters()
	return err
}

// ---------- drivers (Device Manager info) ----------

func devIDs(filter string, flags uint32) []string {
	var n uint32
	if r, _, _ := procCMListSize.Call(ptr(&n), ptr(u16(filter)), uintptr(flags)); r != 0 || n == 0 {
		return nil
	}
	buf := make([]uint16, n)
	if r, _, _ := procCMList.Call(ptr(u16(filter)), ptr(&buf[0]), uintptr(n), uintptr(flags)); r != 0 {
		return nil
	}
	var out []string
	start := 0
	for i, c := range buf {
		if c == 0 {
			if i > start {
				out = append(out, string(utf16.Decode(buf[start:i])))
			}
			start = i + 1
		}
	}
	return out
}

func devNode(id string) (uint32, bool) {
	var dn uint32
	r, _, _ := procCMLocate.Call(ptr(&dn), ptr(u16(id)), 0)
	return dn, r == 0
}

func devProp(dn, prop uint32) string {
	buf := make([]uint16, 512)
	l := uint32(len(buf) * 2)
	var typ uint32
	if r, _, _ := procCMProp.Call(uintptr(dn), uintptr(prop), ptr(&typ), ptr(&buf[0]), ptr(&l), 0); r != 0 {
		return ""
	}
	return windows.UTF16ToString(buf)
}

func hdmiAudio(id string) bool {
	u := strings.ToUpper(id)
	return strings.Contains(u, "VEN_10DE") || strings.Contains(u, "VEN_8086") || strings.Contains(u, "VEN_1002")
}

func (p *winPC) DriverIssues() []DriverIssue {
	var out []DriverIssue
	ids := devIDs("HDAUDIO", 0x1)
	for _, s := range []string{"usbaudio", "usbaudio2"} {
		ids = append(ids, devIDs(s, 0x2|0x100)...)
	}
	presentRealtek, ghostRealtek := false, false
	for _, id := range ids {
		if hdmiAudio(id) {
			continue
		}
		rt := strings.Contains(strings.ToUpper(id), "VEN_10EC")
		dn, ok := devNode(id)
		if !ok {
			if rt {
				ghostRealtek = true
			}
			continue
		}
		if rt {
			presentRealtek = true
		}
		var st, prob uint32
		procCMStatus.Call(ptr(&st), ptr(&prob), uintptr(dn), 0)
		need := st&0x100 != 0 || prob == 14
		if (st&0x400 != 0 && prob != 22) || need {
			name := devProp(dn, 0x0D)
			if name == "" {
				name = devProp(dn, 0x01)
			}
			out = append(out, DriverIssue{Name: name, Problem: prob, NeedRestart: need})
		}
	}
	if ghostRealtek && !presentRealtek {
		out = append(out, DriverIssue{Name: "Realtek Audio", Missing: true})
	}
	return out
}

func (p *winPC) DriverInfo() string {
	for _, id := range devIDs("HDAUDIO", 0x1|0x100) {
		if !strings.Contains(strings.ToUpper(id), "VEN_10EC") {
			continue
		}
		dn, ok := devNode(id)
		if !ok {
			continue
		}
		key := devProp(dn, 0x0A)
		if key == "" {
			continue
		}
		k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\Class\`+key, registry.QUERY_VALUE)
		if err != nil {
			continue
		}
		ver, _, _ := k.GetStringValue("DriverVersion")
		date, _, _ := k.GetStringValue("DriverDate")
		desc, _, _ := k.GetStringValue("DriverDesc")
		k.Close()
		return strings.TrimSpace(fmt.Sprintf("%s %s (%s)", desc, ver, date))
	}
	return ""
}

// ---------- mic privacy ----------

const capKey = `Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone`

type privSpot struct {
	root registry.Key
	path string
	name string
}

var privSpots = []privSpot{
	{registry.LOCAL_MACHINE, capKey, "Microphone access (whole PC)"},
	{registry.CURRENT_USER, capKey, "Let apps use the mic"},
	{registry.CURRENT_USER, capKey + `\NonPackaged`, "Let desktop apps use the mic"},
}

func (p *winPC) MicPrivacy() (bool, string) {
	for _, s := range privSpots {
		k, err := registry.OpenKey(s.root, s.path, registry.QUERY_VALUE)
		if err != nil {
			continue
		}
		v, _, _ := k.GetStringValue("Value")
		k.Close()
		if strings.EqualFold(v, "Deny") {
			return false, s.name
		}
	}
	return true, ""
}

func (p *winPC) FixMicPrivacy() error {
	for _, s := range privSpots {
		k, err := registry.OpenKey(s.root, s.path, registry.QUERY_VALUE|registry.SET_VALUE)
		if err != nil {
			continue
		}
		v, _, _ := k.GetStringValue("Value")
		if strings.EqualFold(v, "Deny") {
			err = k.SetStringValue("Value", "Allow")
		}
		k.Close()
		if err != nil {
			return fmt.Errorf("%s: %v", s.name, err)
		}
	}
	return nil
}

func (p *winPC) RestartPC() error {
	return hidden(sys32("shutdown.exe"), "/r", "/t", "20", "/c", "SoundGuard: restarting in 20 seconds to unstick the sound driver. Save your stuff.").Start()
}

func (p *winPC) Notify(title, text string) {
	if p.tray != nil {
		p.tray.balloon(title, text)
	}
}

func (p *winPC) SetTray(bad bool, tip string) {
	if p.tray != nil {
		p.tray.set(bad, tip)
	}
}

func (p *winPC) Uninstall() error {
	if !p.admin {
		return fmt.Errorf("needs SoundGuard's one-time Yes")
	}
	return uninstallAll(false)
}

// openWindow: the window is its own process (closing it frees all its memory).
func (p *winPC) openWindow() {
	if h := findWin("webview", "SoundGuard"); h != 0 {
		bringToFront(h)
		return
	}
	exe, _ := os.Executable()
	procAllowFg.Call(uintptr(0xFFFFFFFF))
	c := exec.Command(exe, "-window", p.url)
	if c.Start() == nil {
		go c.Wait()
	}
}

// ---------- tray icon ----------

type notifyIconData struct {
	cbSize       uint32
	hwnd         uintptr
	id           uint32
	flags        uint32
	callback     uint32
	icon         uintptr
	tip          [128]uint16
	state        uint32
	stateMask    uint32
	info         [256]uint16
	version      uint32
	infoTitle    [64]uint16
	infoFlags    uint32
	guid         windows.GUID
	balloonIcon  uintptr
}

type wndClassEx struct {
	size, style            uint32
	proc                   uintptr
	clsExtra, wndExtra     int32
	inst, icon, cur, bg    uintptr
	menuName, className    *uint16
	iconSm                 uintptr
}

type winMsg struct {
	hwnd    uintptr
	msg     uint32
	wp, lp  uintptr
	time    uint32
	pt      [2]int32
	private uint32
}

const wmTray = 0x8000 + 1

type tray struct {
	hwnd    uintptr
	mu      sync.Mutex
	icons   [2]uintptr
	big     uintptr
	bad     bool
	tip     string
	app     *App
}

var theTray *tray

func copyU16(dst []uint16, s string) {
	u := utf16.Encode([]rune(s))
	if len(u) > len(dst)-1 {
		u = u[:len(dst)-1]
	}
	copy(dst, u)
	dst[len(u)] = 0
}

func loadIcon(id, size uintptr) uintptr {
	var inst windows.Handle
	windows.GetModuleHandleEx(0, nil, &inst)
	h, _, _ := procLoadImage.Call(uintptr(inst), id, 1, size, size, 0)
	return h
}

func newTray(app *App) *tray {
	t := &tray{app: app, tip: "SoundGuard"}
	theTray = t
	var inst windows.Handle
	windows.GetModuleHandleEx(0, nil, &inst)
	wc := wndClassEx{proc: windows.NewCallback(trayProc), inst: uintptr(inst), className: u16(trayClass)}
	wc.size = uint32(unsafe.Sizeof(wc))
	procRegClass.Call(ptr(&wc))
	t.hwnd, _, _ = procCreateWin.Call(0, ptr(u16(trayClass)), ptr(u16("SoundGuard")), 0, 0, 0, 0, 0, 0, 0, uintptr(inst), 0)
	for _, m := range []uint32{wmTray, msgShow, msgQuit, msgTaskbar} {
		procMsgFilter.Call(t.hwnd, uintptr(m), 1, 0)
	}
	sm, _, _ := procSysMetrics.Call(49)
	t.icons[0] = loadIcon(1, sm)
	t.icons[1] = loadIcon(2, sm)
	if t.icons[1] == 0 {
		t.icons[1] = t.icons[0]
	}
	t.big = loadIcon(1, 48)
	t.add()
	return t
}

func (t *tray) nid() notifyIconData {
	var n notifyIconData
	n.cbSize = uint32(unsafe.Sizeof(n))
	n.hwnd = t.hwnd
	n.id = 1
	return n
}

func (t *tray) add() {
	t.mu.Lock()
	defer t.mu.Unlock()
	n := t.nid()
	n.flags = 1 | 2 | 4
	n.callback = wmTray
	n.icon = t.icons[0]
	if t.bad {
		n.icon = t.icons[1]
	}
	copyU16(n.tip[:], t.tip)
	procNotifyIcon.Call(0, ptr(&n))
}

func (t *tray) set(bad bool, tip string) {
	t.mu.Lock()
	if bad == t.bad && tip == t.tip {
		t.mu.Unlock()
		return
	}
	t.bad, t.tip = bad, tip
	n := t.nid()
	n.flags = 2 | 4
	n.icon = t.icons[0]
	if bad {
		n.icon = t.icons[1]
	}
	copyU16(n.tip[:], tip)
	t.mu.Unlock()
	procNotifyIcon.Call(1, ptr(&n))
}

func (t *tray) balloon(title, text string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	n := t.nid()
	n.flags = 0x10
	copyU16(n.infoTitle[:], title)
	copyU16(n.info[:], text)
	n.infoFlags = 4 | 0x20 // NIIF_USER | NIIF_LARGE_ICON
	n.balloonIcon = t.big
	procNotifyIcon.Call(1, ptr(&n))
}

func (t *tray) remove() {
	n := t.nid()
	procNotifyIcon.Call(2, ptr(&n))
}

func (t *tray) menu() {
	m, _, _ := procCreateMenu.Call()
	paused := t.app.paused()
	procAppendMenu.Call(m, 0, 1, ptr(u16("Open SoundGuard")))
	procAppendMenu.Call(m, 0, 2, ptr(u16("Fix everything now")))
	if paused {
		procAppendMenu.Call(m, 0, 3, ptr(u16("Turn fixes back on")))
	} else {
		procAppendMenu.Call(m, 0, 3, ptr(u16("Pause fixes for 1 hour")))
	}
	procAppendMenu.Call(m, 0x800, 0, 0)
	procAppendMenu.Call(m, 0, 4, ptr(u16("Quit SoundGuard")))
	var pt [2]int32
	procGetCursorPos.Call(ptr(&pt))
	procSetFg.Call(t.hwnd)
	cmd, _, _ := procTrackMenu.Call(m, 0x100|0x2|0x20, uintptr(pt[0]), uintptr(pt[1]), 0, t.hwnd, 0)
	procPostMsg.Call(t.hwnd, 0, 0, 0)
	procDestroyMenu.Call(m)
	switch cmd {
	case 1:
		go t.app.OpenWindow()
	case 2:
		go t.app.Do(req{Cmd: "fixnow"})
	case 3:
		go t.app.Do(req{Cmd: "pause", On: !paused})
	case 4:
		t.quit()
	}
}

func (t *tray) quit() {
	procPostMsg.Call(t.hwnd, uintptr(msgQuit), 0, 0)
}

func trayProc(hwnd, msg, wp, lp uintptr) uintptr {
	t := theTray
	if t != nil && hwnd == t.hwnd {
		switch uint32(msg) {
		case wmTray:
			switch lp & 0xFFFF {
			case 0x202, 0x203, 0x405: // left click, double click, balloon click
				go t.app.OpenWindow()
			case 0x205: // right click
				t.menu()
			}
			return 0
		case msgShow:
			go t.app.OpenWindow()
			return 0
		case msgQuit:
			t.remove()
			if h := findWin("webview", "SoundGuard"); h != 0 {
				procPostMsg.Call(h, 0x10, 0, 0)
			}
			procPostQuit.Call(0)
			return 0
		case msgTaskbar:
			t.add()
			return 0
		}
	}
	r, _, _ := procDefWinProc.Call(hwnd, msg, wp, lp)
	return r
}

func (t *tray) loop() {
	var m winMsg
	for {
		r, _, _ := procGetMsg.Call(ptr(&m), 0, 0, 0)
		if int32(r) <= 0 {
			return
		}
		procTranslate.Call(ptr(&m))
		procDispatch.Call(ptr(&m))
	}
}

// ---------- install / uninstall ----------

func installDir() string { return filepath.Join(os.Getenv("ProgramFiles"), "SoundGuard") }
func installedExe() string { return filepath.Join(installDir(), "SoundGuard.exe") }

const uninstKey = `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\SoundGuard`

func installedVersion() string {
	if _, err := os.Stat(installedExe()); err != nil {
		return ""
	}
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, uninstKey, registry.QUERY_VALUE)
	if err != nil {
		return ""
	}
	defer k.Close()
	v, _, _ := k.GetStringValue("DisplayVersion")
	return v
}

func verLess(a, b string) bool {
	pa, pb := strings.Split(a, "."), strings.Split(b, ".")
	for i := 0; i < 3; i++ {
		var x, y int
		if i < len(pa) {
			fmt.Sscan(pa[i], &x)
		}
		if i < len(pb) {
			fmt.Sscan(pb[i], &y)
		}
		if x != y {
			return x < y
		}
	}
	return false
}

func userName() string {
	buf := make([]uint16, 512)
	n := uint32(len(buf))
	if r, _, _ := procGetUserNameEx.Call(2, ptr(&buf[0]), ptr(&n)); r != 0 {
		return windows.UTF16ToString(buf[:n])
	}
	return os.Getenv("USERDOMAIN") + `\` + os.Getenv("USERNAME")
}

func samePath(a, b string) bool {
	a, _ = filepath.Abs(a)
	b, _ = filepath.Abs(b)
	return strings.EqualFold(filepath.Clean(a), filepath.Clean(b))
}

func bgRunning() bool {
	h, err := windows.OpenMutex(windows.SYNCHRONIZE, false, u16(`Local\SoundGuard-bg`))
	if err != nil {
		return false
	}
	windows.CloseHandle(h)
	return true
}

func waitTray(d time.Duration) uintptr {
	end := time.Now().Add(d)
	for time.Now().Before(end) {
		if h := findWin(trayClass, ""); h != 0 {
			return h
		}
		time.Sleep(200 * time.Millisecond)
	}
	return 0
}

// stopOthers: close any running SoundGuard (background + window), not this process.
func stopOthers() {
	if h := findWin(trayClass, ""); h != 0 {
		procPostMsg.Call(h, uintptr(msgQuit), 0, 0)
		for i := 0; i < 30 && bgRunning(); i++ {
			time.Sleep(200 * time.Millisecond)
		}
	}
	hidden(sys32("taskkill.exe"), "/F", "/FI", fmt.Sprintf("PID ne %d", os.Getpid()), "/IM", "SoundGuard.exe").Run()
	time.Sleep(300 * time.Millisecond)
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	var last error
	for i := 0; i < 15; i++ {
		out, err := os.Create(dst)
		if err != nil {
			last = err
			time.Sleep(300 * time.Millisecond)
			continue
		}
		in.Seek(0, 0)
		_, err = io.Copy(out, in)
		out.Close()
		return err
	}
	return last
}

const taskXML = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>SoundGuard keeps your headphones and mic working.</Description></RegistrationInfo>
  <Triggers><LogonTrigger><Enabled>true</Enabled><UserId>%s</UserId><Delay>PT5S</Delay></LogonTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>%s</UserId><LogonType>InteractiveToken</LogonType><RunLevel>HighestAvailable</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings><StopOnIdleEnd>false</StopOnIdleEnd><RestartOnIdle>false</RestartOnIdle></IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>6</Priority>
    <RestartOnFailure><Interval>PT1M</Interval><Count>3</Count></RestartOnFailure>
  </Settings>
  <Actions Context="Author"><Exec><Command>"%s"</Command><Arguments>-background</Arguments></Exec></Actions>
</Task>
`

func writeTask(user string) error {
	x := fmt.Sprintf(taskXML, html.EscapeString(user), html.EscapeString(user), html.EscapeString(installedExe()))
	u := utf16.Encode([]rune(x))
	b := make([]byte, 2+len(u)*2)
	b[0], b[1] = 0xFF, 0xFE
	for i, c := range u {
		b[2+i*2], b[3+i*2] = byte(c), byte(c>>8)
	}
	tmp := filepath.Join(os.TempDir(), "soundguard-task.xml")
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	defer os.Remove(tmp)
	out, err := hidden(sys32("schtasks.exe"), "/Create", "/TN", "SoundGuard", "/XML", tmp, "/F").CombinedOutput()
	if err != nil {
		return fmt.Errorf("start-with-Windows task: %v %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func shortcutPath() string {
	return filepath.Join(os.Getenv("ProgramData"), `Microsoft\Windows\Start Menu\Programs\SoundGuard.lnk`)
}

func makeShortcut(target, lnk string) error {
	windows.CoInitializeEx(0, windows.COINIT_APARTMENTTHREADED)
	sl, err := coCreate(g("{00021401-0000-0000-C000-000000000046}"), g("{000214F9-0000-0000-C000-000000000046}"))
	if err != nil {
		return err
	}
	defer sl.Release()
	sl.call(20, ptr(u16(target)))
	sl.call(7, ptr(u16("Keeps your headphones and mic working")))
	sl.call(9, ptr(u16(filepath.Dir(target))))
	sl.call(17, ptr(u16(target)), 0)
	pf, err := sl.QI(g("{0000010b-0000-0000-C000-000000000046}"))
	if err != nil {
		return err
	}
	defer pf.Release()
	if hr := pf.call(6, ptr(u16(lnk)), 1); failed(hr) {
		return hrErr(hr)
	}
	return nil
}

func doInstall(user string) error {
	if user == "" {
		user = userName()
	}
	stopOthers()
	self, _ := os.Executable()
	if err := os.MkdirAll(installDir(), 0o755); err != nil {
		return err
	}
	if !samePath(self, installedExe()) {
		if err := copyFile(self, installedExe()); err != nil {
			return fmt.Errorf("copy to %s: %v", installDir(), err)
		}
	}
	if err := writeTask(user); err != nil {
		return err
	}
	k, _, err := registry.CreateKey(registry.LOCAL_MACHINE, uninstKey, registry.ALL_ACCESS)
	if err == nil {
		exe := installedExe()
		k.SetStringValue("DisplayName", "SoundGuard")
		k.SetStringValue("DisplayVersion", appVersion)
		k.SetStringValue("Publisher", "SoundGuard")
		k.SetStringValue("DisplayIcon", exe+",0")
		k.SetStringValue("InstallLocation", installDir())
		k.SetStringValue("UninstallString", `"`+exe+`" -uninstall`)
		k.SetDWordValue("NoModify", 1)
		k.SetDWordValue("NoRepair", 1)
		if st, err := os.Stat(exe); err == nil {
			k.SetDWordValue("EstimatedSize", uint32(st.Size()/1024))
		}
		k.Close()
	}
	makeShortcut(installedExe(), shortcutPath())
	return nil
}

func uninstallAll(stop bool) error {
	if stop {
		stopOthers()
	}
	hidden(sys32("schtasks.exe"), "/Delete", "/TN", "SoundGuard", "/F").Run()
	registry.DeleteKey(registry.LOCAL_MACHINE, uninstKey)
	os.Remove(shortcutPath())
	if !stop {
		if h := findWin("webview", "SoundGuard"); h != 0 {
			procPostMsg.Call(h, 0x10, 0, 0)
		}
	}
	data := filepath.Join(os.Getenv("LOCALAPPDATA"), "SoundGuard")
	return hidden(sys32("cmd.exe"), "/c", fmt.Sprintf(`ping -n 4 127.0.0.1 >nul & rd /s /q "%s" & rd /s /q "%s"`, installDir(), data)).Start()
}

func runAs(file, args string) bool {
	return windows.ShellExecute(0, u16("runas"), u16(file), u16(args), nil, windows.SW_SHOWNORMAL) == nil
}

func darkTitle(hwnd uintptr) {
	on := int32(1)
	procDwmSetAttr.Call(hwnd, 20, ptr(&on), 4)
}

func isWindow(h uintptr) bool {
	r, _, _ := procIsWindow.Call(h)
	return r != 0
}
