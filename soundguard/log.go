package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime/debug"
	"sync"
	"time"
)

// debug log for bug hunting: %LOCALAPPDATA%\SoundGuard\debug.log (max ~1 MB, then starts over).
var (
	logMu   sync.Mutex
	logPath string
	logEcho bool
)

func setLogFile(dir string) {
	logMu.Lock()
	defer logMu.Unlock()
	os.MkdirAll(dir, 0o755)
	logPath = filepath.Join(dir, "debug.log")
	if fi, err := os.Stat(logPath); err == nil && fi.Size() > 1<<20 {
		os.Rename(logPath, logPath+".old")
	}
}

func logf(format string, a ...any) {
	line := time.Now().Format("2006-01-02 15:04:05.000 ") + fmt.Sprintf(format, a...) + "\n"
	logMu.Lock()
	defer logMu.Unlock()
	if logEcho {
		os.Stderr.WriteString(line)
	}
	if logPath == "" {
		return
	}
	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	f.WriteString(line)
	f.Close()
}

func stack() string { return string(debug.Stack()) }
