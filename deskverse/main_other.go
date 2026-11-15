//go:build !windows

package main

// Not Windows: runs the same page + API with a pretend PC, for testing the UI.
//   go run . [-nowh]   -> prints the URL

import (
	"fmt"
	"os"
	"strings"
	"sync"
)

type memReg struct {
	mu sync.Mutex
	m  map[string]map[string]any
}

func (r *memReg) val(key, name string) (any, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	v, ok := r.m[strings.ToLower(key)][name]
	return v, ok
}
func (r *memReg) set(key, name string, v any) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	k := strings.ToLower(key)
	if r.m == nil {
		r.m = map[string]map[string]any{}
	}
	if r.m[k] == nil {
		r.m[k] = map[string]any{}
	}
	r.m[k][name] = v
	return nil
}
func (r *memReg) GetString(key, name string) (string, bool) {
	v, ok := r.val(key, name)
	s, isS := v.(string)
	return s, ok && isS
}
func (r *memReg) GetDWORD(key, name string) (uint32, bool) {
	v, ok := r.val(key, name)
	d, isD := v.(uint32)
	return d, ok && isD
}
func (r *memReg) SetString(key, name, v string) error    { return r.set(key, name, v) }
func (r *memReg) SetDWORD(key, name string, v uint32) error { return r.set(key, name, v) }

type fakePlatform struct {
	mu        sync.Mutex
	installed bool
	dir       string
	reg       *memReg
	modsURL   string
	fx        bool
}

func (p *fakePlatform) Windhawk() (*Windhawk, WHStatus) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if !p.installed {
		return nil, WHStatus{}
	}
	return &Windhawk{AppData: p.dir, Version: "1.7.3", Reg: p.reg, ModsURL: p.modsURL}, WHStatus{Installed: true, OK: true, Version: "1.7.3"}
}
func (p *fakePlatform) InstallWindhawk(say func(string)) error {
	p.mu.Lock()
	p.installed = true
	p.mu.Unlock()
	return nil
}
func (p *fakePlatform) OpenWindhawk() error { return nil }
func (p *fakePlatform) FxOn() bool          { p.mu.Lock(); defer p.mu.Unlock(); return p.fx }
func (p *fakePlatform) SetFx(on bool) error { p.mu.Lock(); p.fx = on; p.mu.Unlock(); return nil }
func (p *fakePlatform) Lively() bool        { return false }
func (p *fakePlatform) OpenLively() error   { return nil }

func main() {
	dir, _ := os.MkdirTemp("", "deskverse-")
	p := &fakePlatform{installed: !(len(os.Args) > 1 && os.Args[1] == "-nowh"), dir: dir, reg: &memReg{}, modsURL: "https://mods.windhawk.net/mods/"}
	if u := os.Getenv("DV_MODS_URL"); u != "" {
		p.modsURL = u
	}
	url, err := NewApp(p).Serve()
	if err != nil {
		panic(err)
	}
	fmt.Println(url)
	select {}
}
