//go:build windows && !clip

package main

// The Safe Lane on Windows: every download in an account comes through ALTS first. Files from
// Claude go to your Downloads folder and lose Windows' "from the internet" mark the moment they
// finish, so they open with no warning. Anything else is left exactly as Windows does it.

import (
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

// WebView2 vtable spots, from Microsoft's WebView2.h (SDK 1.0.4314.35), IUnknown's 3 included.
const (
	comQueryInterface      = 0
	comRelease             = 2
	wv4AddDownloadStarting = 75 // ICoreWebView2_4
	set8PutReputation      = 36 // ICoreWebView2Settings8.put_IsReputationCheckingRequired
	dsGetOperation         = 3  // ICoreWebView2DownloadStartingEventArgs
	dsGetResultFilePath    = 6
	dsPutResultFilePath    = 7
	dlAddStateChanged      = 7 // ICoreWebView2DownloadOperation
	dlRemoveStateChanged   = 8
	dlGetURI               = 9
	dlGetResultFilePath    = 15
	dlGetState             = 16
	dlGetInterruptReason   = 17
	dlGetCanResume         = 21

	dlStateInterrupted = 1
	dlStateCompleted   = 2

	whyMalicious     = 6 // COREWEBVIEW2_DOWNLOAD_INTERRUPT_REASON_...
	whyBlocked       = 8
	whySecurityCheck = 9
	whyUserPaused    = 28
)

var (
	iidWebView2_4 = windows.GUID{Data1: 0x20d02d59, Data2: 0x6df2, Data3: 0x42dc, Data4: [8]byte{0xbd, 0x06, 0xf9, 0x8a, 0x69, 0x4b, 0x13, 0x02}}
	iidSettings8  = windows.GUID{Data1: 0x9e6b0e8f, Data2: 0x86ad, Data3: 0x4e81, Data4: [8]byte{0x81, 0x47, 0xa9, 0xb5, 0xed, 0xb6, 0x86, 0x50}}
)

const zoneName = ":Zone.Identifier" // where Windows keeps the "from the internet" mark

func comQI(obj unsafe.Pointer, iid *windows.GUID) unsafe.Pointer {
	var out unsafe.Pointer
	if obj == nil || comCall(obj, comQueryInterface, uintptr(unsafe.Pointer(iid)), uintptr(unsafe.Pointer(&out))) != 0 {
		return nil
	}
	return out
}

func comRel(obj unsafe.Pointer) {
	if obj != nil {
		comCall(obj, comRelease)
	}
}

// comString calls a getter that hands back a string WebView2 made (and frees it).
func comString(obj unsafe.Pointer, idx int) string {
	var p *uint16
	if obj == nil || comCall(obj, idx, uintptr(unsafe.Pointer(&p))) != 0 || p == nil {
		return ""
	}
	s := windows.UTF16PtrToString(p)
	pCoTaskMemFree.Call(uintptr(unsafe.Pointer(p)))
	return s
}

// ---------- the "from the internet" mark ----------

// unmark takes Windows' internet mark off a file (what Windows' own "Unblock" box does).
func unmark(path string) error {
	err := windows.DeleteFile(u16(path + zoneName))
	if err == nil || err == windows.ERROR_FILE_NOT_FOUND || err == windows.ERROR_PATH_NOT_FOUND {
		return nil
	}
	return err
}

// remark puts the mark back, so Windows checks the file again like any other download.
func remark(path string) error {
	return os.WriteFile(path+zoneName, []byte("[ZoneTransfer]\r\nZoneId=3\r\n"), 0o644)
}

// readMark is a file's internet mark ("" and false when it has none).
func readMark(path string) (string, bool) {
	f, err := os.Open(path + zoneName)
	if err != nil {
		return "", false
	}
	defer f.Close()
	b := make([]byte, 8192)
	n, _ := f.Read(b)
	return string(b[:n]), true
}

// ---------- folders ----------

func knownFolder(id *windows.KNOWNFOLDERID, fallback string) string {
	if p, err := windows.KnownFolderPath(id, 0); err == nil && p != "" {
		return p
	}
	if h, err := os.UserHomeDir(); err == nil {
		return filepath.Join(h, fallback)
	}
	return ""
}

// filesDir is your normal Downloads folder (1.5.0: the extra "Claude files" folder is gone,
// files you already have in there stay where they are and stay in the Files list).
func (a *App) filesDir() string {
	if a.filesAt == "" {
		a.filesAt = knownFolder(windows.FOLDERID_Downloads, "Downloads")
	}
	return a.filesAt
}

func (a *App) filesJSON() string { return filepath.Join(a.base, "files.json") }

func (a *App) saveFileList() { saveFiles(a.filesJSON(), a.files) }

// fileLog keeps a short note of every download decision (for Claude, when something looks wrong).
func (a *App) fileLog(line string) {
	p := filepath.Join(a.base, "files.log")
	if st, err := os.Stat(p); err == nil && st.Size() > 256*1024 {
		os.Rename(p, p+".old")
	}
	f, err := os.OpenFile(p, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	f.WriteString(time.Now().Format("2006-01-02 15:04:05") + "  " + line + "\r\n")
	f.Close()
}

// ---------- hooking an account's downloads ----------

// safeLane turns the Safe Lane on for one account's browser. Run it before the account's first page.
func (a *App) safeLane(id string, v *view) {
	// WebView2's own SmartScreen box ("isn't commonly downloaded" / "could harm your device") is off
	// for ALTS's accounts only (each has its own folder). Edge and the rest of Windows keep theirs.
	if s, err := v.c.GetSettings(); err == nil && s != nil {
		v.set8 = comQI(unsafe.Pointer(s), &iidSettings8) // kept: see noSmartScreen
	}
	v.noSmartScreen()
	if wv4 := comQI(v.wv, &iidWebView2_4); wv4 != nil {
		h := &dlStartHandler{vtbl: &dlStartVtbl, app: a, id: id}
		a.keep = append(a.keep, h)
		var token int64
		comCall(wv4, wv4AddDownloadStarting, uintptr(unsafe.Pointer(h)), uintptr(unsafe.Pointer(&token)))
		comRel(wv4)
	}
}

// noSmartScreen (re)sets WebView2's own SmartScreen box to off for this account. It has to be said
// again now and then: a login pop-up window (Google, Apple) starts with it on, and WebView2 then
// turns it back on for the whole account. ALTS says it again on every Claude page and every download.
func (v *view) noSmartScreen() {
	if v != nil && v.set8 != nil {
		comCall(v.set8, set8PutReputation, 0)
	}
}

// One download from Claude that's still coming in.
type download struct {
	op    unsafe.Pointer // its ICoreWebView2DownloadOperation (we hold one reference)
	token int64
	h     *dlStateHandler
	acct  string
	path  string
	from  string
	done  bool
}

// dlStartHandler and dlStateHandler are tiny COM objects WebView2 calls (same idea as newWinHandler).
type dlStartHandler struct {
	vtbl *[4]uintptr
	app  *App
	id   string
}

var dlStartVtbl = [4]uintptr{
	windows.NewCallback(func(this *dlStartHandler, iid uintptr, out *uintptr) uintptr {
		if out != nil {
			*out = uintptr(unsafe.Pointer(this))
		}
		return 0
	}),
	windows.NewCallback(func(this *dlStartHandler) uintptr { return 1 }),
	windows.NewCallback(func(this *dlStartHandler) uintptr { return 1 }),
	windows.NewCallback(func(this *dlStartHandler, sender, args unsafe.Pointer) uintptr {
		this.app.onDownload(this.id, sender, args)
		return 0
	}),
}

type dlStateHandler struct {
	vtbl *[4]uintptr
	app  *App
	d    *download
}

var dlStateVtbl = [4]uintptr{
	windows.NewCallback(func(this *dlStateHandler, iid uintptr, out *uintptr) uintptr {
		if out != nil {
			*out = uintptr(unsafe.Pointer(this))
		}
		return 0
	}),
	windows.NewCallback(func(this *dlStateHandler) uintptr { return 1 }),
	windows.NewCallback(func(this *dlStateHandler) uintptr { return 1 }),
	windows.NewCallback(func(this *dlStateHandler, sender, args unsafe.Pointer) uintptr {
		this.app.onDownloadState(this.d)
		return 0
	}),
}

// onDownload runs inside WebView2's DownloadStarting event: only quick work here, no WebView2
// calls into ALTS's own pages (those wait for the message loop).
func (a *App) onDownload(id string, sender, args unsafe.Pointer) {
	a.views[id].noSmartScreen()
	var op unsafe.Pointer
	if comCall(args, dsGetOperation, uintptr(unsafe.Pointer(&op))) != 0 || op == nil {
		return
	}
	link := comString(op, dlGetURI)
	ok, from := fromClaude(link, comString(sender, wvGetSource))
	dir := a.filesDir()
	if !ok || dir == "" {
		comRel(op)
		a.fileLog("normal download (Windows checks it), from " + from)
		if !ok {
			a.post(func() { a.toast("Not from Claude: Windows checks it.") })
		}
		return
	}
	name := cleanDownloadName(filepath.Base(comString(args, dsGetResultFilePath)))
	os.MkdirAll(dir, 0o755)
	target := uniqueName(dir, name, func(p string) bool {
		if a.dlTaken[strings.ToLower(p)] {
			return true
		}
		_, err := os.Lstat(p)
		return err == nil
	})
	if comCall(args, dsPutResultFilePath, uintptr(unsafe.Pointer(u16(target)))) != 0 {
		target = comString(args, dsGetResultFilePath) // keep WebView2's own spot then
	}
	d := &download{op: op, acct: id, path: target, from: from}
	d.h = &dlStateHandler{vtbl: &dlStateVtbl, app: a, d: d}
	a.keep = append(a.keep, d.h) // WebView2 points at it: never let Go free it
	if comCall(op, dlAddStateChanged, uintptr(unsafe.Pointer(d.h)), uintptr(unsafe.Pointer(&d.token))) != 0 {
		comRel(op)
		return
	}
	a.dlTaken[strings.ToLower(target)] = true
	a.downloads[d] = true
	a.fileLog("from Claude (" + from + "): " + target)
}

// onDownloadState runs inside WebView2's StateChanged event.
func (a *App) onDownloadState(d *download) {
	if d.done {
		return
	}
	var state int32
	if comCall(d.op, dlGetState, uintptr(unsafe.Pointer(&state))) != 0 {
		return
	}
	switch state {
	case dlStateCompleted:
		d.done = true
		path := comString(d.op, dlGetResultFilePath)
		if path == "" {
			path = d.path
		}
		// Right now, before you can click Open: the warning comes off.
		if unmark(path) == nil {
			a.post(func() { a.finishDownload(d, path, nil) })
			return
		}
		go func() { // something (usually the virus scan) still has the file open: try again for a bit
			var err error
			for i := 0; i < 50; i++ {
				time.Sleep(100 * time.Millisecond)
				if err = unmark(path); err == nil {
					break
				}
			}
			a.post(func() { a.finishDownload(d, path, err) })
		}()
	case dlStateInterrupted:
		var why, canResume int32
		comCall(d.op, dlGetInterruptReason, uintptr(unsafe.Pointer(&why)))
		comCall(d.op, dlGetCanResume, uintptr(unsafe.Pointer(&canResume)))
		if why == whyUserPaused || canResume != 0 {
			return // paused or can still finish: keep waiting
		}
		d.done = true
		a.post(func() {
			a.endDownload(d)
			a.fileLog("stopped (" + itoa(int(why)) + "): " + d.path)
			if why == whyMalicious || why == whyBlocked || why == whySecurityCheck {
				a.toast("Windows Security stopped that file. Tell Claude.")
			}
		})
	}
}

// endDownload lets go of a finished download (outside its event, from the message loop).
func (a *App) endDownload(d *download) {
	if d.op != nil {
		comCall(d.op, dlRemoveStateChanged, uintptr(d.token))
		comRel(d.op)
		d.op = nil
	}
	delete(a.downloads, d)
	delete(a.dlTaken, strings.ToLower(d.path))
}

func (a *App) finishDownload(d *download, path string, unmarkErr error) {
	a.endDownload(d)
	acct := ""
	if i := a.st.find(d.acct); i >= 0 {
		acct = a.st.Accounts[i].Name
	}
	go func() {
		hash, size, err := hashFile(path)
		a.post(func() {
			if err != nil {
				a.fileLog("gone right after downloading: " + path)
				a.toast("File gone. Windows Security took it? Tell Claude.")
				return
			}
			a.files.add(fileRec{ID: newFileID(), Name: filepath.Base(path), Path: path, Size: size, Hash: hash,
				Added: time.Now().Unix(), From: d.from, Account: acct})
			a.files.New = true
			a.saveFileList()
			a.push()
			a.sendFiles()
			if unmarkErr != nil {
				a.fileLog("couldn't take the mark off " + path + ": " + unmarkErr.Error())
				a.toast("Saved, but the warning stayed on.")
				return
			}
			a.fileLog("ready, no warning: " + path)
			a.toast("File from Claude ready. No warning.")
		})
	}()
}

// ---------- the Files box ----------

type fileView struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Path    string `json:"path"`
	Size    int64  `json:"size"`
	Added   int64  `json:"added"`
	From    string `json:"from"`
	Account string `json:"account"`
	Old     bool   `json:"old"`
	State   string `json:"state"`
}

// sendFiles paints the Files box (when it's open). Quick check only: is it there, same size.
// The full fingerprint check happens when you open a file.
func (a *App) sendFiles() {
	if a.ui == nil || !a.uiReady {
		return
	}
	out := []fileView{}
	list := append([]fileRec(nil), a.files.Files...)
	sort.SliceStable(list, func(i, j int) bool { return list[i].Added > list[j].Added }) // newest first
	for _, r := range list {
		state := "ok"
		if st, err := os.Stat(r.Path); err != nil || st.IsDir() {
			state = "gone"
		} else if st.Size() != r.Size {
			state = "changed"
		}
		out = append(out, fileView{r.ID, r.Name, r.Path, r.Size, r.Added, r.From, r.Account, r.Old, state})
	}
	a.uiCall("files", map[string]any{"files": out, "folder": a.filesDir()})
}

func (a *App) fileCmd(c cmd) {
	switch c.T {
	case "files": // the box opened
		if a.files.New {
			a.files.New = false
			a.saveFileList()
			a.push()
		}
		a.sendFiles()
	case "files-folder":
		if dir := a.filesDir(); dir != "" {
			os.MkdirAll(dir, 0o755)
			shellOpen(dir)
		}
	case "files-old":
		a.fixOld()
	case "file-open":
		a.openFile(c.A)
	case "file-folder":
		if i := a.files.find(c.A); i >= 0 {
			showInFolder(a.files.Files[i].Path)
		}
	case "file-delete":
		if i := a.files.find(c.A); i >= 0 {
			p := a.files.Files[i].Path
			if st, err := os.Lstat(p); err == nil && st.Mode().IsRegular() {
				if err := os.Remove(p); err != nil {
					a.toast("Couldn't delete it. Is it still open?")
					return
				}
			}
			a.files.remove(c.A)
			a.saveFileList()
			a.sendFiles()
		}
	case "file-forget":
		if a.files.remove(c.A) {
			a.saveFileList()
			a.sendFiles()
		}
	}
}

// openFile checks the file is still exactly what Claude sent, then opens it. If anything changed
// it, Windows' mark goes back on first, so Windows checks it like any other file.
func (a *App) openFile(id string) {
	i := a.files.find(id)
	if i < 0 {
		return
	}
	r := a.files.Files[i]
	go func() {
		hash, size, err := hashFile(r.Path)
		state := fileState(r, size, hash, err)
		switch state {
		case "ok":
			unmark(r.Path)
		case "changed":
			remark(r.Path)
		}
		a.post(func() {
			switch state {
			case "gone":
				a.toast("That file isn't on your PC anymore.")
				a.sendFiles()
				return
			case "changed":
				a.toast("It changed since Claude sent it, so Windows checks it.")
			}
			if !openPath(r.Path) {
				a.toast("Windows couldn't open that file.")
			}
		})
	}()
}

// fixOld finds files you got from Claude before ALTS did this (in Downloads and on the Desktop,
// going by Windows' own download notes) and takes the warning off them too. Files that came out
// of those zips count as well. Nothing else is touched.
func (a *App) fixOld() {
	if a.fixing {
		return
	}
	a.fixing = true
	var zips []string
	for _, r := range a.files.Files {
		if strings.EqualFold(filepath.Ext(r.Path), ".zip") {
			zips = append(zips, strings.ToLower(r.Path))
		}
	}
	roots := []string{knownFolder(windows.FOLDERID_Downloads, "Downloads"), knownFolder(windows.FOLDERID_Desktop, "Desktop")}
	go func() {
		found, inside := fixOldIn(roots, zips, marks{read: readMark, clear: unmark, skip: cloudOnly})
		a.post(func() {
			a.fixing = false
			for i := len(found) - 1; i >= 0; i-- {
				if !a.files.has(found[i].Path) {
					a.files.add(found[i])
				}
			}
			a.saveFileList()
			a.fileLog("fixed old files: " + itoa(len(found)) + " (+" + itoa(inside) + " from their zips)")
			a.sendFiles()
			a.uiCall("filesOld", map[string]any{"found": len(found), "inside": inside})
		})
	}()
}

// cloudOnly: a OneDrive file that isn't really on the PC. Touching it would make OneDrive download it.
func cloudOnly(info fs.FileInfo) bool {
	if info == nil {
		return true
	}
	if d, ok := info.Sys().(*syscall.Win32FileAttributeData); ok {
		const offline, recallOnOpen, recallOnAccess = 0x1000, 0x40000, 0x400000
		return d.FileAttributes&(offline|recallOnOpen|recallOnAccess) != 0
	}
	return false
}

// openPath opens a file the way double-clicking it in Explorer does (from its own folder).
func openPath(path string) bool {
	const accessDenied, assocIncomplete, noAssoc = 5, 27, 31 // ShellExecute's SE_ERR_ codes
	dir := filepath.Dir(path)
	r, _, _ := pShellExecuteW.Call(0, uintptr(unsafe.Pointer(u16("open"))), uintptr(unsafe.Pointer(u16(path))), 0,
		uintptr(unsafe.Pointer(u16(dir))), swShowNormal)
	switch {
	case r > 32:
		return true
	case r == accessDenied:
		return true // you pressed No on Windows' admin box: that's not an error
	case r == noAssoc || r == assocIncomplete:
		// no app for this kind of file: Windows' "How do you want to open this file?" box
		r, _, _ = pShellExecuteW.Call(0, uintptr(unsafe.Pointer(u16("openas"))), uintptr(unsafe.Pointer(u16(path))), 0,
			uintptr(unsafe.Pointer(u16(dir))), swShowNormal)
		return r > 32
	}
	return false
}

// showInFolder opens the file's folder with the file picked (or just the folder if it's gone).
func showInFolder(path string) {
	if _, err := os.Stat(path); err != nil {
		if dir := filepath.Dir(path); dir != "" {
			if _, err := os.Stat(dir); err == nil {
				shellOpen(dir)
			}
		}
		return
	}
	pShellExecuteW.Call(0, uintptr(unsafe.Pointer(u16("open"))), uintptr(unsafe.Pointer(u16("explorer.exe"))),
		uintptr(unsafe.Pointer(u16(`/select,"`+path+`"`))), 0, swShowNormal)
}
