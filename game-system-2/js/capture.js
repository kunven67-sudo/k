/* Game System 2.0 — screenshots and recordings.
   Canvas games are grabbed straight from their canvas (no popup). Everything else (menus, games without
   a canvas) uses the browser's "share this tab" popup. Recordings can have the game's sound and your mic,
   and you can hear yourself while recording. Everything goes to the Gallery (and your Downloads). */
(function () {
  'use strict';
  var h = U.h;
  var I = UI.icon;

  /* vbr = video bits per second (≈ vbr × 7.5 / 1 000 000 MB per minute) */
  var QUALITY = {
    low: { label: 'Low', vbr: 1200000, fps: 30, max: 854 },
    med: { label: 'Medium', vbr: 3000000, fps: 30, max: 1280 },
    high: { label: 'High', vbr: 6000000, fps: 60, max: 1920 },
    ultra: { label: 'Ultra', vbr: 12000000, fps: 60, max: 3840 }
  };
  function mbPerMin(k) { var q = QUALITY[k] || QUALITY.med; return Math.round((q.vbr + 160000) * 60 / 8 / 1048576); }

  function st() { return D.settings; }
  function canTab() { return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia); }
  function canRecord() { return typeof window.MediaRecorder === 'function'; }

  /* the Game Kit inside whatever fills the screen: the game being played, or an app window that's full size */
  function frontKit() {
    if (Player.isPlaying()) return { kit: Player.kit(), id: Player.currentId(), game: true };
    var w = window.Win && Win.activeFrame && Win.activeFrame();
    if (w && w.frame && w.full) {
      try { var k = w.frame.contentWindow && w.frame.contentWindow.GameSystem; if (k) return { kit: k, id: w.id, game: false }; } catch (e) { /* website app */ }
    }
    return { kit: null, id: null, game: false };
  }

  /* ---------------- grabbing a frame from the tab (popup) ---------------- */
  async function tabStream(withAudio, fps, maxW) {
    if (!canTab()) throw new Error('notab');
    var video = { frameRate: fps || 30, displaySurface: 'browser' };
    if (maxW) video.width = { max: maxW };
    return navigator.mediaDevices.getDisplayMedia({
      video: video,
      audio: withAudio ? { suppressLocalAudioPlayback: false } : false,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
      systemAudio: 'include'
    });
  }
  function frameFromStream(stream) {
    return new Promise(function (resolve, reject) {
      var v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.srcObject = stream;
      var t = setTimeout(function () { reject(new Error('timeout')); }, 6000);
      v.onloadeddata = function () {
        /* wait two frames so the share bar animation is gone */
        setTimeout(function () {
          try {
            var c = document.createElement('canvas');
            c.width = v.videoWidth; c.height = v.videoHeight;
            c.getContext('2d').drawImage(v, 0, 0);
            clearTimeout(t);
            c.toBlob(function (b) { b ? resolve(b) : reject(new Error('blank')); }, 'image/png');
          } catch (e) { clearTimeout(t); reject(e); }
        }, 350);
      };
      v.play().catch(function () { /* muted autoplay always works */ });
    });
  }
  function stopStream(s) { if (s) s.getTracks().forEach(function (t) { try { t.stop(); } catch (e) { /* ignore */ } }); }

  /* ---------------- screenshots ---------------- */
  var shooting = false;
  async function shot() {
    if (shooting) return;
    shooting = true;
    try {
      var f = frontKit();
      var blob = null, from = f.id;
      if (f.kit && f.kit._screenshot) {
        try {
          var data = await f.kit._screenshot({ max: 3840, type: 'image/png' });
          if (data) blob = U.dataUrlToBlob(data);
        } catch (e) { blob = null; }
      }
      if (!blob) {
        if (!canTab()) { say('This browser can\'t take screenshots of this screen. Games that draw on a canvas still work.', 'warn'); return; }
        if (!U.lsGet('gs2:tabTip', false)) {
          U.lsSet('gs2:tabTip', true);
          say('Your browser will ask what to share. Pick "This tab" and hit Share. That\'s how a screenshot of everything works.', 'info', 7000);
        }
        var hadMenu = Player.isPlaying() && Player.menuOpen();
        if (hadMenu) Player.closeMenu(true);
        var s;
        try { s = await tabStream(false, 30); }
        catch (e) { say(e && e.name === 'NotAllowedError' ? 'Screenshot cancelled.' : 'Couldn\'t take a screenshot (' + (e.message || e.name) + ').', 'warn'); return; }
        /* hide Game System's own popups for the moment the picture is taken */
        document.body.classList.add('capturing');
        try { blob = await frameFromStream(s); } finally { stopStream(s); document.body.classList.remove('capturing'); }
      }
      flash();
      Sound.shutter();
      var g = from ? D.get(from) : null;
      var m = await Media.add(blob, { kind: 'shot', g: g && !g.builtin ? g.id : null });
      if (st().shotDownload) Media.download(m.id);
      preview(m, g);
      Trophies.event('screenshot');
    } catch (e) {
      say('Couldn\'t save the screenshot: ' + (e.message || e), 'bad');
    } finally {
      shooting = false;
    }
  }

  function flash() {
    var f = h('div.cap-flash');
    UI.overlayRoot().appendChild(f);
    setTimeout(function () { f.remove(); }, 600);
  }

  /* small picture in the corner: click to open the Gallery, or use it as the game's picture */
  var prevEl = null, prevTimer = 0;
  function preview(rec, g) {
    if (prevEl) prevEl.remove();
    clearTimeout(prevTimer);
    var url = URL.createObjectURL(rec.thumb || rec.b);
    var canCover = g && !D.isApp(g) && g.source !== 'link';
    prevEl = h('div.cap-prev', { role: 'status' },
      h('button.cp-img', { title: 'Open in Gallery', onclick: function () { close(); openGallery(rec.id); } }, h('img', { src: url, alt: 'Screenshot' })),
      h('div.cp-row',
        h('b', 'Saved to Gallery'),
        canCover ? h('button.btn.sm', { onclick: async function () {
          await D.setCover(g.id, rec.b);
          await D.updateGame(g.id, { art: 'picture' });
          Trophies.event('picture');
          say('New picture for "' + g.name + '"!', 'good');
          close();
        } }, I('image'), 'Use as cover') : null));
    function close() {
      clearTimeout(prevTimer);
      if (!prevEl) return;
      var el = prevEl;
      prevEl = null;
      el.classList.add('out');
      setTimeout(function () { el.remove(); URL.revokeObjectURL(url); }, 300);
    }
    prevEl.addEventListener('mouseenter', function () { clearTimeout(prevTimer); });
    prevEl.addEventListener('mouseleave', function () { prevTimer = setTimeout(close, 2500); });
    UI.overlayRoot().appendChild(prevEl);
    prevTimer = setTimeout(close, 5000);
  }

  /* ---------------- recording ---------------- */
  var rec = null;   /* { recorder, chunks, start, tracks, ctx, timer, src, g, pill, mic } */
  function isRecording() { return !!rec; }

  function pickMime() {
    var list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (var i = 0; i < list.length; i++) { try { if (MediaRecorder.isTypeSupported(list[i])) return list[i]; } catch (e) { /* ignore */ } }
    return '';
  }

  async function toggleRec() { if (rec) return stopRec(); return startRec(); }

  async function startRec() {
    if (rec || startRec.busy) return;
    if (!canRecord()) { say('This browser can\'t record video.', 'warn'); return; }
    startRec.busy = true;
    var q = QUALITY[st().recQuality] || QUALITY.med;
    var sound = st().recSound || 'game';
    var f = frontKit();
    var g = f.id ? D.get(f.id) : null;
    var video = null, gameAudio = [], tab = null, mic = null;
    try {
      /* 1. the picture: the game's canvas if it has one, else the tab */
      if (f.kit && f.kit._canvasStream) {
        try { video = f.kit._canvasStream(q.fps); } catch (e) { video = null; }
      }
      if (video && sound !== 'none' && f.kit._audioTracks) {
        try { gameAudio = f.kit._audioTracks() || []; } catch (e) { gameAudio = []; }
      }
      if (!video) {
        if (!canTab()) { say('This screen can\'t be recorded in this browser. Games that draw on a canvas can.', 'warn'); return; }
        if (!U.lsGet('gs2:tabTipRec', false)) {
          U.lsSet('gs2:tabTipRec', true);
          say('Pick "This tab" and turn on "Share tab audio" if you want the sound, then hit Share.', 'info', 8000);
        }
        if (Player.isPlaying() && Player.menuOpen()) Player.closeMenu(true);
        try { tab = await tabStream(sound !== 'none', q.fps, q.max); }
        catch (e) { say(e && e.name === 'NotAllowedError' ? 'Recording cancelled.' : 'Couldn\'t start recording (' + (e.message || e.name) + ').', 'warn'); return; }
        video = tab;
      }
      /* 2. your mic */
      if (sound === 'mic') {
        try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
        catch (e) { say('No mic (' + (e.name === 'NotAllowedError' ? 'you said no' : 'not found') + '), recording without it.', 'warn'); mic = null; }
      }
      /* 3. mix all the sound into one track */
      var ctx = null, mixed = [];
      var audioSources = gameAudio.slice();
      if (tab) audioSources = audioSources.concat(tab.getAudioTracks());
      if (audioSources.length || mic) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        var dest = ctx.createMediaStreamDestination();
        audioSources.forEach(function (t) { try { ctx.createMediaStreamSource(new MediaStream([t])).connect(dest); } catch (e) { /* skip */ } });
        if (mic) {
          var ms = ctx.createMediaStreamSource(mic);
          var gain = ctx.createGain();
          gain.gain.value = 1.15;
          ms.connect(gain).connect(dest);
          if (st().recMonitor) ms.connect(ctx.destination);
        }
        mixed = dest.stream.getAudioTracks();
        if (ctx.state === 'suspended') ctx.resume().catch(function () {});
      }
      var vtrack = video.getVideoTracks()[0];
      if (!vtrack) throw new Error('no picture to record');
      try { vtrack.contentHint = 'motion'; } catch (e) { /* ignore */ }
      var stream = new MediaStream([vtrack].concat(mixed));
      var mime = pickMime();
      var recorder;
      try { recorder = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: q.vbr, audioBitsPerSecond: 160000 }); }
      catch (e) { mime = ''; recorder = new MediaRecorder(stream, { videoBitsPerSecond: q.vbr }); /* browser picks the format */ }
      var R = rec = { recorder: recorder, chunks: [], start: Date.now(), stream: stream, video: video, tab: tab, mic: mic, ctx: ctx, g: g, id: f.id, game: f.game, mime: recorder.mimeType || mime || 'video/webm' };
      /* each piece belongs to THIS recording, even if a new one starts right after */
      recorder.ondataavailable = function (e) { if (e.data && e.data.size) R.chunks.push(e.data); };
      recorder.onstop = function () { finish(R); };
      recorder.onerror = function () { say('The recording broke. Saving what we have.', 'warn'); };
      vtrack.addEventListener('ended', function () { if (rec === R) stopRec(); });
      recorder.start(1000);
      Sound.recStart();
      showPill();
      paintFloat();
      if (Player.isPlaying()) Player.refreshMenu();
    } catch (e) {
      stopStream(tab); stopStream(mic);
      say('Couldn\'t start recording: ' + (e.message || e), 'bad');
      rec = null;
    } finally {
      startRec.busy = false;
    }
  }

  function stopRec() {
    if (!rec) return;
    var r = rec;
    if (r.recorder.state !== 'inactive') {
      try { r.recorder.stop(); } catch (e) { finish(r); }
    } else finish(r);
  }

  async function finish(r) {
    if (!r || r.done) return;
    r.done = true;
    if (rec === r) rec = null;
    clearInterval(r.timer);
    if (r.pill) r.pill.remove();
    stopStream(r.tab); stopStream(r.mic); stopStream(r.video !== r.tab ? r.video : null);
    if (r.ctx) r.ctx.close().catch(function () {});
    paintFloat();
    if (Player.isPlaying()) Player.refreshMenu();
    Sound.recStop();
    var dur = Date.now() - r.start;
    if (!r.chunks.length || dur < 600) { say('That recording was empty.', 'warn'); return; }
    var blob = new Blob(r.chunks, { type: r.mime.split(';')[0] });
    try {
      var m = await Media.add(blob, { kind: 'clip', g: r.g && !r.g.builtin ? r.g.id : null, dur: dur });
      if (st().recDownload) Media.download(m.id);
      Trophies.event('record');
      UI.toast('Recording saved (' + U.fmtDuration(dur, true) + ', ' + U.fmtBytes(blob.size) + ').', {
        type: 'good', icon: 'camera', title: 'Saved to Gallery', timeout: 8000, sound: false,
        actions: [{ label: 'Watch', kind: 'primary', onClick: function () { watch(m.id); } }, { label: 'Gallery', onClick: function () { openGallery(m.id); } }]
      });
    } catch (e) {
      say('Couldn\'t save the recording: ' + (e.message || e) + '. Downloading it instead.', 'bad');
      U.downloadBlob(blob, 'recording-' + U.dayKey() + Media.extFor(blob.type));
    }
  }

  /* the red REC pill with the timer */
  function showPill() {
    var time = h('b.rp-time', '0:00');
    var limit = Number(st().recMax) || 0;
    var pill = h('div.rec-pill', { role: 'status', 'aria-live': 'off' },
      h('span.rp-dot'), h('span.rp-label', 'REC'), time,
      limit ? h('span.rp-max', '/ ' + fmt(limit * 60000)) : null,
      h('button.rp-stop', { title: 'Stop recording', 'aria-label': 'Stop recording', onclick: stopRec }, h('i')));
    UI.overlayRoot().appendChild(pill);
    rec.pill = pill;
    rec.timer = setInterval(function () {
      if (!rec) return;
      var ms = Date.now() - rec.start;
      time.textContent = fmt(ms);
      if (limit && ms >= limit * 60000) { say('Hit the max length (' + limit + ' min). Change it in Settings.', 'info'); stopRec(); }
    }, 250);
  }
  function fmt(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    var hr = Math.floor(m / 60);
    return (hr ? hr + ':' + String(m % 60).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0');
  }

  /* a game closed while recording its canvas: stop + save */
  function gameClosing(id) { if (rec && rec.id === id && !rec.tab) stopRec(); }

  /* ---------------- floating button ---------------- */
  var floatEl = null;
  function wantFloat() {
    var mode = st().capFloat || 'phone';
    if (mode === 'off') return false;
    if (mode === 'rec') return !!rec;
    if (mode === 'always') return Player.isPlaying() || !!rec;
    return (matchMedia('(pointer: coarse)').matches && Player.isPlaying()) || !!rec;
  }
  function paintFloat() {
    var show = wantFloat();
    if (!show) { if (floatEl) floatEl.hidden = true; return; }
    if (!floatEl) makeFloat();
    floatEl.hidden = false;
    floatEl.classList.toggle('recording', !!rec);
    floatEl.setAttribute('aria-label', rec ? 'Stop recording' : 'Screenshot (hold to record)');
    floatEl.title = rec ? 'Stop recording' : 'Tap: screenshot · Hold: record';
  }
  function makeFloat() {
    floatEl = h('button.cap-float', { 'aria-label': 'Screenshot (hold to record)' }, I('camera'), h('i.cf-dot'));
    var pos = U.lsGet('gs2:capFloat', null);
    if (pos && isFinite(pos.x) && isFinite(pos.y)) place(pos.x, pos.y);
    var down = null, moved = false, holdT = 0, held = false;
    floatEl.addEventListener('pointerdown', function (e) {
      down = { x: e.clientX, y: e.clientY, l: floatEl.offsetLeft, t: floatEl.offsetTop };
      moved = false; held = false;
      try { floatEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      holdT = setTimeout(function () { if (!moved) { held = true; if (navigator.vibrate) navigator.vibrate(30); toggleRec(); } }, 600);
    });
    floatEl.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!moved && Math.hypot(dx, dy) > 8) { moved = true; clearTimeout(holdT); }
      if (moved) place(down.l + dx, down.t + dy);
    });
    function up() {
      clearTimeout(holdT);
      if (!down) return;
      var wasMoved = moved;
      down = null;
      if (wasMoved) { U.lsSet('gs2:capFloat', { x: floatEl.offsetLeft, y: floatEl.offsetTop }); return; }
      if (held) return;
      if (rec) stopRec(); else shot();
    }
    floatEl.addEventListener('pointerup', up);
    floatEl.addEventListener('pointercancel', function () { clearTimeout(holdT); down = null; });
    floatEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    UI.overlayRoot().appendChild(floatEl);
  }
  function place(x, y) {
    var s = 52;
    x = Math.max(6, Math.min(window.innerWidth - s - 6, x));
    y = Math.max(6, Math.min(window.innerHeight - s - 6, y));
    floatEl.style.left = x + 'px';
    floatEl.style.top = y + 'px';
    floatEl.style.right = 'auto';
    floatEl.style.bottom = 'auto';
  }

  /* ---------------- keys ---------------- */
  function keyIs(e, combo) {
    if (!combo) return false;
    var parts = String(combo).toLowerCase().split('+');
    var key = parts.pop();
    return ((e.key || '').toLowerCase() === key || String(e.code || '').toLowerCase() === key) &&
      e.ctrlKey === (parts.indexOf('ctrl') >= 0) && e.altKey === (parts.indexOf('alt') >= 0) && e.shiftKey === (parts.indexOf('shift') >= 0);
  }
  function keyAction(e) {
    if (keyIs(e, st().shotKey)) return 'shot';
    if (keyIs(e, st().recKey)) return 'rec';
    return null;
  }
  function run(what) {
    if (what === 'shot') shot();
    else if (what === 'rec') toggleRec();
  }
  /* first time you use the buttons with no keys picked: offer to pick some */
  function maybeOfferKeys() {
    if (st().shotKey || st().recKey || U.lsGet('gs2:capKeysAsked', false)) return;
    U.lsSet('gs2:capKeysAsked', true);
    setTimeout(function () {
      UI.toast('Want keys for screenshots and recording? Pick your own (like F8 and F9).', {
        icon: 'keyboard', timeout: 9000,
        actions: [{ label: 'Pick keys', kind: 'primary', onClick: function () { App.go('settings'); setTimeout(function () { var s = document.getElementById('set-capture'); if (s) s.scrollIntoView({ behavior: 'smooth' }); }, 150); } }]
      });
    }, 1200);
  }

  /* ---------------- controller: View/Select button (tap = screenshot, hold = record) ---------------- */
  var padDown = 0, padHeld = false, padLoop = 0;
  function pollPad() {
    padLoop = 0;
    var list = navigator.getGamepads ? navigator.getGamepads() : [];
    var any = false, pressed = false;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p) continue;
      any = true;
      if (p.buttons[8] && p.buttons[8].pressed) pressed = true;
    }
    if (st().padCapture !== false && document.hasFocus()) {
      var now = performance.now();
      if (pressed && !padDown) { padDown = now; padHeld = false; }
      else if (pressed && padDown && !padHeld && now - padDown > 700) { padHeld = true; toggleRec(); }
      else if (!pressed && padDown) { if (!padHeld) shot(); padDown = 0; }
    } else padDown = 0;
    if (any) padLoop = requestAnimationFrame(pollPad);
  }

  /* ---------------- open the Gallery / Video app ---------------- */
  function openGallery(mediaId) {
    if (!D.get('gs2-gallery')) { say('The Gallery app is gone. Bring it back from the Apps tab.', 'warn'); return; }
    Media.setPending(mediaId || null, 'gallery');
    Win.open('gs2-gallery').then(function () { Win.broadcast('gs2media'); });
  }
  function watch(mediaId) {
    if (!D.get('gs2-video')) { openGallery(mediaId); return true; }
    Media.setPending(mediaId, 'video');
    Win.open('gs2-video').then(function () { Win.broadcast('gs2media'); });
    return true;
  }

  function say(msg, type, timeout) {
    if (Player.isPlaying()) Player.toast(msg, type === 'bad' ? 'bad' : null);
    else UI.toast(msg, { type: type || 'info', timeout: timeout });
  }

  function init() {
    window.addEventListener('gamepadconnected', function () { if (!padLoop) padLoop = requestAnimationFrame(pollPad); });
    if (navigator.getGamepads && Array.prototype.some.call(navigator.getGamepads(), Boolean)) padLoop = requestAnimationFrame(pollPad);
    window.addEventListener('resize', U.debounce(function () { if (floatEl && !floatEl.hidden && floatEl.style.left) place(floatEl.offsetLeft, floatEl.offsetTop); }, 150));
    D.on(function (type) { if (type === 'settings') paintFloat(); });
    /* going in/out of fullscreen: move our stuff so it stays visible */
    document.addEventListener('fullscreenchange', function () {
      var root = UI.overlayRoot();
      [floatEl, prevEl, rec && rec.pill].concat(Array.prototype.slice.call(document.querySelectorAll('.trophy-pop'))).forEach(function (el) {
        if (el && el.parentNode && el.parentNode !== root) root.appendChild(el);
      });
    });
  }

  window.Capture = {
    QUALITY: QUALITY,
    mbPerMin: mbPerMin,
    init: init,
    shot: function () { maybeOfferKeys(); return shot(); },
    toggleRec: function () { maybeOfferKeys(); return toggleRec(); },
    startRec: startRec,
    stopRec: stopRec,
    isRecording: isRecording,
    keyAction: keyAction,
    run: run,
    gameChanged: paintFloat,
    gameClosing: gameClosing,
    openGallery: openGallery,
    watch: watch,
    canTab: canTab,
    canRecord: canRecord
  };
})();
