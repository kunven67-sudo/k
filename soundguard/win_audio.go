//go:build windows

package main

// win_audio.go = reading + changing Windows sound devices (Core Audio: MMDevice API).

import (
	"errors"
	"math"
	"os"
	"strings"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	clsidMMDeviceEnumerator  = mustGUID("{BCDE0395-E52F-467C-8E3D-C4579291692E}")
	iidIMMDeviceEnumerator   = mustGUID("{A95664D2-9614-4F35-A746-DE8DB63617E6}")
	iidIAudioEndpointVolume  = mustGUID("{5CDF2C82-841E-4546-9722-0CF74078229A}")
	iidIAudioMeterInfo       = mustGUID("{C02216F6-8C67-4B5B-9D00-D008E73E0064}")
	iidIAudioClient          = mustGUID("{1CB9AD4C-DBFA-4C32-B178-C2F568A703B2}")
	iidIAudioRenderClient    = mustGUID("{F294ACFC-3146-4483-A7BF-ADDCA7C260E2}")
	iidIAudioCaptureClient   = mustGUID("{C8ADBD64-E71E-48A0-A4DE-185C395CD317}")
	iidIAudioClock           = mustGUID("{CD63314F-3FBA-4A1B-812C-EF96358728E7}")
	iidIAudioSessionManager2 = mustGUID("{77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F}")
	iidIAudioSessionControl2 = mustGUID("{BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D}")
	iidIDeviceTopology       = mustGUID("{2A07407E-6497-4A18-9787-32F79BD0D98F}")
	iidIPart                 = mustGUID("{AE2DE0E4-5BCA-4F2D-AA46-5D13F8FDB3A9}")
	iidIKsJackDescription    = mustGUID("{4509F757-2D46-4637-8E62-CE7DB944F57B}")

	// IPolicyConfig: the (undocumented, but used by every sound switcher) way to set the default device.
	clsidPolicyConfig      = mustGUID("{870AF99C-171D-4F9E-AF0D-E63DF40C2BC9}")
	clsidPolicyConfigVista = mustGUID("{294935CE-F637-4E7C-A41B-AB255460B862}")
	iidPolicyConfigs       = []windows.GUID{
		mustGUID("{F8679F50-850A-41CF-9C72-430F290290C8}"), // IPolicyConfig (Win 7+)
		mustGUID("{CA286FC3-91FD-42C3-8E9B-CAAFA66242E3}"), // IPolicyConfig (Win 10 name)
		mustGUID("{568B9108-44BF-40B4-9006-86AFE5B5A620}"), // IPolicyConfigVista
	}

	pkeyDeviceDesc        = propKey{mustGUID("{A45C254E-DF1C-4EFD-8020-67D146A850E0}"), 2}
	pkeyFriendlyName      = propKey{mustGUID("{A45C254E-DF1C-4EFD-8020-67D146A850E0}"), 14}
	pkeyInterfaceFriendly = propKey{mustGUID("{026E516E-B814-414B-83CD-856D6FEF4822}"), 2}
	pkeyFormFactor        = propKey{mustGUID("{1DA5D803-D492-4EDD-8C23-E0C0FFEE7F0E}"), 0}
	sgEventContext        = mustGUID("{5E0D6A8B-9C1F-4E2B-8A7D-50A11D6A2B01}") // marks volume changes made by SOUNDGUARD
)

const (
	eRender   = 0
	eCapture  = 1
	eAll      = 2
	stActive  = 0x1
	stDisable = 0x2
	stUnplug  = 0x8
)

// static info about a device that doesn't change while it exists
type devStatic struct {
	name, adapter, bus string
	form               int
	realtek            bool
	topo               bool // has a jack topology
	at                 time.Time
}

type jackInfo struct {
	known, in, front bool
	at               time.Time
}

// audio = per-thread view of Windows sound. Not thread safe: one worker owns it.
type audio struct {
	en       com
	static   map[string]*devStatic
	jacks    map[string]jackInfo
	pc       com // IPolicyConfig (0 = not available)
	pcIdx    int // which IID it answered to (0/1 = Win 7+ layout, 2 = Vista layout)
	pcTried  time.Time
	pcErr    string
	meterID  string
	meter    com
	pid      uint32
	lastPlay time.Time
}

func newAudio() *audio {
	return &audio{static: map[string]*devStatic{}, jacks: map[string]jackInfo{}, pid: uint32(os.Getpid())}
}

func (a *audio) reset() {
	if a.meter != 0 {
		a.meter.Release()
		a.meter, a.meterID = 0, ""
	}
	if a.en != 0 {
		a.en.Release()
		a.en = 0
	}
	if a.pc != 0 {
		a.pc.Release()
		a.pc = 0
		a.pcTried = time.Time{}
	}
	a.jacks = map[string]jackInfo{}
}

func (a *audio) enum() (com, error) {
	if a.en != 0 {
		return a.en, nil
	}
	en, err := coCreate(&clsidMMDeviceEnumerator, &iidIMMDeviceEnumerator, clsctxAll)
	if err != nil {
		return 0, err
	}
	a.en = en
	return en, nil
}

// device opens an endpoint by id (caller releases).
func (a *audio) device(id string) (com, error) {
	en, err := a.enum()
	if err != nil {
		return 0, err
	}
	p, _ := windows.UTF16PtrFromString(id)
	var d uintptr
	if err := hrErr(en.call(5, uintptr(unsafe.Pointer(p)), uintptr(unsafe.Pointer(&d)))); err != nil {
		return 0, err
	}
	return com(d), nil
}

func activate(dev com, iid *windows.GUID) (com, error) {
	var out uintptr
	if err := hrErr(dev.call(3, uintptr(unsafe.Pointer(iid)), clsctxAll, 0, uintptr(unsafe.Pointer(&out)))); err != nil {
		return 0, err
	}
	return com(out), nil
}

func devID(dev com) string {
	var p uintptr
	if hrErr(dev.call(5, uintptr(unsafe.Pointer(&p)))) != nil {
		return ""
	}
	return coString(p)
}

func devState(dev com) uint32 {
	var s uint32
	dev.call(6, uintptr(unsafe.Pointer(&s)))
	return s
}

func (a *audio) defaultID(flow, role int) string {
	en, err := a.enum()
	if err != nil {
		return ""
	}
	var d uintptr
	if hrErr(en.call(4, uintptr(flow), uintptr(role), uintptr(unsafe.Pointer(&d)))) != nil || d == 0 {
		return "" // E_NOTFOUND = no device of that kind
	}
	dev := com(d)
	defer dev.Release()
	return devID(dev)
}

func (a *audio) readStatic(dev com, id string) *devStatic {
	if s, ok := a.static[id]; ok && time.Since(s.at) < 10*time.Minute {
		return s
	}
	s := &devStatic{at: time.Now(), form: 10}
	var ps uintptr
	if hrErr(dev.call(4, 0 /*STGM_READ*/, uintptr(unsafe.Pointer(&ps)))) == nil && ps != 0 {
		store := com(ps)
		get := func(k *propKey) propVariant {
			var v propVariant
			store.call(5, uintptr(unsafe.Pointer(k)), uintptr(unsafe.Pointer(&v)))
			return v
		}
		v := get(&pkeyDeviceDesc)
		s.name = v.str()
		v.clear()
		v = get(&pkeyInterfaceFriendly)
		s.adapter = v.str()
		v.clear()
		if s.name == "" {
			v = get(&pkeyFriendlyName)
			s.name = v.str()
			v.clear()
		}
		v = get(&pkeyFormFactor)
		if u, ok := v.u32(); ok {
			s.form = int(u)
		}
		v.clear()
		store.Release()
	}
	// which bus (HD Audio / USB / Bluetooth / HDMI) = the device the endpoint's connector plugs into
	hw := ""
	if topo, err := activate(dev, &iidIDeviceTopology); err == nil {
		var conn uintptr
		if hrErr(topo.call(4, 0, uintptr(unsafe.Pointer(&conn)))) == nil && conn != 0 {
			c := com(conn)
			var p uintptr
			if hrErr(c.call(10, uintptr(unsafe.Pointer(&p)))) == nil {
				hw = strings.ToLower(coString(p))
			}
			c.Release()
			s.topo = true
		}
		topo.Release()
	}
	low := strings.ToLower(s.adapter + " " + s.name)
	switch {
	case strings.Contains(hw, "usb#") || strings.Contains(hw, `usb\`) || strings.Contains(hw, "usbaudio"):
		s.bus = "usb"
	case strings.Contains(hw, "bth") || strings.Contains(low, "bluetooth") || strings.Contains(low, "hands-free"):
		s.bus = "bt"
	case s.form == 9 || strings.Contains(low, "hdmi") || strings.Contains(low, "displayport") ||
		strings.Contains(hw, "ven_10de") || strings.Contains(hw, "ven_1002") && strings.Contains(hw, "hdaudio") || strings.Contains(low, "nvidia high definition"):
		s.bus = "hdmi"
	case strings.Contains(hw, "hdaudio") || strings.Contains(hw, "intelaudio") || strings.Contains(low, "realtek") || strings.Contains(low, "high definition audio"):
		s.bus = "hda"
	case strings.Contains(hw, "swd#") || strings.Contains(hw, "root#") || strings.Contains(low, "virtual") || strings.Contains(low, "cable"):
		s.bus = "virtual"
	default:
		s.bus = "other"
	}
	s.realtek = strings.Contains(hw, "ven_10ec") || strings.Contains(low, "realtek")
	a.static[id] = s
	return s
}

// KSJACK_DESCRIPTION
type ksJack struct {
	ChannelMapping uint32
	Color          uint32
	ConnectionType int32
	GeoLocation    int32
	GenLocation    int32
	PortConnection int32
	IsConnected    int32
}

// readJacks asks the driver which jacks of this endpoint have a plug in them.
func readJacks(dev com) jackInfo {
	ji := jackInfo{at: time.Now()}
	topo, err := activate(dev, &iidIDeviceTopology)
	if err != nil {
		return ji
	}
	defer topo.Release()
	var conn uintptr
	if hrErr(topo.call(4, 0, uintptr(unsafe.Pointer(&conn)))) != nil || conn == 0 {
		return ji
	}
	c := com(conn)
	defer c.Release()
	var to uintptr
	if hrErr(c.call(8, uintptr(unsafe.Pointer(&to)))) != nil || to == 0 {
		return ji
	}
	toc := com(to)
	defer toc.Release()
	part, err := toc.QI(&iidIPart)
	if err != nil {
		return ji
	}
	defer part.Release()
	var jd uintptr
	if hrErr(part.call(13, clsctxInprocServer, uintptr(unsafe.Pointer(&iidIKsJackDescription)), uintptr(unsafe.Pointer(&jd)))) != nil || jd == 0 {
		return ji
	}
	j := com(jd)
	defer j.Release()
	var n uint32
	if hrErr(j.call(3, uintptr(unsafe.Pointer(&n)))) != nil || n == 0 || n > 16 {
		return ji
	}
	for i := uint32(0); i < n; i++ {
		var d ksJack
		if hrErr(j.call(4, uintptr(i), uintptr(unsafe.Pointer(&d)))) != nil {
			continue
		}
		ji.known = true
		if d.PortConnection == 1 { // built-in speaker/mic, always "connected"
			continue
		}
		if d.IsConnected != 0 {
			ji.in = true
			if d.GeoLocation == 2 { // front panel
				ji.front = true
			}
		}
	}
	return ji
}

func readVolume(dev com) (vol float64, muted bool, err error) {
	ev, err := activate(dev, &iidIAudioEndpointVolume)
	if err != nil {
		return 0, false, err
	}
	defer ev.Release()
	var f float32
	if err := hrErr(ev.call(9, uintptr(unsafe.Pointer(&f)))); err != nil {
		return 0, false, err
	}
	var m int32
	ev.call(15, uintptr(unsafe.Pointer(&m)))
	return float64(f), m != 0, nil
}

func (a *audio) setMute(id string, mute bool) error {
	dev, err := a.device(id)
	if err != nil {
		return err
	}
	defer dev.Release()
	ev, err := activate(dev, &iidIAudioEndpointVolume)
	if err != nil {
		return err
	}
	defer ev.Release()
	b := uintptr(0)
	if mute {
		b = 1
	}
	return hrErr(ev.call(14, b, uintptr(unsafe.Pointer(&sgEventContext))))
}

func (a *audio) setVolume(id string, v float64) error {
	dev, err := a.device(id)
	if err != nil {
		return err
	}
	defer dev.Release()
	ev, err := activate(dev, &iidIAudioEndpointVolume)
	if err != nil {
		return err
	}
	defer ev.Release()
	v = math.Max(0, math.Min(1, v))
	return hrErr(ev.call(7, uintptr(math.Float32bits(float32(v))), uintptr(unsafe.Pointer(&sgEventContext))))
}

// peak = how loud Windows is sending sound to the device right now.
func (a *audio) peak(id string) float64 {
	if id == "" {
		return 0
	}
	if a.meterID != id || a.meter == 0 {
		if a.meter != 0 {
			a.meter.Release()
			a.meter, a.meterID = 0, ""
		}
		dev, err := a.device(id)
		if err != nil {
			return 0
		}
		m, err := activate(dev, &iidIAudioMeterInfo)
		dev.Release()
		if err != nil {
			return 0
		}
		a.meter, a.meterID = m, id
	}
	var f float32
	if hrErr(a.meter.call(3, uintptr(unsafe.Pointer(&f)))) != nil {
		a.meter.Release()
		a.meter, a.meterID = 0, ""
		return 0
	}
	return float64(f)
}

// othersPlaying = another app has a running (Active) stream on this device.
func (a *audio) othersPlaying(id string) bool {
	p, _ := a.othersSound(id)
	return p
}

// othersSound: playing = some other app has a running sound stream on the device;
// loud = one of those streams carries REAL sound right now (its own meter is above 0).
// loud + device meter 0 = the sound gets eaten after the apps (a sound effect / stuck driver).
func (a *audio) othersSound(id string) (playing, loud bool) {
	dev, err := a.device(id)
	if err != nil {
		return false, false
	}
	defer dev.Release()
	sm, err := activate(dev, &iidIAudioSessionManager2)
	if err != nil {
		return false, false
	}
	defer sm.Release()
	var e uintptr
	if hrErr(sm.call(5, uintptr(unsafe.Pointer(&e)))) != nil || e == 0 {
		return false, false
	}
	en := com(e)
	defer en.Release()
	var n int32
	en.call(3, uintptr(unsafe.Pointer(&n)))
	for i := int32(0); i < n && i < 128; i++ {
		var sc uintptr
		if hrErr(en.call(4, uintptr(i), uintptr(unsafe.Pointer(&sc)))) != nil || sc == 0 {
			continue
		}
		ctl := com(sc)
		var st int32
		ctl.call(3, uintptr(unsafe.Pointer(&st)))
		mine := false
		if st == 1 { // AudioSessionStateActive
			if c2, err := ctl.QI(&iidIAudioSessionControl2); err == nil {
				var pid uint32
				c2.call(14, uintptr(unsafe.Pointer(&pid)))
				mine = pid == a.pid
				c2.Release()
			}
		}
		if st == 1 && !mine && time.Since(a.lastPlay) > 3*time.Second {
			playing = true
			if m, err := ctl.QI(&iidIAudioMeterInfo); err == nil {
				var f float32
				if hrErr(m.call(3, uintptr(unsafe.Pointer(&f)))) == nil && f > 0.002 {
					loud = true
				}
				m.Release()
			}
		}
		ctl.Release()
		if loud {
			return true, true
		}
	}
	return playing, false
}

// policy = IPolicyConfig, the only way to switch the default device.
func (a *audio) policy() (com, error) {
	if a.pc != 0 {
		return a.pc, nil
	}
	if !a.pcTried.IsZero() && time.Since(a.pcTried) < time.Minute {
		return 0, errors.New(a.pcErr)
	}
	a.pcTried = time.Now()
	var last error
	for _, cl := range []*windows.GUID{&clsidPolicyConfig, &clsidPolicyConfigVista} {
		for i := range iidPolicyConfigs {
			pc, err := coCreate(cl, &iidPolicyConfigs[i], clsctxAll)
			if err == nil {
				a.pc, a.pcIdx = pc, i
				logf("IPolicyConfig ok: clsid %v iid %v", *cl, iidPolicyConfigs[i])
				return pc, nil
			}
			last = err
		}
	}
	a.pcErr = "Windows won't let apps switch the default device here (" + last.Error() + ")"
	logf("%s", a.pcErr)
	return 0, errors.New(a.pcErr)
}

func (a *audio) setDefault(id string) error {
	pc, err := a.policy()
	if err != nil {
		return err
	}
	p, _ := windows.UTF16PtrFromString(id)
	for role := 0; role < 3; role++ {
		if err := hrErr(pc.call(13, uintptr(unsafe.Pointer(p)), uintptr(role))); err != nil {
			return err
		}
	}
	// check it really happened
	flow := eRender
	if dev, err := a.device(id); err == nil {
		if ep, err := dev.QI(&iidIMMEndpoint); err == nil {
			var f int32
			ep.call(3, uintptr(unsafe.Pointer(&f)))
			flow = int(f)
			ep.Release()
		}
		dev.Release()
	}
	if got := a.defaultID(flow, 0); got != id {
		return errors.New("Windows didn't switch the device")
	}
	return nil
}

var iidIMMEndpoint = mustGUID("{1BE09788-6894-4089-8586-9A2A6C265AC5}")

// snapshot = everything Guardian.Tick needs.
func (a *audio) snapshot() (Snap, error) {
	var s Snap
	en, err := a.enum()
	if err != nil {
		return s, err
	}
	var col uintptr
	if err := hrErr(en.call(3, eAll, stActive|stDisable|stUnplug, uintptr(unsafe.Pointer(&col)))); err != nil {
		a.reset()
		return s, err
	}
	coll := com(col)
	defer coll.Release()
	var n uint32
	coll.call(3, uintptr(unsafe.Pointer(&n)))
	seen := map[string]bool{}
	for i := uint32(0); i < n && i < 64; i++ {
		var d uintptr
		if hrErr(coll.call(4, uintptr(i), uintptr(unsafe.Pointer(&d)))) != nil || d == 0 {
			continue
		}
		dev := com(d)
		id := devID(dev)
		if id == "" {
			dev.Release()
			continue
		}
		seen[id] = true
		st := devState(dev)
		flow := "out"
		if ep, err := dev.QI(&iidIMMEndpoint); err == nil {
			var f int32
			ep.call(3, uintptr(unsafe.Pointer(&f)))
			if f == eCapture {
				flow = "in"
			}
			ep.Release()
		}
		info := a.readStatic(dev, id)
		dv := Dev{ID: id, Flow: flow, Name: info.name, Adapter: info.adapter, Form: info.form, Bus: info.bus, Realtek: info.realtek}
		switch {
		case st&stActive != 0:
			dv.State = "active"
		case st&stUnplug != 0:
			dv.State = "unplugged"
		default:
			dv.State = "disabled"
		}
		if dv.State == "active" {
			if v, m, err := readVolume(dev); err == nil {
				dv.Volume, dv.Muted = v, m
			}
			if info.topo && flow == "out" && info.bus != "hdmi" {
				ji, ok := a.jacks[id]
				if !ok || time.Since(ji.at) > 2*time.Second {
					ji = readJacks(dev)
					a.jacks[id] = ji
				}
				dv.JackKnown, dv.JackIn, dv.Front = ji.known, ji.in, ji.front
			}
		}
		dev.Release()
		s.Devs = append(s.Devs, dv)
	}
	for id := range a.static {
		if !seen[id] {
			delete(a.static, id)
			delete(a.jacks, id)
		}
	}
	s.DefOut = a.defaultID(eRender, 0)
	s.DefOutComm = a.defaultID(eRender, 2)
	s.DefIn = a.defaultID(eCapture, 0)
	s.DefInComm = a.defaultID(eCapture, 2)
	s.OutPeak = a.peak(s.DefOut)
	if s.OutPeak <= 0.00001 && s.DefOut != "" {
		s.OthersPlaying, s.OthersLoud = a.othersSound(s.DefOut)
	}
	return s, nil
}

// noEffects: turn off "Audio enhancements" for a device (= Windows' own switch,
// PKEY_AudioEndpoint_Disable_SysFx in the effects store). Dell's Waves effect sits there
// and can turn ALL sound into silence while everything else looks fine.
func (a *audio) noEffects(id string) error {
	pc, err := a.policy()
	if err != nil {
		return err
	}
	slot := 12 // SetPropertyValue (Win 7+ layout)
	if a.pcIdx == 2 {
		slot = 11 // Vista layout
	}
	type propKey struct {
		fmtid windows.GUID
		pid   uint32
	}
	type propVar struct {
		vt         uint16
		r1, r2, r3 uint16
		val        uint32
		_          [12]byte
	}
	key := propKey{mustGUID("{1DA5D803-D492-4EDD-8C23-E0C0FFEE7F0E}"), 5}
	v := propVar{vt: 19, val: 1} // VT_UI4 = 1 -> effects OFF
	p, _ := windows.UTF16PtrFromString(id)
	return hrErr(pc.call(slot, uintptr(unsafe.Pointer(p)), 1, uintptr(unsafe.Pointer(&key)), uintptr(unsafe.Pointer(&v))))
}
