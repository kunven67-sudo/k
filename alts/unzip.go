package main

// Auto-unzip: Claude sends apps as a zip (an .exe can't come through claude.ai as a file). When a zip from
// Claude has an .exe in it, ALTS unzips it: one exe alone goes right into Downloads, more files go into a
// folder named after the zip. Other zips are left alone. No Windows calls here.

import (
	"archive/zip"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// unzipExe returns the exes it unzipped (nil, nil = not an app zip, left alone).
func unzipExe(zipPath, dir string) ([]string, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, err
	}
	defer r.Close()
	var files []*zip.File
	hasExe := false
	var total uint64
	for _, f := range r.File {
		if f.FileInfo().IsDir() {
			continue
		}
		name := filepath.ToSlash(f.Name)
		if strings.HasPrefix(name, "/") || strings.Contains(name, "..") || strings.Contains(name, ":") {
			return nil, errors.New("strange file names inside")
		}
		if strings.EqualFold(filepath.Ext(name), ".exe") {
			hasExe = true
		}
		total += f.UncompressedSize64
		files = append(files, f)
	}
	if !hasExe {
		return nil, nil
	}
	if len(files) > 500 || total > 4<<30 {
		return nil, errors.New("too big to unzip by itself")
	}
	exists := func(p string) bool { _, err := os.Lstat(p); return err == nil }
	base := dir
	if len(files) > 1 { // an app with more files: its own folder
		base = uniqueName(dir, strings.TrimSuffix(filepath.Base(zipPath), filepath.Ext(zipPath)), exists)
	}
	var exes []string
	for _, f := range files {
		out := filepath.Join(base, filepath.FromSlash(filepath.ToSlash(f.Name)))
		if len(files) == 1 {
			out = uniqueName(dir, filepath.Base(f.Name), exists)
		}
		if !insideDir(base, out) && filepath.Dir(out) != base {
			return exes, errors.New("strange file names inside")
		}
		os.MkdirAll(filepath.Dir(out), 0o755)
		src, err := f.Open()
		if err != nil {
			return exes, err
		}
		dst, err := os.Create(out)
		if err == nil {
			_, err = io.Copy(dst, src)
			if cerr := dst.Close(); err == nil {
				err = cerr
			}
		}
		src.Close()
		if err != nil {
			return exes, err
		}
		if strings.EqualFold(filepath.Ext(out), ".exe") {
			exes = append(exes, out)
		}
	}
	return exes, nil
}
