// SPINBORN for PC: one file. Serves the game from inside the exe on this PC only (127.0.0.1) and opens it in your browser.
// Closes by itself about a minute after the game tab is closed.
package main

import (
	"embed"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"sync/atomic"
	"time"
)

//go:embed all:site
var site embed.FS

const addr = "127.0.0.1:47819"

func open(url string) { _ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start() }

func main() {
	url := "http://" + addr + "/"
	ln, err := net.Listen("tcp", addr)
	if err != nil { // already running: just open another tab
		open(url)
		return
	}
	sub, _ := fs.Sub(site, "site")
	var last atomic.Int64
	last.Store(time.Now().Unix())
	mux := http.NewServeMux()
	mux.HandleFunc("/alive", func(w http.ResponseWriter, r *http.Request) { last.Store(time.Now().Unix()); w.WriteHeader(204) })
	files := http.FileServer(http.FS(sub))
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		files.ServeHTTP(w, r)
	}))
	go func() {
		time.Sleep(90 * time.Second)
		for {
			time.Sleep(10 * time.Second)
			if time.Now().Unix()-last.Load() > 60 {
				os.Exit(0)
			}
		}
	}()
	open(url)
	_ = http.Serve(ln, mux)
}
