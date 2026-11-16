package main

import (
	"strings"
	"testing"
	"time"
)

type rig struct {
	t  *testing.T
	f  *FakePC
	ui *nopUI
	g  *Guardian
	at time.Time
}

func newRig(t *testing.T) *rig {
	r := &rig{t: t, f: newFakePC(), ui: &nopUI{}, at: time.Date(2026, 11, 16, 20, 0, 0, 0, time.UTC)}
	r.g = NewGuardian(r.f, r.ui, "")
	r.g.now = func() time.Time { return r.at }
	return r
}

// tick n seconds
func (r *rig) run(n int) {
	for i := 0; i < n; i++ {
		r.g.Tick()
		r.at = r.at.Add(time.Second)
	}
}

func (r *rig) events() string {
	var b strings.Builder
	for _, e := range r.g.State().Events {
		b.WriteString(e.Kind + ": " + e.Text + "\n")
	}
	return b.String()
}

func (r *rig) has(sub string) bool { return strings.Contains(r.events(), sub) }

func (r *rig) must(sub string) {
	r.t.Helper()
	if !r.has(sub) {
		r.t.Fatalf("missing event %q in:\n%s", sub, r.events())
	}
}

func (r *rig) mustNot(sub string) {
	r.t.Helper()
	if r.has(sub) {
		r.t.Fatalf("unexpected event %q in:\n%s", sub, r.events())
	}
}

func TestAllGoodDoesNothing(t *testing.T) {
	r := newRig(t)
	r.run(30)
	if len(r.g.State().Events) != 0 {
		t.Fatalf("healthy PC should log nothing:\n%s", r.events())
	}
	if st := r.g.State().Status; st.Level != "ok" || st.Title != "All good" {
		t.Fatalf("status %+v", st)
	}
	for _, c := range r.f.Calls {
		if !strings.HasPrefix(c, "probe") {
			t.Fatalf("healthy PC got a change: %v", r.f.Calls)
		}
	}
}

func TestUnmuteAndRespect(t *testing.T) {
	r := newRig(t)
	r.run(2)
	r.f.Set(func(f *FakePC) { f.dev(idHP).Muted = true })
	r.run(1)
	r.must("Your sound was muted. Unmuted it.")
	if r.f.dev(idHP).Muted {
		t.Fatal("still muted")
	}
	// they mute it again 20 s later -> leave it
	r.run(20)
	r.f.Set(func(f *FakePC) { f.dev(idHP).Muted = true })
	r.run(5)
	r.must("You muted your sound again, so I'm leaving it muted.")
	if !r.f.dev(idHP).Muted {
		t.Fatal("should stay muted")
	}
	if st := r.g.State().Status; st.Title != "Sound is muted" {
		t.Fatalf("status %+v", st)
	}
	// they unmute themselves, later it gets muted by something -> fix again
	r.f.Set(func(f *FakePC) { f.dev(idHP).Muted = false })
	r.run(200)
	r.f.Set(func(f *FakePC) { f.dev(idHP).Muted = true })
	r.run(1)
	if r.f.dev(idHP).Muted {
		t.Fatal("respect should end once they unmuted")
	}
}

func TestMicVolumeAndMute(t *testing.T) {
	r := newRig(t)
	r.f.Set(func(f *FakePC) { f.dev(idMic).Volume = 0.05; f.dev(idMic).Muted = true })
	r.run(1)
	r.must("Your mic was muted. Unmuted it.")
	r.must("Your mic volume was at 5%. Set it to 100%.")
	if d := r.f.dev(idMic); d.Muted || d.Volume != 1 {
		t.Fatalf("mic %+v", d)
	}
}

func TestOutVolumeZero(t *testing.T) {
	r := newRig(t)
	r.f.Set(func(f *FakePC) { f.dev(idHP).Volume = 0 })
	r.run(1)
	r.must("Your sound volume was at 0%. Set it to 25%.")
	// 11% is a normal choice, leave it
	r.f.Set(func(f *FakePC) { f.dev(idHP).Volume = 0.11 })
	r.run(5)
	if v := r.f.dev(idHP).Volume; v != 0.11 {
		t.Fatalf("touched a normal volume: %v", v)
	}
}

func TestCallsGoingToTV(t *testing.T) {
	r := newRig(t)
	r.f.Set(func(f *FakePC) { f.S.DefOutComm = idTV })
	r.run(3)
	r.must("Calls (Discord, games' voice chat) were going to HDMI TV. Moved them to Speakers / Headphones (Realtek Audio).")
	if r.f.S.DefOutComm != idHP {
		t.Fatal("calls not moved")
	}
	// they move calls back to the TV on purpose -> don't fight
	r.f.Set(func(f *FakePC) { f.S.DefOutComm = idTV })
	r.run(10)
	if r.f.S.DefOutComm != idTV {
		t.Fatal("fought a manual choice")
	}
}

func TestPlugInSwitchesDefault(t *testing.T) {
	r := newRig(t)
	r.f.Set(func(f *FakePC) { f.dev(idHP).JackIn = false; f.S.DefOut, f.S.DefOutComm = idTV, idTV })
	r.run(3)
	r.f.Set(func(f *FakePC) { f.dev(idHP).JackIn = true })
	r.run(1)
	r.must("plugged in. Sound and calls now go to them.")
	if r.f.S.DefOut != idHP || r.f.S.DefOutComm != idHP {
		t.Fatal("not switched")
	}
	r.f.Set(func(f *FakePC) { f.dev(idHP).JackIn = false })
	r.run(1)
	r.must("unplugged.")
}

func TestPlugSwitchOff(t *testing.T) {
	r := newRig(t)
	r.g.SetSetting("plugSwitch", false)
	r.f.Set(func(f *FakePC) { f.dev(idHP).JackIn = false; f.S.DefOut, f.S.DefOutComm = idTV, idTV })
	r.run(2)
	r.f.Set(func(f *FakePC) { f.dev(idHP).JackIn = true })
	r.run(2)
	if r.f.S.DefOut != idTV {
		t.Fatal("switched with the setting off")
	}
}

func TestUSBAdapter(t *testing.T) {
	r := newRig(t)
	r.run(2)
	r.f.Set(func(f *FakePC) { f.addUSB() })
	r.run(1)
	if r.f.S.DefOut != idUSBo || r.f.S.DefIn != idUSBi || r.f.S.DefInComm != idUSBi {
		t.Fatalf("USB not used: %+v", r.f.S)
	}
	r.must("Headphones (USB Audio Device) plugged in. Sound and calls now go to them.")
}

func TestMicNotDetected(t *testing.T) {
	r := newRig(t)
	r.run(2)
	r.f.Set(func(f *FakePC) {
		f.dev(idMic).State = "unplugged"
		f.S.DefIn, f.S.DefInComm = "", ""
	})
	r.run(3)
	r.mustNot("mic isn't detected") // waits 4 s (plug still going in)
	r.run(3)
	r.must("Pull the plug out and push it all the way back in.")
	if len(r.ui.notes) != 1 {
		t.Fatalf("notes %v", r.ui.notes)
	}
	if st := r.g.State().Status; st.Title != "Mic not detected" {
		t.Fatalf("status %+v", st)
	}
	r.run(60)
	if len(r.ui.notes) != 1 {
		t.Fatal("nagged twice")
	}
	r.f.Set(func(f *FakePC) { f.dev(idMic).State = "active"; f.S.DefIn, f.S.DefInComm = idMic, idMic })
	r.run(1)
	r.must("Your mic is back.")
}

func TestHeadphonesWithoutMicNoNagWhenUnplugged(t *testing.T) {
	r := newRig(t)
	// nothing in the jack, mic unplugged = normal, no nag
	r.f.Set(func(f *FakePC) {
		f.dev(idHP).JackIn = false
		f.dev(idMic).State = "unplugged"
		f.S.DefIn, f.S.DefInComm = "", ""
	})
	r.run(20)
	r.mustNot("mic isn't detected")
}

func TestStereoMixSwitched(t *testing.T) {
	r := newRig(t)
	r.f.Set(func(f *FakePC) { f.dev(idMix).State = "active"; f.S.DefIn, f.S.DefInComm = idMix, idMix })
	r.run(2)
	r.must("Your mic was set to Stereo Mix")
	if r.f.S.DefIn != idMic {
		t.Fatal("still stereo mix")
	}
}

func TestFrozenFixedByServiceRestart(t *testing.T) {
	r := newRig(t)
	r.run(3)
	r.f.Set(func(f *FakePC) { f.Frozen = true })
	r.run(5)
	if r.f.Restarts != 0 {
		t.Fatal("restarted too fast (must wait 6 s of silence)")
	}
	r.run(3)
	r.must("Sound froze")
	if r.f.Restarts != 1 {
		t.Fatalf("restarts %d", r.f.Restarts)
	}
	r.run(6)
	r.must("Fixed! Sound is moving to")
	if r.g.State().NeedRestart {
		t.Fatal("should not need a PC restart")
	}
	if len(r.ui.popups) != 0 {
		t.Fatal("popup for a fixed problem")
	}
}

func TestFrozenNeedsRestartPopupRules(t *testing.T) {
	r := newRig(t)
	r.f.Set(func(f *FakePC) { f.Frozen, f.HardFrozen = true, true; f.S.Busy = true }) // in a game
	r.run(20)
	r.must("Only a PC restart fixes this one")
	st := r.g.State()
	if !st.NeedRestart || st.Status.Title != "Restart needed" {
		t.Fatalf("state %+v", st.Status)
	}
	if r.f.Reboots != 0 {
		t.Fatal("NEVER restart the PC by itself")
	}
	if len(r.ui.popups) != 0 {
		t.Fatal("popup during a game")
	}
	r.f.Set(func(f *FakePC) { f.S.Busy = false }) // game closed
	r.run(1)
	if len(r.ui.popups) != 1 {
		t.Fatalf("popups %v", r.ui.popups)
	}
	r.run(30)
	if len(r.ui.popups) != 1 {
		t.Fatal("popup spam")
	}
	r.g.RestartLater()
	r.run(44 * 60)
	if len(r.ui.popups) != 1 {
		t.Fatal("Later didn't wait")
	}
	r.run(2 * 60)
	if len(r.ui.popups) != 2 {
		t.Fatalf("no reminder after Later: %v", r.ui.popups)
	}
	if r.f.Restarts != 1 {
		t.Fatalf("service restarts %d (want 1, no loop)", r.f.Restarts)
	}
	if r.f.Reboots != 0 {
		t.Fatal("NEVER restart the PC by itself")
	}
	// it un-freezes (sleep/wake etc) -> clear
	r.f.Set(func(f *FakePC) { f.Frozen = false })
	r.run(1)
	r.must("Sound is working again.")
	if r.g.State().NeedRestart {
		t.Fatal("still says restart")
	}
}

func TestSilenceIsNotFrozen(t *testing.T) {
	r := newRig(t)
	r.f.Set(func(f *FakePC) { f.Level = 0 }) // game paused: stream open, silence
	r.run(120)
	if r.f.Restarts != 0 || r.has("froze") {
		t.Fatalf("silence treated as frozen:\n%s", r.events())
	}
	n := 0
	for _, c := range r.f.Calls {
		if strings.HasPrefix(c, "probe") {
			n++
		}
	}
	if n > 3 {
		t.Fatalf("probing too often: %d", n)
	}
}

func TestNothingPlayingNoProbe(t *testing.T) {
	r := newRig(t)
	r.f.Set(func(f *FakePC) { f.Playing = false; f.Frozen = true })
	r.run(60)
	for _, c := range r.f.Calls {
		if strings.HasPrefix(c, "probe") {
			t.Fatal("probed with nothing playing (could pop the headphones)")
		}
	}
}

func TestAutoFixOff(t *testing.T) {
	r := newRig(t)
	r.g.SetSetting("autoFix", false)
	r.f.Set(func(f *FakePC) { f.dev(idHP).Muted = true; f.Frozen = true; f.S.DefOutComm = idTV })
	r.run(30)
	if r.f.Restarts != 0 || !r.f.dev(idHP).Muted || r.f.S.DefOutComm != idTV {
		t.Fatalf("changed things with auto-fix off: %v", r.f.Calls)
	}
	// Fix now still works
	r.g.FixNow()
	if r.f.dev(idHP).Muted {
		t.Fatal("Fix now didn't unmute")
	}
	if r.g.settings().AutoFix {
		t.Fatal("Fix now turned auto-fix on for good")
	}
}

func TestServiceOff(t *testing.T) {
	r := newRig(t)
	r.f.Set(func(f *FakePC) { f.S.SvcRunning = false })
	r.run(30) // right after logon the service may still be starting: wait
	r.mustNot("Turned it back on")
	r.run(20)
	r.must("The Windows sound service was off. Turned it back on.")
}

func TestStuckSnapshots(t *testing.T) {
	r := newRig(t)
	r.f.Set(func(f *FakePC) { f.StuckSnap = true })
	r.run(20) // just started: no alarms
	if r.f.Restarts != 0 {
		t.Fatal("alarm right after start")
	}
	r.f.Set(func(f *FakePC) { f.StuckSnap = false })
	r.run(40)
	r.f.Set(func(f *FakePC) { f.StuckSnap = true })
	r.run(3)
	if r.f.Restarts != 1 {
		t.Fatalf("restarts %d", r.f.Restarts)
	}
	r.must("Sound froze")
}

func TestMicPrivacy(t *testing.T) {
	r := newRig(t)
	r.f.Set(func(f *FakePC) { f.S.MicBlocked = true })
	r.run(1)
	r.must("privacy switch")
}

func TestMuteFailsNoSpam(t *testing.T) {
	r := newRig(t)
	r.f.Set(func(f *FakePC) { f.dev(idHP).Muted = true; f.FailMute = true })
	r.run(60)
	if c := strings.Count(r.events(), "couldn't unmute"); c != 1 {
		t.Fatalf("warned %d times", c)
	}
}

func TestUserVolumeFromWindowIsRespected(t *testing.T) {
	r := newRig(t)
	r.run(1)
	r.g.UserVolume(idHP, 0)
	r.run(10)
	if r.f.dev(idHP).Volume != 0 {
		t.Fatal("overrode the slider")
	}
}

func TestSoundTestNotSentTriggersFix(t *testing.T) {
	r := newRig(t)
	r.run(1)
	r.f.Set(func(f *FakePC) { f.Frozen = true; f.Playing = false })
	r.g.HeardAnswer(false)
	r.must("Your sound is frozen. Restarting")
}
