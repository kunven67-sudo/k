// Windows-only native calls through koffi. Every export is a safe no-op on
// other platforms so the app can still be developed and tested elsewhere.
const IS_WIN = process.platform === 'win32';

// System cursor ids (OCR_*) grouped the way the settings page shows them.
const CURSOR_GROUPS = {
  normal: [32512],          // arrow
  link: [32649],            // hand
  text: [32513],            // I-beam
  busy: [32650, 32514],     // app starting, wait
  precision: [32515],       // crosshair
  help: [32651],
};

const SPI_SETCURSORS = 0x57;
const IMAGE_CURSOR = 2;
const LR_LOADFROMFILE = 0x10;
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

const INPUT_MOUSE = 0;
const INPUT_KEYBOARD = 1;
const KEYEVENTF_EXTENDEDKEY = 0x1;
const KEYEVENTF_KEYUP = 0x2;
const KEYEVENTF_SCANCODE = 0x8;

const MOUSE_FLAGS = {
  left: [0x0002, 0x0004],
  right: [0x0008, 0x0010],
  middle: [0x0020, 0x0040],
};
const MOUSEEVENTF_WHEEL = 0x0800;
const MOUSEEVENTF_HWHEEL = 0x1000;

// Keys whose scan codes need the "extended" flag.
const EXTENDED_VK = new Set([0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2d, 0x2e, 0x5b, 0x5c, 0x5d, 0x6f, 0x90, 0x2c]);
// Media/volume keys only work as virtual keys.
const VK_ONLY = new Set([0xad, 0xae, 0xaf, 0xb0, 0xb1, 0xb2, 0xb3]);

let api = null;
let loadError = null;

function load() {
  if (api || loadError || !IS_WIN) return api;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');

    const MOUSEINPUT = koffi.struct('CV_MOUSEINPUT', {
      dx: 'int32_t', dy: 'int32_t', mouseData: 'uint32_t', dwFlags: 'uint32_t', time: 'uint32_t', dwExtraInfo: 'uintptr_t',
    });
    const KEYBDINPUT = koffi.struct('CV_KEYBDINPUT', {
      wVk: 'uint16_t', wScan: 'uint16_t', dwFlags: 'uint32_t', time: 'uint32_t', dwExtraInfo: 'uintptr_t',
    });
    const HARDWAREINPUT = koffi.struct('CV_HARDWAREINPUT', { uMsg: 'uint32_t', wParamL: 'uint16_t', wParamH: 'uint16_t' });
    const INPUT = koffi.struct('CV_INPUT', {
      type: 'uint32_t',
      u: koffi.union({ mi: MOUSEINPUT, ki: KEYBDINPUT, hi: HARDWAREINPUT }),
    });

    api = {
      koffi,
      INPUT,
      LoadImageW: user32.func('void * __stdcall LoadImageW(void *hInst, const char16_t *name, uint32_t type, int cx, int cy, uint32_t fuLoad)'),
      LoadCursorFromFileW: user32.func('void * __stdcall LoadCursorFromFileW(const char16_t *name)'),
      SetSystemCursor: user32.func('bool __stdcall SetSystemCursor(void *hcur, uint32_t id)'),
      DestroyCursor: user32.func('bool __stdcall DestroyCursor(void *hcur)'),
      SystemParametersInfoW: user32.func('bool __stdcall SystemParametersInfoW(uint32_t action, uint32_t param, void *pv, uint32_t winIni)'),
      GetForegroundWindow: user32.func('void * __stdcall GetForegroundWindow()'),
      GetWindowThreadProcessId: user32.func('uint32_t __stdcall GetWindowThreadProcessId(void *hwnd, _Out_ uint32_t *pid)'),
      MapVirtualKeyW: user32.func('uint32_t __stdcall MapVirtualKeyW(uint32_t code, uint32_t mapType)'),
      SendInput: user32.func('unsigned int __stdcall SendInput(unsigned int cInputs, CV_INPUT *pInputs, int cbSize)'),
      OpenProcess: kernel32.func('void * __stdcall OpenProcess(uint32_t access, bool inherit, uint32_t pid)'),
      QueryFullProcessImageNameW: kernel32.func('bool __stdcall QueryFullProcessImageNameW(void *h, uint32_t flags, _Out_ uint8_t *buf, _Inout_ uint32_t *size)'),
      CloseHandle: kernel32.func('bool __stdcall CloseHandle(void *h)'),
    };
  } catch (err) {
    loadError = err;
    api = null;
    console.error('[win32] native calls unavailable:', err);
  }
  return api;
}

function available() {
  return !!load();
}

// Puts Windows' own cursors back (reloads the user's scheme from the registry).
function restoreSystemCursors() {
  const a = load();
  if (!a) return false;
  return !!a.SystemParametersInfoW(SPI_SETCURSORS, 0, null, 0);
}

function loadCursorHandle(a, file, size) {
  // LoadImage honours the exact size; LoadCursorFromFile is the fallback for .ani
  // files on older builds that refuse LoadImage.
  let h = a.LoadImageW(null, file, IMAGE_CURSOR, size, size, LR_LOADFROMFILE);
  if (!h) h = a.LoadCursorFromFileW(file);
  return h || null;
}

// files: { normal: path, link: path, busy: path } ; groups: { normal: true, ... }
// Returns the list of groups that failed.
function applySystemCursors(files, groups, size) {
  const a = load();
  if (!a) return { ok: false, error: loadError ? String(loadError.message || loadError) : 'not windows' };
  const failed = [];
  for (const [group, ids] of Object.entries(CURSOR_GROUPS)) {
    if (!groups[group]) continue;
    const file = files[group] || files.normal;
    for (const id of ids) {
      // SetSystemCursor takes ownership of (and destroys) the handle, so every id
      // needs its own freshly loaded copy.
      const h = loadCursorHandle(a, file, size);
      if (!h || !a.SetSystemCursor(h, id)) {
        if (h) a.DestroyCursor(h);
        failed.push(`${group}:${id}`);
      }
    }
  }
  return { ok: failed.length === 0, failed };
}

const pidCache = new Map();

// Full path of the process that owns the foreground window, or null.
function foregroundProcess() {
  const a = load();
  if (!a) return null;
  const hwnd = a.GetForegroundWindow();
  if (!hwnd) return null;
  const out = [0];
  if (!a.GetWindowThreadProcessId(hwnd, out)) return null;
  const pid = out[0];
  if (!pid) return null;
  const now = Date.now();
  const cached = pidCache.get(pid);
  if (cached && now - cached.at < 15000) return { pid, path: cached.path };
  let path = null;
  const h = a.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
  if (h) {
    try {
      const buf = Buffer.alloc(2048);
      const size = [1024];
      if (a.QueryFullProcessImageNameW(h, 0, buf, size)) path = buf.toString('utf16le', 0, size[0] * 2);
    } finally {
      a.CloseHandle(h);
    }
  }
  if (pidCache.size > 200) pidCache.clear();
  pidCache.set(pid, { path, at: now });
  return { pid, path };
}

function keyInput(a, vk, up) {
  let flags = up ? KEYEVENTF_KEYUP : 0;
  let scan = 0;
  if (!VK_ONLY.has(vk)) {
    scan = a.MapVirtualKeyW(vk, 0);
    if (scan) {
      flags |= KEYEVENTF_SCANCODE;
      if (EXTENDED_VK.has(vk)) flags |= KEYEVENTF_EXTENDEDKEY;
    }
  }
  return { type: INPUT_KEYBOARD, u: { ki: { wVk: scan ? 0 : vk, wScan: scan, dwFlags: flags, time: 0, dwExtraInfo: 0 } } };
}

function send(a, events) {
  if (!events.length) return 0;
  return a.SendInput(events.length, events, a.koffi.sizeof(a.INPUT));
}

// Presses modifiers down, taps the key, releases in reverse order.
function pressKeys(vks) {
  const a = load();
  if (!a || !vks.length) return false;
  const down = vks.map((vk) => keyInput(a, vk, false));
  const up = vks.slice().reverse().map((vk) => keyInput(a, vk, true));
  return send(a, [...down, ...up]) === vks.length * 2;
}

function keyDown(vk) { const a = load(); return a ? send(a, [keyInput(a, vk, false)]) === 1 : false; }
function keyUp(vk) { const a = load(); return a ? send(a, [keyInput(a, vk, true)]) === 1 : false; }

function mouse(a, flags, data = 0) {
  return { type: INPUT_MOUSE, u: { mi: { dx: 0, dy: 0, mouseData: data >>> 0, dwFlags: flags, time: 0, dwExtraInfo: 0 } } };
}

function click(button = 'left', count = 1) {
  const a = load();
  if (!a) return false;
  const [d, u] = MOUSE_FLAGS[button] || MOUSE_FLAGS.left;
  const events = [];
  for (let i = 0; i < count; i++) events.push(mouse(a, d), mouse(a, u));
  return send(a, events) === events.length;
}

function mouseButton(button, down) {
  const a = load();
  if (!a) return false;
  const [d, u] = MOUSE_FLAGS[button] || MOUSE_FLAGS.left;
  return send(a, [mouse(a, down ? d : u)]) === 1;
}

const KEYEVENTF_UNICODE = 0x4;

// Types any text (emoji included) as unicode key events, independent of keyboard layout.
function typeText(text) {
  const a = load();
  if (!a || !text) return false;
  const events = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 10) { events.push(keyInput(a, 0x0d, false), keyInput(a, 0x0d, true)); continue; }
    if (code === 13) continue;
    for (const up of [false, true]) {
      events.push({ type: INPUT_KEYBOARD, u: { ki: { wVk: 0, wScan: code, dwFlags: KEYEVENTF_UNICODE | (up ? KEYEVENTF_KEYUP : 0), time: 0, dwExtraInfo: 0 } } });
    }
  }
  return send(a, events) === events.length;
}

// notches > 0 scrolls up (or right when horizontal).
function scroll(notches, horizontal = false) {
  const a = load();
  if (!a) return false;
  const data = Math.round(notches * 120);
  return send(a, [mouse(a, horizontal ? MOUSEEVENTF_HWHEEL : MOUSEEVENTF_WHEEL, data)]) === 1;
}

module.exports = {
  IS_WIN,
  CURSOR_GROUPS,
  available,
  loadError: () => loadError,
  restoreSystemCursors,
  applySystemCursors,
  foregroundProcess,
  pressKeys,
  keyDown,
  keyUp,
  click,
  mouseButton,
  scroll,
  typeText,
};
