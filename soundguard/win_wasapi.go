//go:build windows

package main

// win_wasapi.go = playing + recording sound (WASAPI shared mode, like any normal app).
// probe() plays SILENCE for a moment and watches the device clock: if the clock
// doesn't move, the driver froze. Nobody hears anything.

import (
	"encoding/binary"
	"errors"
	"math"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	subtypeFloat = mustGUID("{00000003-0000-0010-8000-00AA00389B71}")
	subtypePCM   = mustGUID("{00000001-0000-0010-8000-00AA00389B71}")
)

type mixFmt struct {
	rate     int
	ch       int
	bits     int // container bits per sample
	isFloat  bool
	block    int
	raw      uintptr // CoTaskMem WAVEFORMATEX* (pass to Initialize)
}

func readMixFormat(ac com) (*mixFmt, error) {
	var p uintptr
	if err := hrErr(ac.call(8, uintptr(unsafe.Pointer(&p)))); err != nil {
		return nil, err
	}
	b := unsafe.Slice((*byte)(unsafe.Pointer(p)), 18)
	f := &mixFmt{raw: p}
	tag := binary.LittleEndian.Uint16(b[0:])
	f.ch = int(binary.LittleEndian.Uint16(b[2:]))
	f.rate = int(binary.LittleEndian.Uint32(b[4:]))
	f.block = int(binary.LittleEndian.Uint16(b[12:]))
	f.bits = int(binary.LittleEndian.Uint16(b[14:]))
	cb := binary.LittleEndian.Uint16(b[16:])
	switch tag {
	case 3:
		f.isFloat = true
	case 1:
	case 0xFFFE:
		if cb >= 22 {
			ext := unsafe.Slice((*byte)(unsafe.Pointer(p)), 40)
			var g windows.GUID
			copy((*[16]byte)(unsafe.Pointer(&g))[:], ext[24:40])
			if g == subtypeFloat {
				f.isFloat = true
			} else if g != subtypePCM {
				procCoTaskMemFree.Call(p)
				return nil, errors.New("unusual sound format")
			}
		}
	default:
		procCoTaskMemFree.Call(p)
		return nil, errors.New("unusual sound format")
	}
	if f.ch < 1 || f.ch > 32 || f.rate < 8000 || f.block < 1 {
		procCoTaskMemFree.Call(p)
		return nil, errors.New("bad sound format")
	}
	return f, nil
}

func (f *mixFmt) free() {
	if f != nil && f.raw != 0 {
		procCoTaskMemFree.Call(f.raw)
		f.raw = 0
	}
}

// put writes one mono sample to all channels of frame i.
func (f *mixFmt) put(buf []byte, i int, v float32) {
	if v > 1 {
		v = 1
	} else if v < -1 {
		v = -1
	}
	bps := f.bits / 8
	o := i * f.block
	for c := 0; c < f.ch; c++ {
		p := o + c*bps
		switch {
		case f.isFloat && bps == 4:
			binary.LittleEndian.PutUint32(buf[p:], math.Float32bits(v))
		case bps == 2:
			binary.LittleEndian.PutUint16(buf[p:], uint16(int16(v*32767)))
		case bps == 3:
			x := int32(v * 8388607)
			buf[p], buf[p+1], buf[p+2] = byte(x), byte(x>>8), byte(x>>16)
		case bps == 4:
			binary.LittleEndian.PutUint32(buf[p:], uint32(int32(v*2147483647)))
		}
	}
}

// get reads frame i as mono (average of channels).
func (f *mixFmt) get(buf []byte, i int) float32 {
	bps := f.bits / 8
	o := i * f.block
	var s float32
	for c := 0; c < f.ch; c++ {
		p := o + c*bps
		switch {
		case f.isFloat && bps == 4:
			s += math.Float32frombits(binary.LittleEndian.Uint32(buf[p:]))
		case bps == 2:
			s += float32(int16(binary.LittleEndian.Uint16(buf[p:]))) / 32768
		case bps == 3:
			x := int32(uint32(buf[p])<<8|uint32(buf[p+1])<<16|uint32(buf[p+2])<<24) >> 8
			s += float32(x) / 8388608
		case bps == 4:
			s += float32(int32(binary.LittleEndian.Uint32(buf[p:]))) / 2147483648
		}
	}
	return s / float32(f.ch)
}

type stream struct {
	ac    com
	svc   com // render or capture client
	clock com
	f     *mixFmt
	frames uint32
}

func (s *stream) close() {
	if s == nil {
		return
	}
	if s.ac != 0 {
		s.ac.call(11) // Stop
	}
	if s.clock != 0 {
		s.clock.Release()
	}
	if s.svc != 0 {
		s.svc.Release()
	}
	if s.ac != 0 {
		s.ac.Release()
	}
	s.f.free()
}

// openStream sets up a shared-mode stream on the device (render = play, else record).
func openStream(a *audio, id string, render bool) (*stream, error) {
	dev, err := a.device(id)
	if err != nil {
		return nil, err
	}
	defer dev.Release()
	ac, err := activate(dev, &iidIAudioClient)
	if err != nil {
		return nil, err
	}
	s := &stream{ac: ac}
	if s.f, err = readMixFormat(ac); err != nil {
		ac.Release()
		return nil, err
	}
	// 200 ms buffer, shared mode, polling
	if err := hrErr(ac.call(3, 0, 0, 2000000, 0, s.f.raw, 0)); err != nil {
		s.close()
		return nil, err
	}
	ac.call(4, uintptr(unsafe.Pointer(&s.frames)))
	iid := &iidIAudioRenderClient
	if !render {
		iid = &iidIAudioCaptureClient
	}
	var svc uintptr
	if err := hrErr(ac.call(14, uintptr(unsafe.Pointer(iid)), uintptr(unsafe.Pointer(&svc)))); err != nil {
		s.close()
		return nil, err
	}
	s.svc = com(svc)
	var clk uintptr
	if hrErr(ac.call(14, uintptr(unsafe.Pointer(&iidIAudioClock)), uintptr(unsafe.Pointer(&clk)))) == nil {
		s.clock = com(clk)
	}
	if s.frames == 0 {
		s.close()
		return nil, errors.New("device gave no buffer")
	}
	return s, nil
}

func (s *stream) padding() (uint32, error) {
	var p uint32
	err := hrErr(s.ac.call(6, uintptr(unsafe.Pointer(&p))))
	return p, err
}

// write n frames from gen (nil = silence).
func (s *stream) write(n uint32, gen func(buf []byte, frames int)) error {
	if n == 0 {
		return nil
	}
	var p uintptr
	if err := hrErr(s.svc.call(3, uintptr(n), uintptr(unsafe.Pointer(&p)))); err != nil {
		return err
	}
	flags := uintptr(0)
	if gen == nil {
		flags = 2 // AUDCLNT_BUFFERFLAGS_SILENT
	} else {
		gen(unsafe.Slice((*byte)(unsafe.Pointer(p)), int(n)*s.f.block), int(n))
	}
	return hrErr(s.svc.call(4, uintptr(n), flags))
}

func (s *stream) position() uint64 {
	if s.clock == 0 {
		return 0
	}
	var pos, qpc uint64
	s.clock.call(4, uintptr(unsafe.Pointer(&pos)), uintptr(unsafe.Pointer(&qpc)))
	return pos
}

// probeRunning: only one probe at a time (a stuck one may hang forever).
var probeRunning int32

// probe: does the device take sound? Silent.
func probeDevice(id string) ProbeResult {
	if !atomic.CompareAndSwapInt32(&probeRunning, 0, 1) {
		return ProbeStuck // the last probe is still hanging = stuck
	}
	done := make(chan ProbeResult, 1)
	go func() {
		defer atomic.StoreInt32(&probeRunning, 0)
		defer func() {
			if r := recover(); r != nil {
				logf("PANIC probe: %v", r)
				done <- ProbeErr
			}
		}()
		withCOM(func() { done <- probeNow(id) })
	}()
	select {
	case r := <-done:
		return r
	case <-time.After(5 * time.Second):
		logf("probe: no answer in 5 s = stuck")
		return ProbeStuck
	}
}

func probeNow(id string) ProbeResult {
	a := newAudio()
	defer a.reset()
	s, err := openStream(a, id, true)
	if err != nil {
		logf("probe open: %v", err)
		switch {
		case isHR(err, 0x8889000A): // exclusive mode = a game owns it
			return ProbeBusy
		case isHR(err, 0x8889000F), isHR(err, 0x80004005):
			return ProbeStuck
		}
		return ProbeErr
	}
	defer s.close()
	s.write(s.frames, nil)
	if err := hrErr(s.ac.call(10)); err != nil { // Start
		logf("probe start: %v", err)
		if isHR(err, 0x8889000F) || isHR(err, 0x80004005) {
			return ProbeStuck
		}
		return ProbeErr
	}
	p0 := s.position()
	pad0, _ := s.padding()
	moved := false
	for i := 0; i < 40; i++ { // up to 800 ms
		time.Sleep(20 * time.Millisecond)
		pad, err := s.padding()
		if err != nil {
			logf("probe padding: %v", err)
			return ProbeErr
		}
		s.write(s.frames-pad, nil)
		if s.position() > p0 || pad < pad0 {
			moved = true
			if i >= 4 {
				break
			}
		}
	}
	if !moved {
		logf("probe: clock stuck at %d, padding %d/%d", p0, pad0, s.frames)
		return ProbeStuck
	}
	return ProbeOK
}

// chime = the test sound: two soft bell notes (E5 -> B5).
func chime(rate int) []float32 {
	n := int(float64(rate) * 1.25)
	out := make([]float32, n)
	note := func(start, freq, amp float64) {
		s0 := int(start * float64(rate))
		for i := s0; i < n; i++ {
			t := float64(i-s0) / float64(rate)
			env := math.Exp(-t*4.2) * math.Min(1, t*180)
			v := math.Sin(2*math.Pi*freq*t) + 0.35*math.Sin(2*math.Pi*freq*2*t)*math.Exp(-t*6) + 0.12*math.Sin(2*math.Pi*freq*3.01*t)*math.Exp(-t*9)
			out[i] += float32(v * env * amp)
		}
	}
	note(0, 659.25, 0.32)
	note(0.28, 987.77, 0.28)
	for i := n - rate/20; i < n; i++ { // fade out the tail
		out[i] *= float32(n-i) / float32(rate/20)
	}
	return out
}

// playOn plays mono samples (made for rate r) on the device, watching what Windows really sends.
func playOn(a *audio, id string, mono func(rate int) []float32) SoundTest {
	s, err := openStream(a, id, true)
	if err != nil {
		if isHR(err, 0x8889000A) {
			return SoundTest{Error: "A game is using your headphones in exclusive mode. Close it and try again."}
		}
		return SoundTest{Error: "Couldn't play on the device: " + err.Error()}
	}
	defer s.close()
	data := mono(s.f.rate)
	pos := 0
	gen := func(buf []byte, frames int) {
		for i := 0; i < frames; i++ {
			v := float32(0)
			if pos < len(data) {
				v = data[pos]
			}
			pos++
			s.f.put(buf, i, v)
		}
	}
	first := s.frames
	if int(first) > len(data) {
		first = uint32(len(data))
	}
	s.write(first, gen)
	if err := hrErr(s.ac.call(10)); err != nil {
		return SoundTest{Error: "Windows wouldn't start the sound: " + err.Error()}
	}
	p0 := s.position()
	peak := 0.0
	moved := false
	deadline := time.Now().Add(time.Duration(len(data))*time.Second/time.Duration(s.f.rate) + 1500*time.Millisecond)
	for time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
		pad, err := s.padding()
		if err != nil {
			break
		}
		if pos < len(data) {
			s.write(s.frames-pad, gen)
		} else if pad == 0 {
			break
		}
		if p := a.peak(id); p > peak {
			peak = p
		}
		if s.position() > p0 {
			moved = true
		}
	}
	return SoundTest{Sent: moved && peak > 0.0005, Peak: peak}
}

// record captures secs of the mic as mono at the mic's rate.
func record(a *audio, id string, secs float64, level func(float64)) ([]float32, int, error) {
	s, err := openStream(a, id, false)
	if err != nil {
		return nil, 0, err
	}
	defer s.close()
	if err := hrErr(s.ac.call(10)); err != nil {
		return nil, 0, err
	}
	want := int(secs * float64(s.f.rate))
	out := make([]float32, 0, want+s.f.rate/10)
	win := float32(0)
	winN := 0
	end := time.Now().Add(time.Duration(secs*1000)*time.Millisecond + 2*time.Second)
	for len(out) < want && time.Now().Before(end) {
		time.Sleep(10 * time.Millisecond)
		for {
			var next uint32
			if err := hrErr(s.svc.call(5, uintptr(unsafe.Pointer(&next)))); err != nil {
				return out, s.f.rate, err
			}
			if next == 0 {
				break
			}
			var p uintptr
			var frames, flags uint32
			if err := hrErr(s.svc.call(3, uintptr(unsafe.Pointer(&p)), uintptr(unsafe.Pointer(&frames)), uintptr(unsafe.Pointer(&flags)), 0, 0)); err != nil {
				return out, s.f.rate, err
			}
			buf := unsafe.Slice((*byte)(unsafe.Pointer(p)), int(frames)*s.f.block)
			for i := 0; i < int(frames); i++ {
				v := float32(0)
				if flags&2 == 0 {
					v = s.f.get(buf, i)
				}
				out = append(out, v)
				if av := float32(math.Abs(float64(v))); av > win {
					win = av
				}
				winN++
				if winN >= s.f.rate/10 {
					if level != nil {
						level(float64(win))
					}
					win, winN = 0, 0
				}
			}
			s.svc.call(4, uintptr(frames))
		}
	}
	return out, s.f.rate, nil
}

func resample(in []float32, from, to int) []float32 {
	if from == to || len(in) == 0 {
		return in
	}
	n := int(int64(len(in)) * int64(to) / int64(from))
	out := make([]float32, n)
	for i := range out {
		x := float64(i) * float64(from) / float64(to)
		j := int(x)
		fr := float32(x - float64(j))
		if j+1 < len(in) {
			out[i] = in[j]*(1-fr) + in[j+1]*fr
		} else {
			out[i] = in[len(in)-1]
		}
	}
	return out
}

// ---------- live mic level (only while the window is open) ----------

type micMon struct {
	mu   sync.Mutex
	id   string
	peak float64
	stop chan struct{}
	at   time.Time
}

func (m *micMon) want(id string) float64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	if id == "" {
		m.stopLocked()
		return 0
	}
	if m.id != id || m.stop == nil {
		m.stopLocked()
		if time.Since(m.at) < 2*time.Second { // don't hammer a failing mic
			return 0
		}
		m.at = time.Now()
		m.id = id
		stop := make(chan struct{})
		m.stop = stop
		go withCOM(func() { m.run(id, stop) })
	}
	p := m.peak
	m.peak *= 0.5
	return p
}

func (m *micMon) stopLocked() {
	if m.stop != nil {
		close(m.stop)
		m.stop = nil
	}
	m.id = ""
	m.peak = 0
}

func (m *micMon) Stop() {
	m.mu.Lock()
	m.stopLocked()
	m.mu.Unlock()
}

func (m *micMon) run(id string, stop chan struct{}) {
	defer func() {
		if r := recover(); r != nil {
			logf("PANIC mic monitor: %v", r)
		}
		m.mu.Lock()
		if m.stop == stop {
			m.stop = nil
			m.id = ""
		}
		m.mu.Unlock()
	}()
	a := newAudio()
	defer a.reset()
	s, err := openStream(a, id, false)
	if err != nil {
		logf("mic monitor: %v", err)
		return
	}
	defer s.close()
	if hrErr(s.ac.call(10)) != nil {
		return
	}
	for {
		select {
		case <-stop:
			return
		case <-time.After(30 * time.Millisecond):
		}
		for {
			var next uint32
			if hrErr(s.svc.call(5, uintptr(unsafe.Pointer(&next)))) != nil {
				return
			}
			if next == 0 {
				break
			}
			var p uintptr
			var frames, flags uint32
			if hrErr(s.svc.call(3, uintptr(unsafe.Pointer(&p)), uintptr(unsafe.Pointer(&frames)), uintptr(unsafe.Pointer(&flags)), 0, 0)) != nil {
				return
			}
			pk := float32(0)
			if flags&2 == 0 {
				buf := unsafe.Slice((*byte)(unsafe.Pointer(p)), int(frames)*s.f.block)
				for i := 0; i < int(frames); i++ {
					if v := float32(math.Abs(float64(s.f.get(buf, i)))); v > pk {
						pk = v
					}
				}
			}
			s.svc.call(4, uintptr(frames))
			m.mu.Lock()
			if float64(pk) > m.peak {
				m.peak = float64(pk)
			}
			m.mu.Unlock()
		}
	}
}
