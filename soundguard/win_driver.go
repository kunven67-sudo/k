//go:build windows

package main

// win_driver.go = which sound driver you have + asking Windows Update for a newer one
// for YOUR exact hardware (Windows Update only offers drivers that match it).

import (
	"errors"
	"fmt"
	"runtime"
	"sort"
	"strings"
	"time"

	ole "github.com/go-ole/go-ole"
	"github.com/go-ole/go-ole/oleutil"
	"golang.org/x/sys/windows/registry"
)

const mediaClass = `SYSTEM\CurrentControlSet\Control\Class\{4d36e96c-e325-11ce-bfc1-08002be10318}`

func (b *winBackend) Driver() DriverInfo {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, mediaClass, registry.ENUMERATE_SUB_KEYS)
	if err != nil {
		return DriverInfo{Name: "Can't read (" + err.Error() + ")"}
	}
	defer k.Close()
	names, _ := k.ReadSubKeyNames(-1)
	sort.Strings(names)
	var best DriverInfo
	score := -1
	for _, n := range names {
		if len(n) != 4 { // 0000, 0001 ... (skip "Properties")
			continue
		}
		sk, err := registry.OpenKey(k, n, registry.QUERY_VALUE)
		if err != nil {
			continue
		}
		get := func(v string) string { s, _, _ := sk.GetStringValue(v); return s }
		d := DriverInfo{Name: get("DriverDesc"), Version: get("DriverVersion"), Date: get("DriverDate"), Provider: get("ProviderName"), Inf: get("InfPath"), HWID: get("MatchingDeviceId")}
		sk.Close()
		hw := strings.ToLower(d.HWID)
		sc := 0
		switch {
		case strings.Contains(hw, "ven_10ec"): // Realtek = the one with the headphone jacks
			sc = 3
		case strings.Contains(hw, "hdaudio") && !strings.Contains(hw, "ven_10de") && !strings.Contains(hw, "ven_8086&dev_28"):
			sc = 2
		case strings.Contains(hw, "usb"):
			sc = 1
		}
		if d.Name != "" && sc > score {
			best, score = d, sc
		}
	}
	if bk, err := registry.OpenKey(registry.LOCAL_MACHINE, `HARDWARE\DESCRIPTION\System\BIOS`, registry.QUERY_VALUE); err == nil {
		mk, _, _ := bk.GetStringValue("SystemManufacturer")
		pn, _, _ := bk.GetStringValue("SystemProductName")
		best.Model = strings.TrimSpace(mk + " " + pn)
		bk.Close()
	}
	if best.Date != "" { // "3-30-2017" -> "2017-03-30"
		var m, d, y int
		if _, err := fmt.Sscanf(best.Date, "%d-%d-%d", &m, &d, &y); err == nil {
			best.Date = fmt.Sprintf("%04d-%02d-%02d", y, m, d)
		}
	}
	return best
}

// wua runs f with a Windows Update session (its own thread, COM STA).
func wua(f func(sess *ole.IDispatch) error) (err error) {
	done := make(chan error, 1)
	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()
		defer func() {
			if r := recover(); r != nil {
				done <- fmt.Errorf("crashed: %v", r)
			}
		}()
		if err := ole.CoInitializeEx(0, ole.COINIT_APARTMENTTHREADED); err != nil {
			if oe, ok := err.(*ole.OleError); !ok || oe.Code() != 1 { // S_FALSE = already
				done <- err
				return
			}
		}
		defer ole.CoUninitialize()
		unk, err := oleutil.CreateObject("Microsoft.Update.Session")
		if err != nil {
			done <- errors.New("Windows Update isn't available: " + err.Error())
			return
		}
		defer unk.Release()
		sess, err := unk.QueryInterface(ole.IID_IDispatch)
		if err != nil {
			done <- err
			return
		}
		defer sess.Release()
		oleutil.PutProperty(sess, "ClientApplicationID", "SoundGuard")
		done <- f(sess)
	}()
	select {
	case err = <-done:
		return err
	case <-time.After(6 * time.Minute):
		return errors.New("Windows Update took too long")
	}
}

type wuItem struct {
	DriverUpdate
	disp *ole.IDispatch
}

func searchDrivers(sess *ole.IDispatch) ([]wuItem, error) {
	sv, err := oleutil.CallMethod(sess, "CreateUpdateSearcher")
	if err != nil {
		return nil, err
	}
	searcher := sv.ToIDispatch()
	rv, err := oleutil.CallMethod(searcher, "Search", "IsInstalled=0 and Type='Driver'")
	if err != nil {
		return nil, errors.New("search failed: " + err.Error())
	}
	res := rv.ToIDispatch()
	uv, err := oleutil.GetProperty(res, "Updates")
	if err != nil {
		return nil, err
	}
	ups := uv.ToIDispatch()
	cv, _ := oleutil.GetProperty(ups, "Count")
	n := int(cv.Val)
	var out []wuItem
	for i := 0; i < n && i < 200; i++ {
		iv, err := oleutil.GetProperty(ups, "Item", i)
		if err != nil {
			continue
		}
		it := iv.ToIDispatch()
		str := func(p string) string {
			v, err := oleutil.GetProperty(it, p)
			if err != nil || v == nil {
				return ""
			}
			if s, ok := v.Value().(string); ok {
				return s
			}
			return ""
		}
		cls, hw, title := strings.ToLower(str("DriverClass")), strings.ToLower(str("DriverHardwareID")), str("Title")
		audio := cls == "media" || strings.Contains(hw, "ven_10ec") || strings.Contains(hw, "hdaudio\\func_01") ||
			strings.Contains(strings.ToLower(title), "audio") || strings.Contains(strings.ToLower(title), "realtek")
		if !audio {
			continue
		}
		u := wuItem{disp: it}
		u.Title = title
		if idv, err := oleutil.GetProperty(it, "Identity"); err == nil {
			if v, err := oleutil.GetProperty(idv.ToIDispatch(), "UpdateID"); err == nil {
				u.ID, _ = v.Value().(string)
			}
		}
		if dv, err := oleutil.GetProperty(it, "DriverVerDate"); err == nil {
			if t, ok := dv.Value().(time.Time); ok {
				u.Date = t.Format("2006-01-02")
			}
		}
		out = append(out, u)
		logf("WU driver: %s (%s) hw=%s class=%s", title, u.ID, hw, cls)
	}
	return out, nil
}

func (b *winBackend) DriverSearch() ([]DriverUpdate, error) {
	var found []DriverUpdate
	err := wua(func(sess *ole.IDispatch) error {
		items, err := searchDrivers(sess)
		for _, it := range items {
			found = append(found, it.DriverUpdate)
		}
		return err
	})
	return found, err
}

func (b *winBackend) DriverInstall(id string) (bool, error) {
	reboot := false
	err := wua(func(sess *ole.IDispatch) error {
		items, err := searchDrivers(sess)
		if err != nil {
			return err
		}
		var pick *ole.IDispatch
		for _, it := range items {
			if it.ID == id {
				pick = it.disp
			}
		}
		if pick == nil {
			return errors.New("that driver isn't offered anymore")
		}
		if v, err := oleutil.GetProperty(pick, "EulaAccepted"); err == nil {
			if ok, _ := v.Value().(bool); !ok {
				oleutil.CallMethod(pick, "AcceptEula")
			}
		}
		cu, err := oleutil.CreateObject("Microsoft.Update.UpdateColl")
		if err != nil {
			return err
		}
		coll, _ := cu.QueryInterface(ole.IID_IDispatch)
		if _, err := oleutil.CallMethod(coll, "Add", pick); err != nil {
			return err
		}
		dv, err := oleutil.CallMethod(sess, "CreateUpdateDownloader")
		if err != nil {
			return err
		}
		dl := dv.ToIDispatch()
		oleutil.PutProperty(dl, "Updates", coll)
		if _, err := oleutil.CallMethod(dl, "Download"); err != nil {
			return errors.New("download failed: " + err.Error())
		}
		iv, err := oleutil.CallMethod(sess, "CreateUpdateInstaller")
		if err != nil {
			return err
		}
		inst := iv.ToIDispatch()
		oleutil.PutProperty(inst, "Updates", coll)
		rv, err := oleutil.CallMethod(inst, "Install")
		if err != nil {
			return errors.New("install failed: " + err.Error())
		}
		res := rv.ToIDispatch()
		code, _ := oleutil.GetProperty(res, "ResultCode")
		rb, _ := oleutil.GetProperty(res, "RebootRequired")
		if rb != nil {
			reboot, _ = rb.Value().(bool)
		}
		if code != nil && code.Val != 2 && code.Val != 3 { // 2 succeeded, 3 succeeded with errors
			return fmt.Errorf("Windows Update result code %d", code.Val)
		}
		return nil
	})
	return reboot, err
}
