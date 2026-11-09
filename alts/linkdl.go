//go:build !clip

package main

// Download links in a chat (ALTS saves the file itself instead of opening Edge). No Windows calls here.

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"
)

// files a link gets downloaded for (anything else opens in your normal browser like before)
var dlExts = map[string]bool{".exe": true, ".msi": true, ".zip": true, ".7z": true, ".rar": true, ".apk": true, ".aab": true,
	".jar": true, ".iso": true, ".dll": true, ".bin": true, ".appx": true, ".msix": true, ".msixbundle": true, ".vsix": true}

// githubFile turns a GitHub link to a file into its direct download link, the repo owner and the file name.
// "" = not a file link.
func githubFile(raw string) (dl, owner, name string) {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" {
		return "", "", ""
	}
	parts := strings.Split(strings.Trim(u.EscapedPath(), "/"), "/")
	last := parts[len(parts)-1]
	if v, err := url.PathUnescape(last); err == nil {
		last = v
	}
	ext := strings.ToLower(path.Ext(last))
	switch strings.ToLower(u.Hostname()) {
	case "raw.githubusercontent.com":
		if len(parts) >= 4 && dlExts[ext] {
			return "https://raw.githubusercontent.com/" + strings.Join(parts, "/"), parts[0], last
		}
	case "github.com", "www.github.com":
		if len(parts) < 5 {
			return "", "", ""
		}
		o, r := parts[0], parts[1]
		switch parts[2] {
		case "raw":
			if dlExts[ext] {
				return "https://github.com/" + strings.Join(parts, "/"), o, last
			}
		case "blob":
			if dlExts[ext] {
				return "https://github.com/" + o + "/" + r + "/raw/" + strings.Join(parts[3:], "/"), o, last
			}
		case "releases":
			if len(parts) >= 6 && parts[3] == "download" {
				return "https://github.com/" + strings.Join(parts, "/"), o, last
			}
		}
	}
	return "", "", ""
}

// rawLink: the raw.githubusercontent.com form of a github.com/<o>/<r>/raw/... link (that one takes a
// GitHub sign-in, for files in a private repo). "" if there isn't one.
func rawLink(dl string) string {
	const pre = "https://github.com/"
	if !strings.HasPrefix(dl, pre) {
		return ""
	}
	p := strings.Split(strings.TrimPrefix(dl, pre), "/")
	if len(p) < 5 || p[2] != "raw" {
		return ""
	}
	return "https://raw.githubusercontent.com/" + p[0] + "/" + p[1] + "/" + strings.Join(p[3:], "/")
}

func mbText(n int64) string { return fmt.Sprintf("%.1f MB", float64(n)/1048576) }

// fetchTo downloads link into tmp (with a GitHub sign-in token when given). It refuses a web page
// where a file should be (that's GitHub's sign-in page for a private repo).
func fetchTo(link, tmp, token string, tick func(done, total int64)) (int64, string, error) {
	req, err := http.NewRequest("GET", link, nil)
	if err != nil {
		return 0, "", err
	}
	req.Header.Set("User-Agent", "ALTS")
	if token != "" {
		req.Header.Set("Authorization", "token "+token)
	}
	resp, err := (&http.Client{Timeout: 60 * time.Minute}).Do(req)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return 0, "", fmt.Errorf("GitHub said %d", resp.StatusCode)
	}
	if strings.HasPrefix(resp.Header.Get("Content-Type"), "text/html") {
		return 0, "", errors.New("got a web page, not the file")
	}
	f, err := os.Create(tmp)
	if err != nil {
		return 0, "", err
	}
	h := sha256.New()
	var n int64
	buf := make([]byte, 256<<10)
	next := int64(0)
	for {
		k, rerr := resp.Body.Read(buf)
		if k > 0 {
			if _, werr := f.Write(buf[:k]); werr != nil {
				f.Close()
				return 0, "", werr
			}
			h.Write(buf[:k])
			n += int64(k)
			if resp.ContentLength > 0 && n >= next {
				tick(n, resp.ContentLength)
				next = n + resp.ContentLength/4
			}
		}
		if rerr == io.EOF {
			break
		}
		if rerr != nil {
			f.Close()
			return 0, "", rerr
		}
	}
	if err := f.Close(); err != nil {
		return 0, "", err
	}
	if resp.ContentLength > 0 && n != resp.ContentLength {
		return 0, "", errors.New("it came in cut short")
	}
	return n, hex.EncodeToString(h.Sum(nil)), nil
}

// webGet downloads one link (up to 10 MB).
func webGet(link string) ([]byte, error) {
	req, err := http.NewRequest("GET", link, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "ALTS")
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, errors.New(resp.Status)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 10<<20))
}
