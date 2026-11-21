// ONE LIFE for PC: one file. Serves the game from inside the exe on this PC only (127.0.0.1)
// and opens it in an Edge app window. Closes by itself a minute after the game window is closed.
package main

import (
	"embed"
	"io/fs"
	"mime"
	"net"
	"net/http"
	"os"
	"os/exec"
	"sync/atomic"
	"syscall"
	"time"
)

//go:embed all:site
var site embed.FS

const addr = "127.0.0.1:47833"

func hidden(c *exec.Cmd) *exec.Cmd {
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	return c
}

func open(url string) {
	if hidden(exec.Command("cmd", "/c", "start", "", "msedge", "--app="+url, "--start-maximized", "--autoplay-policy=no-user-gesture-required")).Run() != nil {
		_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	}
}

func main() {
	// Windows can map .js to text/plain in the registry; module scripts need this
	_ = mime.AddExtensionType(".js", "text/javascript")
	_ = mime.AddExtensionType(".glb", "model/gltf-binary")
	_ = mime.AddExtensionType(".webp", "image/webp")
	_ = mime.AddExtensionType(".mp3", "audio/mpeg")
	_ = mime.AddExtensionType(".hdr", "application/octet-stream")
	_ = mime.AddExtensionType(".woff2", "font/woff2")
	url := "http://" + addr + "/"
	ln, err := net.Listen("tcp", addr)
	if err != nil { // already running: just open another window
		open(url)
		return
	}
	sub, _ := fs.Sub(site, "site")
	var last atomic.Int64
	last.Store(time.Now().Unix())
	mux := http.NewServeMux()
	mux.HandleFunc("/alive", func(w http.ResponseWriter, r *http.Request) { last.Store(time.Now().Unix()); w.WriteHeader(204) })
	mux.HandleFunc("/quit", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(204)
		go func() { time.Sleep(300 * time.Millisecond); os.Exit(0) }()
	})
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
