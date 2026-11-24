/* Game System 2.0 — the game/app grid used by Home, Library and Apps.
   Three looks (small icons, big cards, list) with a size slider, phone-style folders that open
   right where they are, drag to move (PC: just drag; phone: hold, then drag; hold + let go = options),
   and a keyboard/controller "Move" mode. */
(function () {
  'use strict';
  var h = U.h;
  var I = UI.icon;

  /* ---------------- one game/app ---------------- */
  function savedTag(g) {
    var t = D.saveIndex[g.id];
    return t && g.source !== 'link' ? 'Saved ' + U.timeAgo(t) : '';
  }
  function badges(g, o) {
    return [
      g.fav ? h('span.gb.gb-fav', { title: 'Favorite' }, I('starFill')) : null,
      o.appBadge && D.isApp(g) ? h('span.gb.gb-app', { title: 'App (opens in a window)' }, I('apps')) : null,
      D.saveIndex[g.id] && g.source !== 'link' ? h('span.gb.gb-save', { title: savedTag(g) }) : null,
      window.Win && Win.isOpen(g.id) ? h('span.gb.gb-run', { title: 'Open right now' }) : null
    ];
  }
  function itemEl(g, o) {
    var mode = o.mode;
    var attrs = {
      'data-key': 'g:' + g.id,
      'data-id': g.id,
      'aria-label': g.name + (D.isApp(g) ? ' (app)' : ''),
      title: mode === 'icons' ? g.name : null
    };
    var el;
    if (mode === 'list') {
      var tag = savedTag(g);
      el = h('button.gi.gi-item.gi-row', attrs,
        h('span.gi-thumb', UI.art(g, { noName: true, lazy: true }), badges(g, o)),
        h('span.gi-main',
          h('span.gi-name', g.name),
          h('span.gi-status.st-' + D.resumeKind(g), statusIcon(g), D.statusText(g), tag ? h('em', ' · ' + tag) : null)),
        h('span.gi-col', D.isApp(g) ? h('span.muted', 'App') : [I('clock'), ' ', U.fmtDuration((g.playTime || 0) + (D.pendingPlay[g.id] || 0))]),
        h('span.gi-col', g.lastPlayed ? U.timeAgo(g.lastPlayed) : 'Never'),
        h('span.gi-col.gi-wide', g.source === 'link' ? 'Website' : U.fmtBytes(g.size || 0)),
        h('span.gi-col.gi-wide', g.folder ? [I('folder'), ' ', g.folder] : h('span.muted', '—')));
    } else if (mode === 'icons') {
      el = h('button.gi.gi-item.gi-icon', attrs,
        h('span.gi-art', UI.art(g, { noName: true, lazy: true }), badges(g, o)),
        h('span.gi-name', g.name));
    } else {
      var tag2 = savedTag(g);
      el = h('button.gi.gi-item.gi-card', attrs,
        h('span.gi-art', UI.art(g, { noName: true, lazy: true }), badges(g, o),
          h('span.gi-play', I(D.isApp(g) ? 'win' : 'play'))),
        h('span.gi-body',
          h('span.gi-name', g.name),
          h('span.gi-status.st-' + D.resumeKind(g), statusIcon(g), tag2 || D.statusText(g))));
    }
    return el;
  }
  function statusIcon(g) {
    var k = D.resumeKind(g);
    return I(k === 'save' ? 'save' : (k === 'web' ? 'globe' : (k === 'app' ? 'win' : 'restart')));
  }

  /* ---------------- a folder ---------------- */
  function folderArt(f, games) {
    if (f.cover) {
      var url = URL.createObjectURL(f.cover);
      var img = h('img', { src: url, alt: '', draggable: false });
      img.onload = function () { setTimeout(function () { URL.revokeObjectURL(url); }, 1000); };
      return img;
    }
    var box = h('span.fa-grid');
    games.slice(0, 4).forEach(function (g) { box.appendChild(h('span.fa-cell', UI.art(g, { noName: true, lazy: true }))); });
    for (var i = games.length; i < 4; i++) box.appendChild(h('span.fa-cell.fa-empty'));
    return box;
  }
  function folderEl(n, o, open) {
    var f = n.f;
    var attrs = { 'data-key': n.key, 'data-fid': f.f, 'aria-label': 'Folder ' + f.name + ', ' + n.games.length + ' inside', 'aria-expanded': open ? 'true' : 'false' };
    var count = n.games.length + ' inside';
    if (o.mode === 'list') {
      return h('button.gi.gi-folder.gi-row' + (open ? '.open' : ''), attrs,
        h('span.gi-thumb.fa', folderArt(f, n.games)),
        h('span.gi-main', h('span.gi-name', I('folder'), ' ', f.name), h('span.gi-status', count)),
        h('span.gi-col'), h('span.gi-col'), h('span.gi-col.gi-wide'), h('span.gi-col.gi-wide', h('span.gi-chev', I(open ? 'back' : 'next'))));
    }
    return h('button.gi.gi-folder' + (o.mode === 'icons' ? '.gi-icon' : '.gi-card') + (open ? '.open' : ''), attrs,
      h('span.gi-art.fa', folderArt(f, n.games)),
      o.mode === 'icons' ? h('span.gi-name', f.name) : h('span.gi-body', h('span.gi-name', I('folder'), ' ', f.name), h('span.gi-status', count)));
  }
  function panelEl(n, o, ctl) {
    var f = n.f;
    var name = h('input.fp-name', { value: f.name, maxlength: 40, 'aria-label': 'Folder name', spellcheck: false });
    name.value = f.name;
    function commit() { var v = name.value.trim(); if (v && v !== f.name) Layout.renameFolder(o.screen, f.f, v); else name.value = f.name; }
    name.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } if (e.key === 'Escape') { name.value = f.name; name.blur(); } e.stopPropagation(); });
    name.addEventListener('blur', commit);
    var inner = h('div.gs-grid.gs-inner.mode-' + o.mode, { 'data-container': f.f });
    n.games.forEach(function (g) { inner.appendChild(itemEl(g, o)); });
    var panel = h('div.gf-panel', { 'data-panel': f.f },
      h('div.fp-head',
        h('span.fp-ico', I('folder')),
        o.screen ? name : h('b', f.name),
        h('span.fp-count', n.games.length + ' inside'),
        h('div.grow'),
        o.screen ? h('button.btn.sm.ghost', { title: 'Folder picture', onclick: function () { pickCover(o.screen, f); } }, I('image'), h('span', 'Picture')) : null,
        o.screen ? h('button.btn.sm.ghost', { title: 'Take everything out of this folder', onclick: function () { Layout.ungroup(o.screen, f.f); } }, I('ungroup'), h('span', 'Take all out')) : null,
        h('button.icon-btn.sm', { 'aria-label': 'Close folder', title: 'Close', onclick: function () { ctl.expand(null); } }, I('x'))),
      inner,
      o.screen && n.games.length ? h('p.fp-hint', (isTouch() ? 'Hold and drag' : 'Drag') + ' things out of here to take them out, or onto the folder to add more.') : null);
    if (ctl.renameFirst === f.f) { ctl.renameFirst = null; setTimeout(function () { name.focus(); name.select(); }, 60); }
    return panel;
  }
  function pickCover(screen, f) {
    UI.modal({
      title: 'Folder picture',
      icon: 'image',
      body: h('p', 'Use a picture for "' + f.name + '", or show small pictures of what\'s inside.'),
      actions: [
        f.cover ? { label: 'Show what\'s inside', kind: 'ghost', onClick: function () { Layout.setFolderCover(screen, f.f, null); } } : { label: 'Cancel', kind: 'ghost' },
        { label: 'Pick a picture', icon: 'image', kind: 'primary', onClick: function () {
          var input = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
          document.body.appendChild(input);
          input.addEventListener('change', function () {
            var file = input.files[0];
            input.remove();
            if (file) Layout.setFolderCover(screen, f.f, file).catch(function () { UI.toast('That picture didn\'t work', { type: 'bad' }); });
          });
          input.click();
        } }
      ]
    });
  }
  function isTouch() { return (navigator.maxTouchPoints || 0) > 0 && window.matchMedia && window.matchMedia('(pointer: coarse)').matches; }

  /* ---------------- the whole grid ----------------
     o: { screen ('library' | 'apps' | null), nodes, mode, size, appBadge, onOpen(g), onMenu(g, x, y),
          expanded (folder id), onExpand(fid), addTile: { label, onClick }, emptyEl } */
  function render(host, o) {
    var ctl = { o: o, renameFirst: o.renameFirst || null };
    var grid = h('div.gs-grid.gs-top.mode-' + o.mode + (o.screen ? '.can-drag' : ''), { 'data-container': 'top', role: 'list' });
    grid.style.setProperty('--gs', o.size || 1);
    ctl.el = grid;
    ctl.expand = function (fid) {
      if (o.onExpand) o.onExpand(fid);
      o.expanded = fid;
      draw();
      if (fid) {
        var p = grid.querySelector('.gf-panel');
        if (p) requestAnimationFrame(function () { p.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
      }
    };
    function draw() {
      grid.replaceChildren();
      if (!o.nodes.length && o.emptyEl) { grid.appendChild(o.emptyEl); }
      o.nodes.forEach(function (n) {
        if (n.kind === 'folder') {
          var open = o.expanded === n.f.f;
          grid.appendChild(folderEl(n, o, open));
          if (open) grid.appendChild(panelEl(n, o, ctl));
        } else {
          grid.appendChild(itemEl(n.g, o));
        }
      });
      if (o.addTile) {
        grid.appendChild(h('button.gi.gi-add' + (o.mode === 'list' ? '.gi-row' : (o.mode === 'icons' ? '.gi-icon' : '.gi-card')), { onclick: o.addTile.onClick, 'aria-label': o.addTile.label },
          h('span.gi-art', I('plus')), h('span.gi-name', o.addTile.label)));
      }
      if (moving && moving.screen === o.screen) markMoving(grid);
    }
    draw();
    if (host) host.replaceChildren(grid);

    grid.addEventListener('click', function (e) {
      if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
      var el = e.target.closest('.gi[data-key]');
      if (!el || !grid.contains(el)) return;
      if (moving) { stopMove(); return; }
      if (el.dataset.fid) { ctl.expand(o.expanded === el.dataset.fid ? null : el.dataset.fid); Sound.select(); return; }
      var g = D.get(el.dataset.id);
      if (g && o.onOpen) o.onOpen(g, el);
    });
    grid.addEventListener('contextmenu', function (e) {
      var el = e.target.closest('.gi[data-key]');
      if (!el || !grid.contains(el)) return;
      e.preventDefault();
      if (drag.touchArmed) return; /* the phone's long-press: our own hold handles it */
      openMenu(el, e.clientX, e.clientY);
    });
    grid.addEventListener('keydown', function (e) {
      var el = e.target.closest && e.target.closest('.gi[data-key]');
      if (!el) return;
      if ((e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) {
        e.preventDefault();
        var r = el.getBoundingClientRect();
        openMenu(el, r.left + r.width / 2, r.top + r.height / 2);
      }
    });
    function openMenu(el, x, y) {
      if (el.dataset.fid) { folderMenu(o, ctl, el.dataset.fid, x, y); return; }
      var g = D.get(el.dataset.id);
      if (g && o.onMenu) o.onMenu(g, x, y, { screen: o.screen, key: el.dataset.key });
    }
    var drag = { touchArmed: false };
    if (o.screen) makeDraggable(grid, o, ctl, drag, openMenu);
    return ctl;
  }

  function folderMenu(o, ctl, fid, x, y) {
    var f = Layout.findFolder(o.screen, fid);
    if (!f) return;
    UI.contextMenu(x, y, [
      { icon: 'folder', label: o.expanded === fid ? 'Close' : 'Open', onClick: function () { ctl.expand(o.expanded === fid ? null : fid); } },
      o.screen ? { icon: 'tag', label: 'Rename', onClick: function () { ctl.renameFirst = fid; ctl.expand(fid); } } : null,
      o.screen ? { icon: 'image', label: 'Folder picture', onClick: function () { pickCover(o.screen, f); } } : null,
      o.screen ? { icon: 'move', label: 'Move', onClick: function () { startMove(o.screen, 'f:' + fid); } } : null,
      'sep',
      o.screen ? { icon: 'ungroup', label: 'Take all out', onClick: function () { Layout.ungroup(o.screen, fid); } } : null
    ]);
  }

  /* ---------------- drag to move ---------------- */
  var suppressClickUntil = 0;
  function makeDraggable(root, o, ctl, drag, openMenu) {
    var st = null;
    var listMode = o.mode === 'list';
    root.addEventListener('pointerdown', function (e) {
      if (st || (e.pointerType === 'mouse' && e.button !== 0)) return;
      var el = e.target.closest('.gi[data-key]');
      if (!el || !root.contains(el) || e.target.closest('input')) return;
      st = { el: el, key: el.dataset.key, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse', armed: e.pointerType === 'mouse', dragging: false };
      if (st.touch) st.timer = setTimeout(arm, 380);
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onCancel, true);
      window.addEventListener('keydown', onKey, true);
    });
    /* while holding on a phone, don't let the page scroll */
    root.addEventListener('touchmove', function (e) { if (st && (st.armed && st.touch)) e.preventDefault(); }, { passive: false });
    /* after a hold or a drag, the phone's fake mouse click would close the menu / open the game: swallow it */
    var swallow = false;
    root.addEventListener('touchend', function (e) { if (swallow) { swallow = false; e.preventDefault(); } }, { passive: false });

    function arm() {
      if (!st) return;
      st.armed = true;
      drag.touchArmed = true;
      st.el.classList.add('gi-lift');
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* ignore */ }
    }
    function onMove(e) {
      if (!st || e.pointerId !== st.id) return;
      st.x = e.clientX; st.y = e.clientY;
      var dist = Math.hypot(st.x - st.x0, st.y - st.y0);
      if (!st.dragging) {
        if (!st.armed) { if (dist > 10) end(); return; }
        if (dist > 6) startDrag();
        return;
      }
      e.preventDefault();
      moveDrag();
    }
    function onUp(e) {
      if (!st || e.pointerId !== st.id) return;
      if (st.dragging) { if (st.touch) swallow = true; drop(); return; }
      if (st.touch && st.armed) {
        /* held and let go without moving: options */
        swallow = true;
        suppressClickUntil = Date.now() + 400;
        var el = st.el;
        end();
        openMenu(el, e.clientX, e.clientY);
        return;
      }
      end();
    }
    function onCancel(e) { if (st && e.pointerId === st.id) { if (st.dragging) cancel(); else end(); } }
    function onKey(e) { if (st && st.dragging && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } }

    function startDrag() {
      var el = st.el;
      var r = el.getBoundingClientRect();
      st.dragging = true;
      st.from = el.parentNode.dataset.container;
      st.offX = st.x0 - r.left; st.offY = st.y0 - r.top;
      var ghost = el.cloneNode(true);
      ghost.classList.add('gi-ghost');
      ghost.classList.remove('gi-lift');
      ghost.style.width = r.width + 'px';
      ghost.style.height = r.height + 'px';
      ghost.removeAttribute('data-key');
      document.body.appendChild(ghost);
      st.ghost = ghost;
      el.classList.add('gi-placeholder');
      el.classList.remove('gi-lift');
      root.classList.add('is-dragging');
      document.body.classList.add('gs-dragging');
      /* an open folder closes when you drag the folder itself */
      if (el.dataset.fid && o.expanded === el.dataset.fid) {
        var p = root.querySelector('.gf-panel[data-panel="' + el.dataset.fid + '"]');
        if (p) p.remove();
      }
      st.scroller = scrollParent(root);
      moveDrag();
      tickScroll();
    }
    function moveDrag() {
      st.ghost.style.transform = 'translate(' + (st.x - st.offX) + 'px,' + (st.y - st.offY) + 'px) rotate(-3deg) scale(1.06)';
      var under = document.elementFromPoint(st.x, st.y);
      if (!under) return;
      var el = st.el;
      var target = under.closest('.gi[data-key]');
      var cont = under.closest('.gs-grid[data-container]');
      var isFolderDrag = st.key.indexOf('f:') === 0;
      if (target && (!root.contains(target) || target === el || target.classList.contains('gi-add'))) target = null;
      if (cont && !root.contains(cont)) cont = null;
      if (target) {
        var tc = target.parentNode;
        if (isFolderDrag && tc.dataset.container !== 'top') { clearMerge(); return; }
        var tr = target.getBoundingClientRect();
        var cx = (st.x - tr.left) / tr.width, cy = (st.y - tr.top) / tr.height;
        var center = listMode ? (cy > 0.22 && cy < 0.78 && cx > 0.12 && cx < 0.7) : (cx > 0.22 && cx < 0.78 && cy > 0.15 && cy < 0.8);
        var mergeable = !isFolderDrag && tc.dataset.container === 'top' && el.parentNode.dataset.container === 'top' && target.dataset.key !== st.key;
        if (target.dataset.fid && !isFolderDrag && center) mergeable = true;
        if (center && mergeable) {
          if (st.overKey !== target.dataset.key) {
            clearMerge();
            st.overKey = target.dataset.key;
            /* hold it over the other one for a moment to make a folder */
            st.mergeTimer = setTimeout(function () {
              if (st && st.dragging && st.overKey === target.dataset.key && target.isConnected) {
                st.mergeEl = target;
                target.classList.add('gi-merge');
                try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { /* ignore */ }
              }
            }, 300);
          }
          return;
        }
        clearMerge();
        var after = listMode ? cy > 0.5 : (cx > 0.5);
        var ref = after ? target.nextElementSibling : target;
        if (after && target.dataset.fid) {
          var panel = tc.querySelector('.gf-panel[data-panel="' + target.dataset.fid + '"]');
          if (panel) ref = panel.nextElementSibling;
        }
        if (ref === el || (ref === el.nextElementSibling && el.parentNode === tc)) return;
        flip(root, el, function () { tc.insertBefore(el, ref); });
      } else if (cont && cont !== el.parentNode && !(isFolderDrag && cont.dataset.container !== 'top')) {
        clearMerge();
        var add = cont.querySelector(':scope > .gi-add');
        flip(root, el, function () { cont.insertBefore(el, add || null); });
      } else if (!target) {
        clearMerge();
      }
    }
    function clearMerge() {
      clearTimeout(st.mergeTimer);
      if (st.mergeEl) st.mergeEl.classList.remove('gi-merge');
      st.mergeEl = null;
      st.overKey = null;
    }
    function tickScroll() {
      if (!st || !st.dragging) return;
      var sc = st.scroller;
      if (sc) {
        var r = sc.getBoundingClientRect();
        var edge = 70, speed = 0;
        if (st.y < r.top + edge) speed = -Math.ceil((r.top + edge - st.y) / 5);
        else if (st.y > r.bottom - edge) speed = Math.ceil((st.y - (r.bottom - edge)) / 5);
        if (speed) { sc.scrollTop += speed; moveDrag(); }
      }
      requestAnimationFrame(tickScroll);
    }
    function drop() {
      var el = st.el, key = st.key;
      var mergeKey = st.mergeEl ? st.mergeEl.dataset.key : null;
      var cont = el.parentNode;
      var container = cont && cont.dataset ? cont.dataset.container : 'top';
      var keys = Array.prototype.filter.call(cont.children, function (x) { return x.dataset && x.dataset.key && !x.classList.contains('gi-add'); })
        .map(function (x) { return x.dataset.key; });
      var movedBetween = st.from !== container;
      finish();
      suppressClickUntil = Date.now() + 350;
      if (mergeKey) {
        Layout.merge(o.screen, key, mergeKey).then(function (f) {
          if (!f) return;
          Sound.good();
          if (mergeKey.indexOf('f:') === 0) UI.toast('Added to "' + f.name + '"', { icon: 'folder', sound: false });
          else { ctl.renameFirst = f.f; if (o.onExpand) o.onExpand(f.f); o.expanded = f.f; UI.toast('Folder made! Type a name for it.', { icon: 'folder', sound: false }); }
        });
      } else {
        Sound.select();
        Layout.applyOrder(o.screen, container, keys, movedBetween ? key : null);
      }
    }
    function cancel() { finish(); if (o.onCancelDrag) o.onCancelDrag(); else D.emit('layout'); }
    function finish() {
      if (st.ghost) st.ghost.remove();
      st.el.classList.remove('gi-placeholder', 'gi-lift');
      clearMerge();
      root.classList.remove('is-dragging');
      document.body.classList.remove('gs-dragging');
      end();
    }
    function end() {
      if (!st) return;
      clearTimeout(st.timer);
      if (st.el) st.el.classList.remove('gi-lift');
      st = null;
      setTimeout(function () { drag.touchArmed = false; }, 50);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      window.removeEventListener('keydown', onKey, true);
    }
  }
  function scrollParent(el) {
    var p = el.parentElement;
    while (p && p !== document.body) {
      var cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) return p;
      p = p.parentElement;
    }
    return el.closest('.view') || null;
  }
  /* smooth slide when things move out of the way */
  function flip(root, skip, mutate) {
    var items = Array.prototype.filter.call(root.querySelectorAll('.gi[data-key], .gi-add, .gf-panel'), function (x) { return x !== skip; });
    if (items.length > 300) { mutate(); return; }
    var before = items.map(function (x) { return x.getBoundingClientRect(); });
    mutate();
    items.forEach(function (x, i) {
      var b = x.getBoundingClientRect();
      var dx = before[i].left - b.left, dy = before[i].top - b.top;
      if ((dx || dy) && x.animate) x.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  }

  /* ---------------- keyboard / controller "Move" ---------------- */
  var moving = null;
  function startMove(screen, key) {
    moving = { screen: screen, key: key };
    document.body.classList.add('gs-moving');
    document.querySelectorAll('.gs-top').forEach(markMoving);
    UI.toast('Use the arrow keys (or d-pad) to move it. Enter or A when done.', { icon: 'move', sound: false, timeout: 4000 });
  }
  function markMoving(grid) {
    if (!moving) return;
    var el = grid.querySelector('.gi[data-key="' + moving.key + '"]');
    if (!el) return;
    el.classList.add('gi-moving');
    if (document.activeElement !== el) { try { el.focus({ preventScroll: false }); } catch (e) { el.focus(); } }
  }
  function stopMove() {
    if (!moving) return;
    moving = null;
    document.body.classList.remove('gs-moving');
    document.querySelectorAll('.gi-moving').forEach(function (x) { x.classList.remove('gi-moving'); });
    Sound.good();
  }
  /* dir: 'left' | 'right' | 'up' | 'down' | 'ok' | 'cancel' → true when handled */
  function handleMoveKey(dir) {
    if (!moving) return false;
    if (dir === 'ok' || dir === 'cancel') { stopMove(); return true; }
    var el = document.querySelector('.gi-moving');
    var step = 1;
    if ((dir === 'up' || dir === 'down') && el) {
      var cont = el.parentNode;
      var kids = Array.prototype.filter.call(cont.children, function (x) { return x.classList.contains('gi'); });
      var top0 = kids.length ? kids[0].offsetTop : 0;
      step = Math.max(1, kids.filter(function (x) { return x.offsetTop === top0; }).length);
    }
    var delta = (dir === 'left' || dir === 'up') ? -step : step;
    if (Layout.nudge(moving.screen, moving.key, delta)) Sound.move();
    return true;
  }

  window.Grid = {
    render: render,
    itemEl: itemEl,
    startMove: startMove,
    stopMove: stopMove,
    isMoving: function () { return !!moving; },
    handleMoveKey: handleMoveKey
  };
})();
