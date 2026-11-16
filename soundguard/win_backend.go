//go:build windows

package main

// win_backend.go = the real PC for the Guardian. Every call has a time limit:
// a frozen sound driver can make Windows calls hang, and SOUNDGUARD must never hang with it.

import (
	"errors"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// comWorker = one OS thread with COM, running jobs one at a time.
type comWorker struct {
	jobs chan func(*audio)
	dead int32
}

func newComWorker() *comWorker {
	w := &comWorker{jobs: make(chan func(*audio), 8)}
	go func() {
		runtime.LockOSThread()
		procCoInitializeEx.Call(0, coinitMultithreaded)
		a := newAudio()
		for j := range w.jobs {
			func() {
				defer func() {
					if r := recover(); r != nil {
						logf("PANIC com job: %v\n%s", r, stack())
						a.reset()
					}
				}()
				j(a)
			}()
			if atomic.LoadInt32(&w.dead) == 1 {
				return // replaced after a hang; this thread just ends
			}
		}
	}()
	return w
}

type winBackend struct {
	mu       sync.Mutex
	w        *comWorker
	hung     int
	mic      micMon
	canDef   int32 // 1 yes, 0 no, -1 unknown
	privAt   time.Time
	privBad  bool
	resetCOM int32
	wm       *comWorker // live meters for the open window (never blocks the guardian)
	resetMtr int32
}

func newWinBackend() *winBackend {
	b := &winBackend{w: newComWorker(), wm: newComWorker(), canDef: -1}
	return b
}

// run f on the COM worker; give up after d (a hang = a new worker next time).
func (b *winBackend) run(d time.Duration, f func(a *audio) error) error {
	b.mu.Lock()
	w := b.w
	b.mu.Unlock()
	done := make(chan error, 1)
	select {
	case w.jobs <- func(a *audio) {
		if atomic.CompareAndSwapInt32(&b.resetCOM, 1, 0) {
			a.reset()
		}
		done <- f(a)
	}:
	case <-time.After(d):
		b.replace(w)
		return ErrStuck
	}
	select {
	case err := <-done:
		return err
	case <-time.After(d):
		b.replace(w)
		return ErrStuck
	}
}

func (b *winBackend) replace(old *comWorker) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.w != old {
		return
	}
	b.hung++
	logf("COM worker hung (%d times), starting a new one", b.hung)
	atomic.StoreInt32(&old.dead, 1)
	b.w = newComWorker()
}

func (b *winBackend) Snapshot() (Snap, error) {
	var s Snap
	err := b.run(4*time.Second, func(a *audio) error {
		var err error
		s, err = a.snapshot()
		if err != nil {
			a.reset()
		}
		return err
	})
	if err != nil {
		return s, err
	}
	s.SvcRunning = serviceRunning("Audiosrv")
	s.MicBlocked = b.micBlocked()
	s.Busy = userBusy()
	return s, nil
}

func (b *winBackend) SetMute(id string, m bool) error {
	return b.run(4*time.Second, func(a *audio) error { return a.setMute(id, m) })
}

func (b *winBackend) SetVolume(id string, v float64) error {
	return b.run(4*time.Second, func(a *audio) error { return a.setVolume(id, v) })
}

func (b *winBackend) SetDefault(id string) error {
	err := b.run(5*time.Second, func(a *audio) error { return a.setDefault(id) })
	if err != nil {
		logf("set default %s: %v", id, err)
	}
	return err
}

func (b *winBackend) CanSetDefault() bool {
	switch atomic.LoadInt32(&b.canDef) {
	case 1:
		return true
	case 0:
		return false
	}
	ok := b.run(4*time.Second, func(a *audio) error { _, err := a.policy(); return err }) == nil
	if ok {
		atomic.StoreInt32(&b.canDef, 1)
	} else {
		atomic.StoreInt32(&b.canDef, 0)
	}
	return ok
}

func (b *winBackend) Probe(id string) ProbeResult {
	r := probeDevice(id)
	logf("probe %s = %d", id, r)
	return r
}

func (b *winBackend) RestartAudio() error {
	b.mic.Stop()
	err := restartService("Audiosrv")
	atomic.StoreInt32(&b.resetCOM, 1)
	atomic.StoreInt32(&b.resetMtr, 1)
	return err
}

func (b *winBackend) PlayTest(id string) SoundTest {
	var r SoundTest
	done := make(chan struct{})
	go withCOM(func() {
		defer close(done)
		defer func() {
			if x := recover(); x != nil {
				logf("PANIC play test: %v", x)
				r = SoundTest{Error: "crashed (see debug log)"}
			}
		}()
		a := newAudio()
		defer a.reset()
		r = playOn(a, id, chime)
	})
	select {
	case <-done:
	case <-time.After(8 * time.Second):
		return SoundTest{Sent: false}
	}
	return r
}

func (b *winBackend) RecordTest(inID, outID string, secs float64, level func(float64)) MicTest {
	b.mic.Stop()
	var r MicTest
	done := make(chan struct{})
	go withCOM(func() {
		defer close(done)
		defer func() {
			if x := recover(); x != nil {
				logf("PANIC mic test: %v", x)
				r = MicTest{Error: "crashed (see debug log)"}
			}
		}()
		a := newAudio()
		defer a.reset()
		samples, rate, err := record(a, inID, secs, level)
		if err != nil {
			if isHR(err, 0x80070005) {
				r = MicTest{Blocked: true, Error: "Windows blocked the mic (privacy settings)."}
			} else {
				r = MicTest{Error: "Couldn't record: " + err.Error()}
			}
			return
		}
		var sum float64
		for _, v := range samples {
			av := float64(v)
			if av < 0 {
				av = -av
			}
			if av > r.Peak {
				r.Peak = av
			}
			sum += av
		}
		if len(samples) > 0 {
			r.Avg = sum / float64(len(samples))
		}
		level(-1)
		if outID != "" && len(samples) > 0 {
			pr := playOn(a, outID, func(outRate int) []float32 { return resample(samples, rate, outRate) })
			r.Played = pr.Error == ""
		}
	})
	select {
	case <-done:
	case <-time.After(time.Duration(secs*2+10) * time.Second):
		return MicTest{Error: "the mic test got stuck"}
	}
	return r
}

func (b *winBackend) LivePeaks(outID, inID string, mic bool) (float64, float64) {
	oc := make(chan float64, 1)
	select {
	case b.wm.jobs <- func(a *audio) {
		if atomic.CompareAndSwapInt32(&b.resetMtr, 1, 0) {
			a.reset()
		}
		oc <- a.peak(outID)
	}:
	default: // meter thread busy (or stuck): skip this frame
		oc <- 0
	}
	var o float64
	select {
	case o = <-oc:
	case <-time.After(300 * time.Millisecond):
	}
	var i float64
	if mic {
		i = b.mic.want(inID)
	} else {
		b.mic.Stop()
	}
	return o, i
}

func (b *winBackend) StopLive() { b.mic.Stop() }

func (b *winBackend) OpenSoundSettings() error {
	return startHidden("control.exe", "mmsys.cpl")
}

func (b *winBackend) RebootPC() error {
	logf("RESTART requested by them (button)")
	return startHidden("shutdown.exe", "/r", "/t", "15", "/c", "SOUNDGUARD: restarting your PC to fix your sound.")
}

// ---------- mic privacy switch ----------

const consentKey = `Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone`

func readConsent(root registry.Key, path string) string {
	k, err := registry.OpenKey(root, path, registry.QUERY_VALUE)
	if err != nil {
		return ""
	}
	defer k.Close()
	v, _, _ := k.GetStringValue("Value")
	return v
}

func (b *winBackend) micBlocked() bool {
	if time.Since(b.privAt) < 5*time.Second {
		return b.privBad
	}
	b.privAt = time.Now()
	b.privBad = strings.EqualFold(readConsent(registry.LOCAL_MACHINE, consentKey), "Deny") ||
		strings.EqualFold(readConsent(registry.CURRENT_USER, consentKey), "Deny") ||
		strings.EqualFold(readConsent(registry.CURRENT_USER, consentKey+`\NonPackaged`), "Deny")
	return b.privBad
}

func (b *winBackend) FixMicPrivacy() error {
	var errs []string
	for _, x := range []struct {
		root registry.Key
		path string
	}{{registry.LOCAL_MACHINE, consentKey}, {registry.CURRENT_USER, consentKey}, {registry.CURRENT_USER, consentKey + `\NonPackaged`}} {
		if !strings.EqualFold(readConsent(x.root, x.path), "Deny") {
			continue
		}
		k, err := registry.OpenKey(x.root, x.path, registry.SET_VALUE)
		if err != nil {
			errs = append(errs, err.Error())
			continue
		}
		if err := k.SetStringValue("Value", "Allow"); err != nil {
			errs = append(errs, err.Error())
		}
		k.Close()
	}
	b.privAt = time.Time{}
	if len(errs) > 0 {
		return errors.New(strings.Join(errs, "; "))
	}
	return nil
}

// ---------- Windows services ----------

func serviceRunning(name string) bool {
	m, err := windows.OpenSCManager(nil, nil, windows.SC_MANAGER_CONNECT)
	if err != nil {
		return true // can't tell: assume fine
	}
	defer windows.CloseServiceHandle(m)
	n, _ := windows.UTF16PtrFromString(name)
	s, err := windows.OpenService(m, n, windows.SERVICE_QUERY_STATUS)
	if err != nil {
		return true
	}
	defer windows.CloseServiceHandle(s)
	var st windows.SERVICE_STATUS
	if windows.QueryServiceStatus(s, &st) != nil {
		return true
	}
	return st.CurrentState == windows.SERVICE_RUNNING || st.CurrentState == windows.SERVICE_START_PENDING
}

func restartService(name string) error {
	logf("restarting service %s", name)
	m, err := windows.OpenSCManager(nil, nil, windows.SC_MANAGER_CONNECT)
	if err != nil {
		return err
	}
	defer windows.CloseServiceHandle(m)
	n, _ := windows.UTF16PtrFromString(name)
	s, err := windows.OpenService(m, n, windows.SERVICE_QUERY_STATUS|windows.SERVICE_STOP|windows.SERVICE_START)
	if err != nil {
		return errors.New("needs admin: " + err.Error())
	}
	defer windows.CloseServiceHandle(s)
	var st windows.SERVICE_STATUS
	windows.QueryServiceStatus(s, &st)
	if st.CurrentState != windows.SERVICE_STOPPED {
		windows.ControlService(s, windows.SERVICE_CONTROL_STOP, &st)
		for i := 0; i < 100 && st.CurrentState != windows.SERVICE_STOPPED; i++ {
			time.Sleep(100 * time.Millisecond)
			windows.QueryServiceStatus(s, &st)
		}
	}
	if err := windows.StartService(s, 0, nil); err != nil && err != windows.ERROR_SERVICE_ALREADY_RUNNING {
		return err
	}
	for i := 0; i < 100; i++ {
		windows.QueryServiceStatus(s, &st)
		if st.CurrentState == windows.SERVICE_RUNNING {
			logf("service %s running again", name)
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	return errors.New("the sound service didn't come back in 10 seconds")
}

// ---------- is a full screen game running? ----------

var procSHQueryUserNotificationState = windows.NewLazySystemDLL("shell32.dll").NewProc("SHQueryUserNotificationState")

func userBusy() bool {
	var st int32
	if r, _, _ := procSHQueryUserNotificationState.Call(uintptr(unsafe.Pointer(&st))); int32(uint32(r)) < 0 {
		return false
	}
	// 2 busy (full screen), 3 D3D full screen game, 4 presentation, 7 full screen Store app
	return st == 2 || st == 3 || st == 4 || st == 7
}

// ---------- helpers ----------

func hidden(cmd *exec.Cmd) *exec.Cmd {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000} // CREATE_NO_WINDOW
	return cmd
}

func startHidden(name string, args ...string) error {
	c := exec.Command(name, args...)
	if name != "control.exe" {
		hidden(c)
	}
	if err := c.Start(); err != nil {
		return err
	}
	go c.Wait()
	return nil
}
