//go:build windows

package main

// win_install.go = put SOUNDGUARD in Program Files, start it with Windows (a logon task
// with admin rights, so it can restart the sound service without asking), Start menu
// shortcut, Apps & features entry. And the clean uninstall.

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
	"unicode/utf16"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

const (
	taskName     = "SoundGuard"
	uninstallKey = `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\SoundGuard`
)

func installDir() string {
	pf := os.Getenv("ProgramFiles")
	if pf == "" {
		pf = `C:\Program Files`
	}
	return filepath.Join(pf, "SoundGuard")
}

func installedExe() string { return filepath.Join(installDir(), "SoundGuard.exe") }

func shortcutPath() string {
	pd := os.Getenv("ProgramData")
	if pd == "" {
		pd = `C:\ProgramData`
	}
	return filepath.Join(pd, `Microsoft\Windows\Start Menu\Programs\SOUNDGUARD.lnk`)
}

func isAdmin() bool {
	return windows.GetCurrentProcessToken().IsElevated()
}

func selfPath() string {
	p, err := os.Executable()
	if err != nil {
		return ""
	}
	if r, err := filepath.EvalSymlinks(p); err == nil {
		p = r
	}
	return p
}

func samePath(a, b string) bool {
	return strings.EqualFold(filepath.Clean(a), filepath.Clean(b))
}

func taskExists() bool {
	out, err := hidden(exec.Command("schtasks.exe", "/Query", "/TN", taskName)).CombinedOutput()
	return err == nil && len(out) > 0
}

func taskEnabled() bool {
	out, err := hidden(exec.Command("schtasks.exe", "/Query", "/TN", taskName, "/XML")).Output()
	if err != nil {
		return false
	}
	s := strings.ToLower(decodeUTF16(out))
	// <Settings>...<Enabled>false</Enabled> = turned off
	i := strings.Index(s, "<settings>")
	if i < 0 {
		return true
	}
	return !strings.Contains(s[i:], "<enabled>false</enabled>")
}

func decodeUTF16(b []byte) string {
	if len(b) >= 2 && b[0] == 0xFF && b[1] == 0xFE {
		u := make([]uint16, (len(b)-2)/2)
		for i := range u {
			u[i] = binary.LittleEndian.Uint16(b[2+2*i:])
		}
		return string(utf16.Decode(u))
	}
	return string(b)
}

func setTaskEnabled(on bool) error {
	flag := "/DISABLE"
	if on {
		flag = "/ENABLE"
	}
	out, err := hidden(exec.Command("schtasks.exe", "/Change", "/TN", taskName, flag)).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%v: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func runTask() error {
	out, err := hidden(exec.Command("schtasks.exe", "/Run", "/TN", taskName)).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%v: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func xmlEsc(s string) string {
	var b bytes.Buffer
	for _, r := range s {
		switch r {
		case '&':
			b.WriteString("&amp;")
		case '<':
			b.WriteString("&lt;")
		case '>':
			b.WriteString("&gt;")
		case '"':
			b.WriteString("&quot;")
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}

func currentUser() string {
	var n uint32 = 256
	buf := make([]uint16, n)
	if err := windows.GetUserNameEx(windows.NameSamCompatible, &buf[0], &n); err == nil {
		return windows.UTF16ToString(buf[:n])
	}
	return os.Getenv("USERDOMAIN") + `\` + os.Getenv("USERNAME")
}

func taskXML(exe, user string) string {
	return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Author>SOUNDGUARD</Author>
    <Description>SOUNDGUARD keeps your headphones and mic working. It fixes muted sound, wrong devices and frozen sound by itself.</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>` + xmlEsc(user) + `</UserId>
      <Delay>PT8S</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>` + xmlEsc(user) + `</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>6</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>"` + xmlEsc(exe) + `"</Command>
      <Arguments>--guard</Arguments>
    </Exec>
  </Actions>
</Task>`
}

func writeUTF16File(path, s string) error {
	u := utf16.Encode([]rune(s))
	b := make([]byte, 2+2*len(u))
	b[0], b[1] = 0xFF, 0xFE
	for i, c := range u {
		binary.LittleEndian.PutUint16(b[2+2*i:], c)
	}
	return os.WriteFile(path, b, 0o644)
}

func createTask(exe string) error {
	tmp := filepath.Join(os.TempDir(), fmt.Sprintf("soundguard-task-%d.xml", os.Getpid()))
	if err := writeUTF16File(tmp, taskXML(exe, currentUser())); err != nil {
		return err
	}
	defer os.Remove(tmp)
	out, err := hidden(exec.Command("schtasks.exe", "/Create", "/TN", taskName, "/XML", tmp, "/F")).CombinedOutput()
	if err != nil {
		return fmt.Errorf("couldn't make the start-with-Windows task: %v: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	tmp := dst + ".new"
	out, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		os.Remove(tmp)
		return err
	}
	if err := out.Close(); err != nil {
		os.Remove(tmp)
		return err
	}
	for i := 0; i < 30; i++ { // the old exe may take a moment to let go
		os.Remove(dst)
		if err = os.Rename(tmp, dst); err == nil {
			return nil
		}
		time.Sleep(200 * time.Millisecond)
	}
	os.Remove(tmp)
	return err
}

// killOthers ends every other SoundGuard.exe running FROM PROGRAM FILES (old guardian + its
// windows) so files can be replaced. Never the copy that started the install.
func killOthers() {
	dir := installDir()
	snap, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return
	}
	defer windows.CloseHandle(snap)
	var pe windows.ProcessEntry32
	pe.Size = uint32(unsafe.Sizeof(pe))
	me := uint32(os.Getpid())
	for err = windows.Process32First(snap, &pe); err == nil; err = windows.Process32Next(snap, &pe) {
		if pe.ProcessID == me || !strings.EqualFold(windows.UTF16ToString(pe.ExeFile[:]), "SoundGuard.exe") {
			continue
		}
		h, err := windows.OpenProcess(windows.PROCESS_TERMINATE|windows.SYNCHRONIZE|windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pe.ProcessID)
		if err != nil {
			continue
		}
		buf := make([]uint16, 1024)
		n := uint32(len(buf))
		if windows.QueryFullProcessImageName(h, 0, &buf[0], &n) != nil || !samePath(filepath.Dir(windows.UTF16ToString(buf[:n])), dir) {
			windows.CloseHandle(h)
			continue
		}
		logf("ending old SoundGuard pid %d", pe.ProcessID)
		windows.TerminateProcess(h, 0)
		windows.WaitForSingleObject(h, 3000)
		windows.CloseHandle(h)
	}
}

func writeUninstallEntry(exe string) error {
	k, _, err := registry.CreateKey(registry.LOCAL_MACHINE, uninstallKey, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	size := uint32(0)
	if fi, err := os.Stat(exe); err == nil {
		size = uint32(fi.Size() / 1024)
	}
	k.SetStringValue("DisplayName", "SOUNDGUARD")
	k.SetStringValue("DisplayVersion", appVersion)
	k.SetStringValue("Publisher", "SOUNDGUARD")
	k.SetStringValue("DisplayIcon", exe+",0")
	k.SetStringValue("InstallLocation", filepath.Dir(exe))
	k.SetStringValue("UninstallString", `"`+exe+`" --uninstall`)
	k.SetDWordValue("NoModify", 1)
	k.SetDWordValue("NoRepair", 1)
	k.SetDWordValue("EstimatedSize", size)
	return nil
}

// ---------- Start menu shortcut (IShellLinkW) ----------

var (
	clsidShellLink  = mustGUID("{00021401-0000-0000-C000-000000000046}")
	iidIShellLinkW  = mustGUID("{000214F9-0000-0000-C000-000000000046}")
	iidIPersistFile = mustGUID("{0000010B-0000-0000-C000-000000000046}")
)

func makeShortcut(lnk, target, desc string) error {
	var err error
	done := make(chan struct{})
	go func() {
		defer close(done)
		withCOMSTA(func() {
			sl, e := coCreate(&clsidShellLink, &iidIShellLinkW, clsctxInprocServer)
			if e != nil {
				err = e
				return
			}
			defer sl.Release()
			t, _ := windows.UTF16PtrFromString(target)
			d, _ := windows.UTF16PtrFromString(desc)
			wd, _ := windows.UTF16PtrFromString(filepath.Dir(target))
			sl.call(20, uintptr(unsafe.Pointer(t)))    // SetPath
			sl.call(7, uintptr(unsafe.Pointer(d)))     // SetDescription
			sl.call(9, uintptr(unsafe.Pointer(wd)))    // SetWorkingDirectory
			sl.call(17, uintptr(unsafe.Pointer(t)), 0) // SetIconLocation
			pf, e := sl.QI(&iidIPersistFile)
			if e != nil {
				err = e
				return
			}
			defer pf.Release()
			p, _ := windows.UTF16PtrFromString(lnk)
			err = hrErr(pf.call(6, uintptr(unsafe.Pointer(p)), 1)) // Save
		})
	}()
	<-done
	return err
}

func withCOMSTA(f func()) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	r, _, _ := procCoInitializeEx.Call(0, coinitApartmentThreaded)
	if int32(uint32(r)) >= 0 {
		defer procCoUninitialize.Call()
	}
	f()
}

// ---------- install / uninstall (run elevated) ----------

// install copies this exe to Program Files and sets up start-with-Windows. start = run it now.
func install(start bool) error {
	if !isAdmin() {
		return errors.New("needs admin")
	}
	src, dst := selfPath(), installedExe()
	logf("install %s -> %s", src, dst)
	if !samePath(src, dst) {
		killOthers()
		if err := os.MkdirAll(installDir(), 0o755); err != nil {
			return err
		}
		if err := copyFile(src, dst); err != nil {
			return fmt.Errorf("couldn't copy SOUNDGUARD to Program Files: %v", err)
		}
	}
	if err := createTask(dst); err != nil {
		return err
	}
	if err := makeShortcut(shortcutPath(), dst, "SOUNDGUARD - keeps your headphones and mic working"); err != nil {
		logf("shortcut: %v", err) // not fatal
	}
	if err := writeUninstallEntry(dst); err != nil {
		logf("uninstall entry: %v", err)
	}
	if start {
		if err := runTask(); err != nil {
			logf("run task: %v; starting directly", err)
			c := exec.Command(dst, "--guard", "--show")
			if err := c.Start(); err != nil {
				return err
			}
		}
	}
	return nil
}

func uninstall() error {
	if !isAdmin() {
		return errors.New("needs admin")
	}
	logf("uninstall")
	killOthers() // (not "schtasks /End": when the guardian removes itself that would kill it halfway)
	out, err := hidden(exec.Command("schtasks.exe", "/Delete", "/TN", taskName, "/F")).CombinedOutput()
	if err != nil && taskExists() {
		return fmt.Errorf("couldn't remove the task: %s", strings.TrimSpace(string(out)))
	}
	os.Remove(shortcutPath())
	registry.DeleteKey(registry.LOCAL_MACHINE, uninstallKey)
	// the running exe can't delete itself: a hidden cmd waits 5 s then removes the folder
	dir := installDir()
	if samePath(filepath.Dir(selfPath()), dir) {
		cmd := exec.Command("cmd.exe", "/c", "ping -n 6 127.0.0.1 >nul & rmdir /s /q \""+dir+"\"")
		hidden(cmd).Start()
	} else {
		os.RemoveAll(dir)
	}
	return nil
}

// elevate re-runs this exe as admin with args (Windows asks "allow changes?"). Waits for it.
func elevate(args string) error {
	verb, _ := windows.UTF16PtrFromString("runas")
	exe, _ := windows.UTF16PtrFromString(selfPath())
	params, _ := windows.UTF16PtrFromString(args)
	var info shellExecuteInfo
	info.Size = uint32(unsafe.Sizeof(info))
	info.Mask = 0x40 // SEE_MASK_NOCLOSEPROCESS
	info.Verb = verb
	info.File = exe
	info.Parameters = params
	info.Show = 0
	r, _, e := procShellExecuteExW.Call(uintptr(unsafe.Pointer(&info)))
	if r == 0 {
		if e == windows.ERROR_CANCELLED {
			return errors.New("Windows asked for permission and it got a No")
		}
		return e
	}
	if info.Process == 0 {
		return nil
	}
	defer windows.CloseHandle(info.Process)
	windows.WaitForSingleObject(info.Process, 120000)
	var code uint32
	windows.GetExitCodeProcess(info.Process, &code)
	if code != 0 {
		b, _ := os.ReadFile(filepath.Join(dataDir(), "install-error.txt"))
		if len(b) > 0 {
			return errors.New(strings.TrimSpace(string(b)))
		}
		return fmt.Errorf("setup failed (code %d)", code)
	}
	return nil
}

var procShellExecuteExW = shell32.NewProc("ShellExecuteExW")

type shellExecuteInfo struct {
	Size       uint32
	Mask       uint32
	Hwnd       uintptr
	Verb       *uint16
	File       *uint16
	Parameters *uint16
	Directory  *uint16
	Show       int32
	InstApp    uintptr
	IDList     uintptr
	Class      *uint16
	KeyClass   uintptr
	HotKey     uint32
	Icon       uintptr
	Process    windows.Handle
}

func dataDir() string {
	d := os.Getenv("LOCALAPPDATA")
	if d == "" {
		d = os.TempDir()
	}
	return filepath.Join(d, "SoundGuard")
}
