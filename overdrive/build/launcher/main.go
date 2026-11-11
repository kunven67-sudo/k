// OVERDRIVE.exe: starts OVERDRIVE's bundled Python with no console window.
//
// Python is started with CREATE_NO_WINDOW, so it gets a hidden console. Claude Code
// (started later by Python) shares that hidden console, so no black windows pop up.
// No keyboard hooks, no PowerShell, no admin rights.
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
	user32 := syscall.NewLazyDLL("user32.dll")
	proc := user32.NewProc("MessageBoxW")
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(text)
	proc.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x10)
}

func main() {
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
	args := append([]string{"-E", "-s", "-X", "utf8", "-m", "overdrive"}, os.Args[1:]...)
	cmd := exec.Command(py, args...)
	cmd.Dir = app
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
	if err := cmd.Start(); err != nil {
		messageBox("OVERDRIVE", "Couldn't start OVERDRIVE: "+err.Error())
		os.Exit(1)
	}
	// Don't wait: OVERDRIVE keeps running on its own and closes itself when its window is closed.
}
