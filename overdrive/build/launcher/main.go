// OVERDRIVE.exe: OVERDRIVE's own app.
//
//	OVERDRIVE.exe                 starts OVERDRIVE's bundled Python (the brain side) with no console window.
//	                              Python then opens the window by starting "OVERDRIVE.exe --window <address>".
//	OVERDRIVE.exe --window URL    OVERDRIVE's own window (WebView2, the engine Windows apps like Teams use).
//	                              No Edge browser, no tabs, no address bar. Only one window: a second start
//	                              brings the first one back.
//	OVERDRIVE.exe --os URL        OVERDRIVE OS: a full-screen desktop with its own taskbar on top of Windows.
//
// No keyboard hooks (hotkeys use RegisterHotKey), no PowerShell, no admin rights.
package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"
)

const createNoWindow = 0x08000000

func messageBox(title, text string) {
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(text)
	procMessageBoxW.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x10)
}

func argAfter(args []string, flag string) string {
	for i, a := range args {
		if a == flag && i+1 < len(args) {
			return args[i+1]
		}
	}
	return ""
}

func main() {
	args := os.Args[1:]
	if u := argAfter(args, "--window"); u != "" {
		os.Exit(runAppWindow(u, argAfter(args, "--data")))
	}
	if u := argAfter(args, "--os"); u != "" {
		os.Exit(runShell(u, argAfter(args, "--data")))
	}
	startPython(args)
}

func startPython(args []string) {
	exe, err := os.Executable()
	if err != nil {
		messageBox("OVERDRIVE", "Can't find where OVERDRIVE.exe is: "+err.Error())
		os.Exit(1)
	}
	dir := filepath.Dir(exe)
	py := filepath.Join(dir, "python", "python.exe")
	app := filepath.Join(dir, "app")
	if _, err := os.Stat(py); err != nil {
		messageBox("OVERDRIVE", "The 'python' folder next to OVERDRIVE.exe is missing.\n\n"+
			"Unzip the whole OVERDRIVE folder first (don't run it from inside the zip), then open OVERDRIVE.exe again.")
		os.Exit(1)
	}
	pargs := append([]string{"-E", "-s", "-X", "utf8", "-m", "overdrive"}, args...)
	cmd := exec.Command(py, pargs...)
	cmd.Dir = app
	cmd.Env = append(os.Environ(), "OVERDRIVE_EXE="+exe)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
	if err := cmd.Start(); err != nil {
		messageBox("OVERDRIVE", "Couldn't start OVERDRIVE: "+err.Error())
		os.Exit(1)
	}
	// Don't wait: OVERDRIVE keeps running on its own and closes itself when its window is closed.
}
