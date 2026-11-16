//go:build windows

package main

// win_com.go = tiny COM toolkit (vtable calls) so we can talk to Windows' sound system directly.

import (
	"fmt"
	"runtime"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	ole32                = windows.NewLazySystemDLL("ole32.dll")
	procCoInitializeEx   = ole32.NewProc("CoInitializeEx")
	procCoUninitialize   = ole32.NewProc("CoUninitialize")
	procCoCreateInstance = ole32.NewProc("CoCreateInstance")
	procCoTaskMemFree    = ole32.NewProc("CoTaskMemFree")
	procPropVariantClear = ole32.NewProc("PropVariantClear")
)

const (
	coinitMultithreaded     = 0x0
	coinitApartmentThreaded = 0x2
	clsctxInprocServer      = 0x1
	clsctxAll               = 0x17
)

func mustGUID(s string) windows.GUID {
	g, err := windows.GUIDFromString(s)
	if err != nil {
		panic("bad guid " + s)
	}
	return g
}

// HRESULT errors with names for the ones we care about.
type hresult uint32

var hrNames = map[uint32]string{
	0x80004005: "E_FAIL",
	0x80070005: "E_ACCESSDENIED",
	0x80070490: "E_NOTFOUND",
	0x80040154: "REGDB_E_CLASSNOTREG",
	0x80004002: "E_NOINTERFACE",
	0x88890004: "AUDCLNT_E_DEVICE_INVALIDATED",
	0x8889000A: "AUDCLNT_E_DEVICE_IN_USE",
	0x8889000F: "AUDCLNT_E_ENDPOINT_CREATE_FAILED",
	0x88890010: "AUDCLNT_E_SERVICE_NOT_RUNNING",
	0x88890008: "AUDCLNT_E_UNSUPPORTED_FORMAT",
	0x88890001: "AUDCLNT_E_NOT_INITIALIZED",
	0x88890002: "AUDCLNT_E_ALREADY_INITIALIZED",
	0x8889000E: "AUDCLNT_E_CPUUSAGE_EXCEEDED",
	0x800706BA: "RPC_S_SERVER_UNAVAILABLE",
	0x800706BE: "RPC_S_CALL_FAILED",
	0x80010108: "RPC_E_DISCONNECTED",
}

func (h hresult) Error() string {
	if n, ok := hrNames[uint32(h)]; ok {
		return fmt.Sprintf("%s (0x%08X)", n, uint32(h))
	}
	return fmt.Sprintf("HRESULT 0x%08X", uint32(h))
}

func hrErr(hr uintptr) error {
	if int32(uint32(hr)) < 0 {
		return hresult(uint32(hr))
	}
	return nil
}

func isHR(err error, code uint32) bool {
	h, ok := err.(hresult)
	return ok && uint32(h) == code
}

// com = pointer to a COM object.
type com uintptr

// call method #idx of the object's vtable (0 = QueryInterface, 1 = AddRef, 2 = Release, 3+ = the interface).
//
//go:uintptrescapes
func (c com) call(idx int, args ...uintptr) uintptr {
	vtbl := *(*uintptr)(unsafe.Pointer(uintptr(c)))
	fn := *(*uintptr)(unsafe.Pointer(vtbl + uintptr(idx)*unsafe.Sizeof(uintptr(0))))
	a := make([]uintptr, 0, len(args)+1)
	a = append(a, uintptr(c))
	a = append(a, args...)
	r, _, _ := syscall.SyscallN(fn, a...)
	return r
}

func (c com) Release() {
	if c != 0 {
		c.call(2)
	}
}

func (c com) QI(iid *windows.GUID) (com, error) {
	var out uintptr
	if err := hrErr(c.call(0, uintptr(unsafe.Pointer(iid)), uintptr(unsafe.Pointer(&out)))); err != nil {
		return 0, err
	}
	return com(out), nil
}

func coCreate(clsid, iid *windows.GUID, ctx uintptr) (com, error) {
	var out uintptr
	r, _, _ := procCoCreateInstance.Call(uintptr(unsafe.Pointer(clsid)), 0, ctx, uintptr(unsafe.Pointer(iid)), uintptr(unsafe.Pointer(&out)))
	if err := hrErr(r); err != nil {
		return 0, err
	}
	return com(out), nil
}

// coString reads + frees a CoTaskMem LPWSTR.
func coString(p uintptr) string {
	if p == 0 {
		return ""
	}
	s := windows.UTF16PtrToString((*uint16)(unsafe.Pointer(p)))
	procCoTaskMemFree.Call(p)
	return s
}

// withCOM runs f on its own OS thread with COM ready (MTA).
func withCOM(f func()) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	r, _, _ := procCoInitializeEx.Call(0, coinitMultithreaded)
	if int32(uint32(r)) >= 0 {
		defer procCoUninitialize.Call()
	}
	f()
}

// PROPVARIANT (24 bytes on x64).
type propVariant struct {
	vt       uint16
	r1, r2, r3 uint16
	val      [2]uint64
}

func (p *propVariant) clear() { procPropVariantClear.Call(uintptr(unsafe.Pointer(p))) }

func (p *propVariant) str() string {
	if p.vt != 31 || p.val[0] == 0 { // VT_LPWSTR
		return ""
	}
	return windows.UTF16PtrToString((*uint16)(unsafe.Pointer(uintptr(p.val[0]))))
}

func (p *propVariant) u32() (uint32, bool) {
	if p.vt == 19 || p.vt == 3 { // VT_UI4, VT_I4
		return uint32(p.val[0]), true
	}
	return 0, false
}

type propKey struct {
	fmtid windows.GUID
	pid   uint32
}
