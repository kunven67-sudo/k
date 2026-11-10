package main

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
)

func mkZip(t *testing.T, path string, files map[string]string) {
	f, _ := os.Create(path)
	w := zip.NewWriter(f)
	for n, c := range files {
		e, _ := w.Create(n)
		e.Write([]byte(c))
	}
	w.Close()
	f.Close()
}

func TestUnzipExe(t *testing.T) {
	dir := t.TempDir()
	one := filepath.Join(dir, "Game.zip")
	mkZip(t, one, map[string]string{"Game.exe": "MZ"})
	got, err := unzipExe(one, dir)
	if err != nil || len(got) != 1 || filepath.Base(got[0]) != "Game.exe" || filepath.Dir(got[0]) != dir {
		t.Fatalf("one exe: %v %v", got, err)
	}
	got, _ = unzipExe(one, dir) // again: doesn't overwrite
	if filepath.Base(got[0]) != "Game (2).exe" {
		t.Fatalf("second time: %v", got)
	}
	app := filepath.Join(dir, "App.zip")
	mkZip(t, app, map[string]string{"App.exe": "MZ", "data/a.dll": "x"})
	got, err = unzipExe(app, dir)
	if err != nil || len(got) != 1 || got[0] != filepath.Join(dir, "App", "App.exe") {
		t.Fatalf("app folder: %v %v", got, err)
	}
	if _, err := os.Stat(filepath.Join(dir, "App", "data", "a.dll")); err != nil {
		t.Fatal("dll missing")
	}
	plain := filepath.Join(dir, "pics.zip")
	mkZip(t, plain, map[string]string{"a.png": "x"})
	if got, err := unzipExe(plain, dir); got != nil || err != nil {
		t.Fatalf("plain zip touched: %v %v", got, err)
	}
	bad := filepath.Join(dir, "bad.zip")
	mkZip(t, bad, map[string]string{"../evil.exe": "MZ"})
	if _, err := unzipExe(bad, dir); err == nil {
		t.Fatal("../ accepted")
	}
}
