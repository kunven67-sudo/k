//go:build windows

package main

// Windows Core Audio (raw COM vtable calls). One worker thread owns the main COM objects;
// the silent engine test, the test sound and the mic listener get their own threads.

import (
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

type com uintptr

func (c com) call(i int, a ...uintptr) uintptr {
	vt := *(*uintptr)(unsafe.Pointer(c))
	fn := *(*uintptr)(unsafe.Pointer(vt + uintptr(i)*unsafe.Sizeof(uintptr(0))))
	r, _, _ := syscall.SyscallN(fn, append([]uintptr{uintptr(c)}, a...)...)
	return r
}

func (c com) Release() {
	if c != 0 {
		c.call(2)
	}
}

func (c com) QI(iid *windows.GUID) (com, error) {
	var p com
	if hr := c.call(0, uintptr(unsafe.Pointer(iid)), uintptr(unsafe.Pointer(&p))); failed(hr) {
		return 0, hrErr(hr)
	}
	return p, nil
}

func failed(hr uintptr) bool { return int32(uint32(hr)) < 0 }

var hrNames = map[uint32]string{
	0x88890004: "device was unplugged or changed",
	0x8889000A: "another app is using it in exclusive mode",
	0x88890010: "Windows Audio service isn't running",
	0x8889000F: "the driver couldn't make a sound stream",
	0x80070490: "not found",
	0x80040154: "class not registered",
	0x80004002: "not supported",
	0x80070005: "access denied",
	0x80004005: "failed",
}

type hrError uint32

func (e hrError) Error() string {
	if n, ok := hrNames[uint32(e)]; ok {
		return fmt.Sprintf("%s (0x%08X)", n, uint32(e))
	}
	return fmt.Sprintf("error 0x%08X", uint32(e))
}

func hrErr(hr uintptr) error { return hrError(uint32(hr)) }

func g(s string) *windows.GUID {
	x, err := windows.GUIDFromString(s)
	if err != nil {
		panic(err)
	}
	return &x
}

type propKey struct {
	fmtid windows.GUID
	pid   uint32
}

type propVariant struct {
	vt         uint16
	r1, r2, r3 uint16
	val        [2]uint64
}

var (
	ole32               = windows.NewLazySystemDLL("ole32.dll")
	procCoCreate        = ole32.NewProc("CoCreateInstance")
	procCoTaskMemFree   = ole32.NewProc("CoTaskMemFree")
	procPropVariantFree = ole32.NewProc("PropVariantClear")

	clsidEnum     = g("{BCDE0395-E52F-467C-8E3D-C4579291692E}")
	iidEnum       = g("{A95664D2-9614-4F35-A746-DE8DB63617E6}")
	iidEndpoint   = g("{1BE09788-6894-4089-8586-9A2A6C265AC5}")
	iidVolume     = g("{5CDF2C82-841E-4546-9722-0CF74078229A}")
	iidMeter      = g("{C02216F6-8C67-4B5B-9D00-D008E73E0064}")
	iidClient     = g("{1CB9AD4C-DBFA-4c32-B178-C2F568A703B2}")
	iidRender     = g("{F294ACFC-3146-4483-A7BF-ADDCA7C260E2}")
	iidCapture    = g("{C8ADBD64-E71E-48a0-A4DE-185C395CD317}")
	iidSessMgr2   = g("{77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F}")
	iidSessCtl2   = g("{bfb7ff88-7239-4fc9-8fa2-07c950be9c6d}")
	iidTopology   = g("{2A07407E-6497-4A18-9787-32F79BD0D98F}")
	iidPart       = g("{AE2DE0E4-5BCA-4F2D-AA46-5D13F8FDB3A9}")
	iidJack       = g("{4509F757-2D46-4637-8E62-CE7DB944F57B}")
	clsidPolicy   = g("{870af99c-171d-4f9e-af0d-e63df40c2bc9}")
	clsidPolicyV  = g("{294935CE-F637-4E7C-A41B-AB255460B862}")
	pkeyDevDesc   = propKey{*g("{a45c254e-df1c-4efd-8020-67d146a850e0}"), 2}
	pkeyEnumName  = propKey{*g("{a45c254e-df1c-4efd-8020-67d146a850e0}"), 24}
	pkeyIfaceName = propKey{*g("{026e516e-b814-414b-83cd-856d6fef4822}"), 2}
)

// The ways Windows lets programs pick the default sound device / turn one back on.
// (all undocumented; we try each and remember the one that works)
type policyWay struct {
	name       string
	clsid, iid *windows.GUID
	setDef     int
	setVis     int
}

var policyWays = []policyWay{
	{"PolicyConfig", clsidPolicy, g("{f8679f50-850a-41cf-9c72-430f290290c8}"), 13, 14},
	{"PolicyConfig10", clsidPolicy, g("{CA286FC3-91FD-42C3-8E9B-CAAFA66242E3}"), 13, 14},
	{"PolicyConfig10_1", clsidPolicy, g("{6be54be8-a068-4875-a49d-0c2966473b11}"), 13, 14},
	{"PolicyConfigVista", clsidPolicyV, g("{568b9108-44bf-40b4-9006-86afe5b5a620}"), 12, 13},
}

const clsctxAll = 0x17

func ptr[T any](p *T) uintptr { return uintptr(unsafe.Pointer(p)) }

func coCreate(clsid, iid *windows.GUID) (com, error) {
	var p com
	hr, _, _ := procCoCreate.Call(ptr(clsid), 0, clsctxAll, ptr(iid), ptr(&p))
	if failed(hr) {
		return 0, hrErr(hr)
	}
	return p, nil
}

func coStr(p uintptr) string {
	if p == 0 {
		return ""
	}
	s := windows.UTF16PtrToString((*uint16)(unsafe.Pointer(p)))
	procCoTaskMemFree.Call(p)
	return s
}

func devID(d com) string {
	var p uintptr
	if failed(d.call(5, ptr(&p))) {
		return ""
	}
	return coStr(p)
}

func propStr(ps com, k *propKey) string {
	var v propVariant
	if failed(ps.call(5, ptr(k), ptr(&v))) {
		return ""
	}
	s := ""
	if v.vt == 31 && v.val[0] != 0 { // VT_LPWSTR
		s = windows.UTF16PtrToString((*uint16)(unsafe.Pointer(uintptr(v.val[0]))))
	}
	procPropVariantFree.Call(ptr(&v))
	return s
}

func getDevice(en com, id string) (com, error) {
	p, _ := windows.UTF16PtrFromString(id)
	var d com
	if hr := en.call(5, ptr(p), ptr(&d)); failed(hr) {
		return 0, hrErr(hr)
	}
	return d, nil
}

func activate(d com, iid *windows.GUID) (com, error) {
	var p com
	if hr := d.call(3, ptr(iid), clsctxAll, 0, ptr(&p)); failed(hr) {
		return 0, hrErr(hr)
	}
	return p, nil
}

func stateName(s uint32) string {
	switch s {
	case 1:
		return "active"
	case 2:
		return "disabled"
	case 8:
		return "unplugged"
	}
	return "missing"
}

type ksJack struct {
	chMap, color              uint32
	connType, geo, gen, port  int32
	connected                 int32
}

func jacksOf(d com) []Jack {
	topo, err := activate(d, iidTopology)
	if err != nil {
		return nil
	}
	defer topo.Release()
	var conn com
	if failed(topo.call(4, 0, ptr(&conn))) {
		return nil
	}
	defer conn.Release()
	var to com
	if failed(conn.call(8, ptr(&to))) {
		return nil
	}
	defer to.Release()
	part, err := to.QI(iidPart)
	if err != nil {
		return nil
	}
	defer part.Release()
	var jd com
	if failed(part.call(13, 1, ptr(iidJack), ptr(&jd))) {
		return nil
	}
	defer jd.Release()
	var n uint32
	if failed(jd.call(3, ptr(&n))) {
		return nil
	}
	var out []Jack
	for i := uint32(0); i < n && i < 8; i++ {
		var k ksJack
		if failed(jd.call(4, uintptr(i), ptr(&k))) {
			continue
		}
		j := Jack{Plugged: k.connected != 0}
		switch k.geo {
		case 1, 7:
			j.Where = "back"
		case 2:
			j.Where = "front"
		}
		if k.color != 0 {
			j.Color = fmt.Sprintf("#%06x", k.color&0xFFFFFF)
		}
		out = append(out, j)
	}
	return out
}

// ---------- worker thread ----------

type worker struct {
	en     com
	err    error
	meters map[string]com
	policy *policyWay
	pobj   com
}

type winAudio struct {
	mu       sync.Mutex
	reqs     chan func(*worker)
	respawns int

	testing int32

	micMu      sync.Mutex
	micID      string
	micSeen    time.Time
	micLevel   float64
	micRunning bool
	micFailAt  time.Time

	nameMu sync.Mutex
	names  map[uint32]string
	pid    uint32
}

func newWinAudio() *winAudio {
	w := &winAudio{names: map[uint32]string{}, pid: windows.GetCurrentProcessId()}
	w.startWorker()
	return w
}

func (w *winAudio) startWorker() {
	ch := make(chan func(*worker), 8)
	w.reqs = ch
	go func() {
		runtime.LockOSThread()
		windows.CoInitializeEx(0, windows.COINIT_MULTITHREADED)
		k := &worker{meters: map[string]com{}}
		k.en, k.err = coCreate(clsidEnum, iidEnum)
		for f := range ch {
			f(k)
		}
	}()
}

// run f on the worker; if Windows audio hangs, give up and start a fresh worker.
func (w *winAudio) run(timeout time.Duration, f func(*worker)) bool {
	w.mu.Lock()
	ch := w.reqs
	w.mu.Unlock()
	done := make(chan struct{})
	t := time.NewTimer(timeout)
	defer t.Stop()
	select {
	case ch <- func(k *worker) { f(k); close(done) }:
	case <-t.C:
		w.respawn(ch)
		return false
	}
	select {
	case <-done:
		return true
	case <-t.C:
		w.respawn(ch)
		return false
	}
}

func (w *winAudio) respawn(old chan func(*worker)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.reqs != old || w.respawns >= 20 {
		return
	}
	w.respawns++
	w.startWorker()
}

func (k *worker) devices() ([]Device, error) {
	if k.en == 0 {
		return nil, errors.New("can't reach Windows audio: " + fmt.Sprint(k.err))
	}
	defs := map[string]bool{}
	for flow := 0; flow < 2; flow++ {
		for _, role := range []int{0, 2} {
			var d com
			if !failed(k.en.call(4, uintptr(flow), uintptr(role), ptr(&d))) {
				defs[fmt.Sprint(flow, role, devID(d))] = true
				d.Release()
			}
		}
	}
	var col com
	if hr := k.en.call(3, 2, 0x1|0x2|0x8, ptr(&col)); failed(hr) {
		return nil, hrErr(hr)
	}
	defer col.Release()
	var n uint32
	col.call(3, ptr(&n))
	var out []Device
	for i := uint32(0); i < n; i++ {
		var d com
		if failed(col.call(4, uintptr(i), ptr(&d))) {
			continue
		}
		id := devID(d)
		var st uint32
		d.call(6, ptr(&st))
		var fl uint32
		if ep, err := d.QI(iidEndpoint); err == nil {
			ep.call(3, ptr(&fl))
			ep.Release()
		}
		dev := Device{ID: id, Out: fl == 0, State: stateName(st), Volume: -1}
		var ps com
		if !failed(d.call(4, 0, ptr(&ps))) {
			dev.Name = propStr(ps, &pkeyDevDesc)
			dev.Adapter = propStr(ps, &pkeyIfaceName)
			dev.Bus = propStr(ps, &pkeyEnumName)
			ps.Release()
		}
		if dev.Name == "" {
			dev.Name = "Sound device"
		}
		dev.DefMain = defs[fmt.Sprint(fl, 0, id)]
		dev.DefComm = defs[fmt.Sprint(fl, 2, id)]
		if st == 1 {
			if v, err := activate(d, iidVolume); err == nil {
				var f float32
				if !failed(v.call(9, ptr(&f))) {
					dev.Volume = float64(f)
				}
				var m int32
				v.call(15, ptr(&m))
				dev.Muted = m != 0
				v.Release()
			}
		}
		if (st == 1 || st == 8) && !strings.EqualFold(dev.Bus, "USB") {
			dev.Jacks = jacksOf(d)
		}
		d.Release()
		out = append(out, dev)
	}
	return out, nil
}

func (w *winAudio) Devices() ([]Device, error) {
	var out []Device
	var err error
	if !w.run(6*time.Second, func(k *worker) { out, err = k.devices() }) {
		return nil, errors.New("Windows audio didn't answer for 6 seconds")
	}
	return out, err
}

func (w *winAudio) Peak(id string) float64 {
	var v float64
	w.run(2*time.Second, func(k *worker) {
		m := k.meters[id]
		if m == 0 {
			if k.en == 0 {
				return
			}
			d, err := getDevice(k.en, id)
			if err != nil {
				return
			}
			m, err = activate(d, iidMeter)
			d.Release()
			if err != nil {
				return
			}
			k.meters[id] = m
		}
		var f float32
		if failed(m.call(3, ptr(&f))) {
			m.Release()
			delete(k.meters, id)
			return
		}
		v = float64(f)
	})
	return v
}

func (w *winAudio) dropMeters() {
	w.run(2*time.Second, func(k *worker) {
		for id, m := range k.meters {
			m.Release()
			delete(k.meters, id)
		}
	})
}

func (w *winAudio) Sessions(id string) []Session {
	var out []Session
	w.run(3*time.Second, func(k *worker) {
		if k.en == 0 {
			return
		}
		d, err := getDevice(k.en, id)
		if err != nil {
			return
		}
		defer d.Release()
		mgr, err := activate(d, iidSessMgr2)
		if err != nil {
			return
		}
		defer mgr.Release()
		var en com
		if failed(mgr.call(5, ptr(&en))) {
			return
		}
		defer en.Release()
		var n int32
		en.call(3, ptr(&n))
		for i := int32(0); i < n && i < 40; i++ {
			var c com
			if failed(en.call(4, uintptr(i), ptr(&c))) {
				continue
			}
			var st int32
			c.call(3, ptr(&st))
			s := Session{Active: st == 1}
			if c2, err := c.QI(iidSessCtl2); err == nil {
				c2.call(14, ptr(&s.PID))
				s.System = c2.call(15) == 0
				c2.Release()
			}
			if m, err := c.QI(iidMeter); err == nil {
				var f float32
				m.call(3, ptr(&f))
				s.Peak = float64(f)
				m.Release()
			}
			c.Release()
			if st == 2 {
				continue
			}
			if s.System {
				s.Name = "Windows sounds"
			} else {
				s.Name = w.procName(s.PID)
			}
			out = append(out, s)
		}
	})
	return out
}

func (w *winAudio) procName(pid uint32) string {
	w.nameMu.Lock()
	defer w.nameMu.Unlock()
	if n, ok := w.names[pid]; ok {
		return n
	}
	name := "App"
	if h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid); err == nil {
		buf := make([]uint16, 1024)
		n := uint32(len(buf))
		if windows.QueryFullProcessImageName(h, 0, &buf[0], &n) == nil {
			path := windows.UTF16ToString(buf[:n])
			name = strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
			if d := fileDesc(path); d != "" && len(d) < 40 {
				name = d
			}
		}
		windows.CloseHandle(h)
	}
	if len(w.names) > 300 {
		w.names = map[uint32]string{}
	}
	w.names[pid] = name
	return name
}

func fileDesc(path string) string {
	size, err := windows.GetFileVersionInfoSize(path, nil)
	if err != nil || size == 0 {
		return ""
	}
	buf := make([]byte, size)
	if windows.GetFileVersionInfo(path, 0, size, unsafe.Pointer(&buf[0])) != nil {
		return ""
	}
	var p unsafe.Pointer
	var l uint32
	if windows.VerQueryValue(unsafe.Pointer(&buf[0]), `\VarFileInfo\Translation`, unsafe.Pointer(&p), &l) != nil || l < 4 {
		return ""
	}
	tr := (*[2]uint16)(p)
	sub := fmt.Sprintf(`\StringFileInfo\%04x%04x\FileDescription`, tr[0], tr[1])
	if windows.VerQueryValue(unsafe.Pointer(&buf[0]), sub, unsafe.Pointer(&p), &l) != nil || l == 0 {
		return ""
	}
	return strings.TrimSpace(windows.UTF16PtrToString((*uint16)(p)))
}

func (w *winAudio) SetVolume(id string, v float64) error {
	var err error
	if !w.run(4*time.Second, func(k *worker) {
		if k.en == 0 {
			err = errors.New("no Windows audio")
			return
		}
		d, e := getDevice(k.en, id)
		if e != nil {
			err = e
			return
		}
		defer d.Release()
		vol, e := activate(d, iidVolume)
		if e != nil {
			err = e
			return
		}
		defer vol.Release()
		if hr := vol.call(7, uintptr(math.Float32bits(float32(v))), 0); failed(hr) {
			err = hrErr(hr)
		}
	}) {
		return errors.New("Windows audio didn't answer")
	}
	return err
}

func (w *winAudio) SetMute(id string, m bool) error {
	var err error
	b := uintptr(0)
	if m {
		b = 1
	}
	if !w.run(4*time.Second, func(k *worker) {
		if k.en == 0 {
			err = errors.New("no Windows audio")
			return
		}
		d, e := getDevice(k.en, id)
		if e != nil {
			err = e
			return
		}
		defer d.Release()
		vol, e := activate(d, iidVolume)
		if e != nil {
			err = e
			return
		}
		defer vol.Release()
		if hr := vol.call(14, b, 0); failed(hr) {
			err = hrErr(hr)
		}
	}) {
		return errors.New("Windows audio didn't answer")
	}
	return err
}

// policy: find (once) a way to change defaults that works on this Windows.
func (k *worker) policyObj() (com, *policyWay, error) {
	if k.pobj != 0 {
		return k.pobj, k.policy, nil
	}
	var errs []string
	for i := range policyWays {
		pw := &policyWays[i]
		o, err := coCreate(pw.clsid, pw.iid)
		if err != nil {
			errs = append(errs, pw.name+": "+err.Error())
			continue
		}
		k.pobj, k.policy = o, pw
		return o, pw, nil
	}
	return 0, nil, errors.New("Windows won't let apps switch sound devices here (" + strings.Join(errs, "; ") + ")")
}

func (w *winAudio) SetDefault(id string) (string, error) {
	var err error
	how := ""
	if !w.run(5*time.Second, func(k *worker) {
		o, pw, e := k.policyObj()
		if e != nil {
			err = e
			return
		}
		p, _ := windows.UTF16PtrFromString(id)
		for role := 0; role < 3; role++ {
			if hr := o.call(pw.setDef, ptr(p), uintptr(role)); failed(hr) {
				err = hrErr(hr)
				return
			}
		}
		how = pw.name
	}) {
		return "", errors.New("Windows audio didn't answer")
	}
	return how, err
}

func (w *winAudio) Enable(id string) error {
	var err error
	if !w.run(5*time.Second, func(k *worker) {
		o, pw, e := k.policyObj()
		if e != nil {
			err = e
			return
		}
		p, _ := windows.UTF16PtrFromString(id)
		if hr := o.call(pw.setVis, ptr(p), 1); failed(hr) {
			err = hrErr(hr)
		}
	}) {
		return errors.New("Windows audio didn't answer")
	}
	return err
}

// ---------- sound streams (own threads) ----------

type mixFmt struct {
	ch, rate, bits, align int
	float                 bool
}

func parseFmt(p uintptr) mixFmt {
	b := unsafe.Slice((*byte)(unsafe.Pointer(p)), 40)
	tag := binary.LittleEndian.Uint16(b[0:])
	f := mixFmt{
		ch:    int(binary.LittleEndian.Uint16(b[2:])),
		rate:  int(binary.LittleEndian.Uint32(b[4:])),
		align: int(binary.LittleEndian.Uint16(b[12:])),
		bits:  int(binary.LittleEndian.Uint16(b[14:])),
		float: tag == 3,
	}
	if tag == 0xFFFE && binary.LittleEndian.Uint16(b[16:]) >= 22 {
		f.float = binary.LittleEndian.Uint32(b[24:]) == 3
	}
	return f
}

func putSample(buf []byte, off int, f mixFmt, v float64) {
	if v > 1 {
		v = 1
	} else if v < -1 {
		v = -1
	}
	switch {
	case f.float && f.bits == 32:
		binary.LittleEndian.PutUint32(buf[off:], math.Float32bits(float32(v)))
	case f.bits == 16:
		binary.LittleEndian.PutUint16(buf[off:], uint16(int16(v*32767)))
	case f.bits == 24:
		x := int32(v * 8388607)
		buf[off], buf[off+1], buf[off+2] = byte(x), byte(x>>8), byte(x>>16)
	case f.bits == 32:
		binary.LittleEndian.PutUint32(buf[off:], uint32(int32(v*2147483647)))
	}
}

func getSample(buf []byte, off int, f mixFmt) float64 {
	switch {
	case f.float && f.bits == 32:
		return float64(math.Float32frombits(binary.LittleEndian.Uint32(buf[off:])))
	case f.bits == 16:
		return float64(int16(binary.LittleEndian.Uint16(buf[off:]))) / 32768
	case f.bits == 24:
		x := int32(uint32(buf[off])<<8|uint32(buf[off+1])<<16|uint32(buf[off+2])<<24) >> 8
		return float64(x) / 8388608
	case f.bits == 32:
		return float64(int32(binary.LittleEndian.Uint32(buf[off:]))) / 2147483648
	}
	return 0
}

type stream struct {
	en, dev, ac, svc com
	fmtPtr           uintptr
	f                mixFmt
	frames           uint32
}

func (s *stream) close() {
	if s.ac != 0 {
		s.ac.call(11)
	}
	s.svc.Release()
	s.ac.Release()
	s.dev.Release()
	s.en.Release()
	if s.fmtPtr != 0 {
		procCoTaskMemFree.Call(s.fmtPtr)
	}
}

// openStream: shared-mode stream on one device (call on a thread with COM started).
func openStream(id string, capture bool, bufHns int64) (*stream, error) {
	s := &stream{}
	var err error
	if s.en, err = coCreate(clsidEnum, iidEnum); err != nil {
		return s, err
	}
	if s.dev, err = getDevice(s.en, id); err != nil {
		return s, err
	}
	if s.ac, err = activate(s.dev, iidClient); err != nil {
		return s, err
	}
	if hr := s.ac.call(8, ptr(&s.fmtPtr)); failed(hr) {
		return s, hrErr(hr)
	}
	s.f = parseFmt(s.fmtPtr)
	if hr := s.ac.call(3, 0, 0, uintptr(bufHns), 0, s.fmtPtr, 0); failed(hr) {
		return s, hrErr(hr)
	}
	s.ac.call(4, ptr(&s.frames))
	iid := iidRender
	if capture {
		iid = iidCapture
	}
	if hr := s.ac.call(14, ptr(iid), ptr(&s.svc)); failed(hr) {
		return s, hrErr(hr)
	}
	return s, nil
}

func comThread[T any](timeout time.Duration, f func() T) (T, bool) {
	ch := make(chan T, 1)
	go func() {
		runtime.LockOSThread()
		windows.CoInitializeEx(0, windows.COINIT_MULTITHREADED)
		ch <- f()
	}()
	select {
	case v := <-ch:
		return v, true
	case <-time.After(timeout):
		var z T
		return z, false
	}
}

// EngineTest: open a silent stream and check Windows really pulls sound out of it.
// No sound is played. If the driver is stuck, the data never moves.
func (w *winAudio) EngineTest(id string) TestResult {
	if !atomic.CompareAndSwapInt32(&w.testing, 0, 1) {
		return TestResult{Hung: true, Detail: "the last check is still stuck inside Windows audio"}
	}
	r, ok := comThread(8*time.Second, func() TestResult {
		defer atomic.StoreInt32(&w.testing, 0)
		s, err := openStream(id, false, 2_000_000)
		defer s.close()
		if err != nil {
			if he, ok := err.(hrError); ok && (uint32(he) == 0x8889000A || uint32(he) == 0x88890004) {
				return TestResult{Busy: true, Detail: err.Error()}
			}
			return TestResult{Detail: "couldn't open a sound stream: " + err.Error()}
		}
		var p uintptr
		if hr := s.svc.call(3, uintptr(s.frames), ptr(&p)); failed(hr) {
			return TestResult{Detail: "no sound buffer: " + hrErr(hr).Error()}
		}
		s.svc.call(4, uintptr(s.frames), 2) // AUDCLNT_BUFFERFLAGS_SILENT
		if hr := s.ac.call(10); failed(hr) {
			return TestResult{Detail: "stream wouldn't start: " + hrErr(hr).Error()}
		}
		var pad uint32
		for i := 0; i < 10; i++ {
			time.Sleep(150 * time.Millisecond)
			s.ac.call(6, ptr(&pad))
			if pad < s.frames {
				return TestResult{OK: true, Detail: fmt.Sprintf("sound moves (%d of %d frames played)", s.frames-pad, s.frames)}
			}
		}
		return TestResult{Detail: fmt.Sprintf("Windows didn't take any sound in 1.5 s (%d frames stuck)", pad)}
	})
	if !ok {
		return TestResult{Hung: true, Detail: "Windows audio froze during the check"}
	}
	return r
}

// PlayTest: a short chime in one ear. Returns how loud Windows says the headphones got.
func (w *winAudio) PlayTest(id, side string) (float64, error) {
	type res struct {
		peak float64
		err  error
	}
	r, ok := comThread(10*time.Second, func() res {
		s, err := openStream(id, false, 2_000_000)
		defer s.close()
		if err != nil {
			return res{0, err}
		}
		var meter com
		if s.dev != 0 {
			meter, _ = activate(s.dev, iidMeter)
			defer meter.Release()
		}
		f := s.f
		rate := float64(f.rate)
		total := int(rate * 1.1)
		chans := []int{0}
		if f.ch >= 2 {
			if side == "right" {
				chans = []int{1}
			} else if side == "both" {
				chans = []int{0, 1}
			}
		}
		pos := 0
		peak := 0.0
		started := false
		bytesPer := f.bits / 8
		for pos < total+int(rate*0.25) {
			var pad uint32
			s.ac.call(6, ptr(&pad))
			avail := int(s.frames - pad)
			if avail > 0 {
				var p uintptr
				if hr := s.svc.call(3, uintptr(avail), ptr(&p)); failed(hr) {
					return res{peak, hrErr(hr)}
				}
				buf := unsafe.Slice((*byte)(unsafe.Pointer(p)), avail*f.align)
				for i := range buf {
					buf[i] = 0
				}
				for fr := 0; fr < avail; fr++ {
					v := chime(float64(pos+fr) / rate)
					if v != 0 {
						for _, c := range chans {
							putSample(buf, fr*f.align+c*bytesPer, f, v)
						}
					}
				}
				s.svc.call(4, uintptr(avail), 0)
				pos += avail
			}
			if !started {
				if hr := s.ac.call(10); failed(hr) {
					return res{0, hrErr(hr)}
				}
				started = true
			}
			time.Sleep(20 * time.Millisecond)
			if meter != 0 {
				var pk float32
				meter.call(3, ptr(&pk))
				if float64(pk) > peak {
					peak = float64(pk)
				}
			}
		}
		return res{peak, nil}
	})
	if !ok {
		return 0, errors.New("Windows audio froze while playing")
	}
	return r.peak, r.err
}

// chime: two soft bell notes (like a doorbell "ding-dong" going up).
func chime(t float64) float64 {
	note := func(t0, freq float64) float64 {
		x := t - t0
		if x < 0 || x > 0.9 {
			return 0
		}
		env := math.Min(1, x/0.006) * math.Exp(-x/0.22)
		return env * (math.Sin(2*math.Pi*freq*x) + 0.35*math.Sin(2*math.Pi*freq*2.01*x) + 0.12*math.Sin(2*math.Pi*freq*3.03*x))
	}
	if t > 1.1 {
		return 0
	}
	return 0.22 * (note(0, 659.25) + note(0.2, 987.77))
}

// ---------- mic listener (only while the SoundGuard window is open) ----------

func (w *winAudio) MicListen(id string) {
	w.micMu.Lock()
	defer w.micMu.Unlock()
	w.micSeen = time.Now()
	if w.micRunning {
		w.micID = id
		return
	}
	if time.Since(w.micFailAt) < 3*time.Second {
		return
	}
	w.micRunning, w.micID = true, id
	go w.micLoop(id)
}

func (w *winAudio) MicLevel() float64 {
	w.micMu.Lock()
	defer w.micMu.Unlock()
	return w.micLevel
}

func (w *winAudio) micLoop(id string) {
	runtime.LockOSThread()
	windows.CoInitializeEx(0, windows.COINIT_MULTITHREADED)
	defer func() {
		w.micMu.Lock()
		w.micRunning = false
		w.micLevel = 0
		w.micMu.Unlock()
	}()
	s, err := openStream(id, true, 1_000_000)
	defer s.close()
	if err == nil {
		if hr := s.ac.call(10); failed(hr) {
			err = hrErr(hr)
		}
	}
	if err != nil {
		w.micMu.Lock()
		w.micFailAt = time.Now()
		w.micMu.Unlock()
		return
	}
	f := s.f
	bytesPer := f.bits / 8
	for {
		time.Sleep(30 * time.Millisecond)
		w.micMu.Lock()
		stop := w.micID != id || time.Since(w.micSeen) > 3*time.Second
		w.micMu.Unlock()
		if stop {
			return
		}
		peak := 0.0
		for {
			var next uint32
			if failed(s.svc.call(5, ptr(&next))) || next == 0 {
				break
			}
			var p uintptr
			var frames, flags uint32
			if hr := s.svc.call(3, ptr(&p), ptr(&frames), ptr(&flags), 0, 0); failed(hr) {
				return
			}
			if flags&2 == 0 && p != 0 && frames > 0 && bytesPer > 0 {
				buf := unsafe.Slice((*byte)(unsafe.Pointer(p)), int(frames)*f.align)
				for fr := 0; fr < int(frames); fr++ {
					for c := 0; c < f.ch; c++ {
						v := math.Abs(getSample(buf, fr*f.align+c*bytesPer, f))
						if v > peak {
							peak = v
						}
					}
				}
			}
			s.svc.call(4, uintptr(frames))
		}
		w.micMu.Lock()
		w.micLevel = math.Max(w.micLevel*0.82, peak)
		w.micMu.Unlock()
	}
}
