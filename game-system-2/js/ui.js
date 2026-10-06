/* Game System 2.0 — UI building blocks: modals, toasts, menus, game art, tilt, spatial navigation. */
(function () {
  'use strict';
  var h = U.h;

  var ICONS = {
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    starFill: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="currentColor"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
    more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    code: '<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
    save: '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v6h8V3M7 21v-7h10v7"/>',
    reload: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    bug: '<path d="M8 9a4 4 0 0 1 8 0v5a4 4 0 0 1-8 0z"/><path d="M4 11h4M16 11h4M4 17h4.5M15.5 17H20M9 4l1.5 2M15 4l-1.5 2M12 13v5"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    fileAdd: '<path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7"/><path d="M13 3l6 6v3M13 3v6h6"/><path d="M18 15v6M15 18h6"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    gamepad: '<path d="M7 7h10a5 5 0 0 1 5 5v.5a4.5 4.5 0 0 1-8.2 2.6L13 14h-2l-.8 1.1A4.5 4.5 0 0 1 2 12.5V12a5 5 0 0 1 5-5z"/><path d="M7 10v4M5 12h4"/><circle cx="16" cy="11" r=".9" fill="currentColor"/><circle cx="18" cy="13" r=".9" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    warn: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.2v.3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.8v.3"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>',
    scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5L20 18M8 16.5L20 6"/>',
    lifebuoy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/>',
    box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    library: '<rect x="3" y="4" width="4" height="16" rx="1"/><rect x="9" y="4" width="4" height="16" rx="1"/><path d="M15.5 5.2l3.8-1 3.4 14.6-3.8 1z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14.5 8.5l2 2"/>',
    database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.4-2l-.3-.8c-.4-1.1.4-2.2 1.6-2.2H17a4 4 0 0 0 4-4c0-5-4-9-9-9z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7" r="1.2" fill="currentColor"/><circle cx="15.5" cy="7.5" r="1.2" fill="currentColor"/>',
    volume: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    power: '<path d="M12 3v9"/><path d="M6.3 7a8 8 0 1 0 11.4 0"/>',
    flame: '<path d="M12 21c-4 0-7-2.8-7-6.8 0-3.6 2.6-5.6 4-8.2.7 1.6 1.4 2.6 2.6 3.2C12 6 13 4 15.5 3c-.5 3 .5 4.6 2 6.4 1.3 1.6 1.5 3 1.5 4.8C19 18.2 16 21 12 21z"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M9 20h6M12 14v6"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    resume: '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/><path d="M10 9v6l5-3z" fill="currentColor"/>',
    restart: '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/>',
    exit: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3" fill="currentColor"/>',
    text: '<path d="M4 6h16M4 12h10M4 18h13"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
    inbox: '<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1.5 3h5L16 13h5"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
    selectAll: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    js: '<path d="M10 7v8a2 2 0 0 1-4 0M18 8.5a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 2 0 2.8 5 1.6 5 4.5 0 1.2-1.1 2-2.5 2A2.6 2.6 0 0 1 13 14"/>',
    css: '<path d="M8 7H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M14 7h-2a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-2M20 7h-2a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-2"/>',
    braces: '<path d="M8 4H7a2 2 0 0 0-2 2v4l-2 2 2 2v4a2 2 0 0 0 2 2h1M16 4h1a2 2 0 0 1 2 2v4l2 2-2 2v4a2 2 0 0 1-2 2h-1"/>',
    dot: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
    car: '<path d="M5 15l1.5-5.2A2 2 0 0 1 8.4 8.4h7.2a2 2 0 0 1 1.9 1.4L19 15"/><rect x="3" y="15" width="18" height="4" rx="1.5"/><circle cx="7.5" cy="19.5" r="1.5"/><circle cx="16.5" cy="19.5" r="1.5"/>',
    sword: '<path d="M14.5 3.5H20.5v6L10 20l-6-6z"/><path d="M8 11.5l4.5 4.5M3 21l3.5-3.5"/>',
    rocket: '<path d="M12 2.5c3.2 2.2 5 5.8 5 10.5l-2 3H9l-2-3c0-4.7 1.8-8.3 5-10.5z"/><circle cx="12" cy="10" r="1.8"/><path d="M9 16l-2.5 4.5M15 16l2.5 4.5M12 17v4.5"/>',
    skull: '<path d="M12 3a8 8 0 0 0-8 8c0 2.8 1.4 4.5 3 5.5V20h10v-3.5c1.6-1 3-2.7 3-5.5a8 8 0 0 0-8-8z"/><circle cx="9" cy="11.5" r="1.7"/><circle cx="15" cy="11.5" r="1.7"/><path d="M10 20v-2.2M14 20v-2.2"/>',
    crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
    ghost: '<path d="M5 21V11a7 7 0 0 1 14 0v10l-2.5-2-2.3 2-2.2-2-2.2 2-2.3-2z"/><circle cx="9.5" cy="11" r="1.1"/><circle cx="14.5" cy="11" r="1.1"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/>',
    cards: '<rect x="3.5" y="6.5" width="10" height="14" rx="2" transform="rotate(-12 8.5 13.5)"/><rect x="10.5" y="3.5" width="10" height="14" rx="2"/><path d="M15.5 8l1.8 2.5-1.8 2.5-1.8-2.5z"/>',
    castle: '<path d="M4 21V9h2.5v2.5h2V9h2.5v2.5h2V9h2.5v2.5h2V9H20v12z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
    tree: '<path d="M12 3l6 8h-3l4 6H5l4-6H6z"/><path d="M12 17v4"/>',
    planet: '<circle cx="12" cy="12" r="6"/><path d="M3.2 15.2c-.9-2 4.1-5.3 9-6.8s9.6-1.6 10.4.4-3.9 5-8.9 6.6-9.6 1.8-10.5-.2z"/>',
    heart: '<path d="M12 20s-7.5-4.5-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.5 12 20 12 20z"/>',
    bomb: '<circle cx="10.5" cy="14" r="6.5"/><path d="M15 9.5l2.5-2.5M18 3.5l.6 1.8M21 6l-1.8.4M19.8 2.8l-.9 1.6"/>',
    gem: '<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M12 20L8.5 9 10 4M12 20l3.5-11L14 4"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.6 9.2a3 3 0 0 0-2.6-1.2c-1.4 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.9 2.5 2.1-1.1 1.9-2.5 1.9a3 3 0 0 1-2.6-1.2M12 6.5v11"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="M3.6 9.6c3 1 6 4 7 10M20.4 9.6c-3 1-6 4-7 10M7 4.6c1.5 2 3 3 5 3s3.5-1 5-3"/>',
    plane: '<path d="M21 3.5L3 11l7 2.5 2.5 7z"/><path d="M10 13.5L21 3.5"/>',
    fish: '<path d="M3 12c3-4 7-6 11-6 3 0 5 2.5 7 6-2 3.5-4 6-7 6-4 0-8-2-11-6z"/><path d="M3 12L1.5 8.5M3 12l-1.5 3.5"/><circle cx="16" cy="11" r="1" fill="currentColor"/>',
    paw: '<circle cx="6.5" cy="9.5" r="2"/><circle cx="12" cy="6.5" r="2"/><circle cx="17.5" cy="9.5" r="2"/><path d="M12 12c-3 0-6 3.5-6 6 0 2 2 2.5 3 2 1.5-.8 4.5-.8 6 0 1 .5 3 0 3-2 0-2.5-3-6-6-6z"/>',
    spiral: '<path d="M12 12a1 1 0 1 1 1-1 2.5 2.5 0 1 1-3.5-2.3 4.5 4.5 0 1 1-1.6 7.8 6.8 6.8 0 1 1 11.6-4.5"/>',
    slots: '<rect x="3" y="5" width="15" height="15" rx="2"/><path d="M6.5 9v7M10.5 9v7M14.5 9v7M18 10.5h2.5v5"/><circle cx="20.5" cy="8.2" r="1.4"/>',
    brick: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 12h18M9 5v7M15 12v7"/>'
  };
  function icon(name, cls) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'ico' + (cls ? ' ' + cls : ''));
    s.innerHTML = ICONS[name] || '';
    return s;
  }

  /* ---------------- modals ---------------- */
  var stack = [];

  function modal(opts) {
    opts = opts || {};
    var dismissible = opts.dismissible !== false;
    var closed = false;
    var prevFocus = document.activeElement;
    var back = h('div.modal-back');
    var box = h('div.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Dialog' });
    if (opts.wide) box.classList.add('wide');
    if (opts.xwide) box.classList.add('xwide');
    if (opts.className) box.className += ' ' + opts.className;
    var titleText = h('span', opts.title || '');
    var title = h('h2', opts.icon ? icon(opts.icon) : null, titleText);
    var head = h('div.modal-head', title,
      dismissible ? h('button.icon-btn.sm.modal-x', { 'aria-label': 'Close', title: 'Close (Esc)', onclick: function () { m.close('x'); } }, icon('x')) : null);
    var body = h('div.modal-body');
    if (opts.body != null) {
      if (typeof opts.body === 'string') body.appendChild(h('p', opts.body));
      else body.appendChild(opts.body);
    }
    var foot = null;
    if (opts.actions && opts.actions.length) {
      foot = h('div.modal-foot');
      opts.actions.forEach(function (a) {
        if (!a) return;
        var b = h('button.btn' + (a.kind ? '.' + a.kind : ''), {
          onclick: function () {
            var r = a.onClick ? a.onClick(m) : undefined;
            if (r && typeof r.then === 'function') {
              b.disabled = true;
              r.then(function (v) { b.disabled = false; if (v !== false && a.close !== false) m.close('action'); },
                function () { b.disabled = false; });
              return;
            }
            if (r !== false && a.close !== false) m.close('action');
          }
        }, a.icon ? icon(a.icon) : null, a.label);
        if (a.autofocus) b.setAttribute('data-autofocus', '');
        if (a.id) b.id = a.id;
        foot.appendChild(b);
      });
    }
    box.appendChild(head);
    box.appendChild(body);
    if (foot) box.appendChild(foot);
    back.appendChild(box);
    back.addEventListener('mousedown', function (e) {
      if (e.target === back && dismissible) m.close('backdrop');
    });
    document.getElementById('modals').appendChild(back);

    var m = {
      el: box, body: body, foot: foot, back: back,
      setTitle: function (t) { titleText.textContent = t; },
      isOpen: function () { return !closed; },
      close: function (reason) {
        if (closed) return;
        closed = true;
        var i = stack.indexOf(m);
        if (i >= 0) stack.splice(i, 1);
        back.classList.add('closing');
        setTimeout(function () { back.remove(); }, 180);
        if (opts.onClose) { try { opts.onClose(reason); } catch (e) { console.error(e); } }
        if (prevFocus && prevFocus.focus && document.contains(prevFocus)) { try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      },
      dismissible: dismissible
    };
    stack.push(m);
    setTimeout(function () {
      if (closed) return;
      var f = box.querySelector('[data-autofocus]') || box.querySelector('.modal-body input:not([type=checkbox]):not([type=file]), .modal-body textarea') ||
        (foot && (foot.querySelector('.btn.primary') || foot.querySelector('.btn'))) || box.querySelector('button');
      if (f) try { f.focus(); } catch (e) { /* ignore */ }
    }, 40);
    if (window.Sound) Sound.open();
    return m;
  }

  function topModal() { return stack[stack.length - 1] || null; }

  document.addEventListener('keydown', function (e) {
    var m = topModal();
    if (!m) return;
    if (e.key === 'Escape' && m.dismissible) {
      e.preventDefault();
      e.stopPropagation();
      if (window.Sound) Sound.back();
      m.close('esc');
      return;
    }
    if (e.key === 'Tab') {
      var f = focusables(m.back);
      if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
    }
  }, true);

  function confirmBox(title, message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var done = false;
      modal({
        title: title,
        icon: opts.icon,
        body: typeof message === 'string' ? h('p', message) : message,
        actions: [
          { label: opts.cancel || 'Cancel', kind: 'ghost', onClick: function () { done = true; resolve(false); } },
          { label: opts.ok || 'OK', kind: opts.danger ? 'danger' : 'primary', autofocus: !opts.danger, onClick: function () { done = true; resolve(true); } }
        ],
        onClose: function () { if (!done) resolve(false); }
      });
    });
  }

  function promptBox(title, label, value, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var done = false;
      var input = h('input.input', { value: value || '', placeholder: opts.placeholder || '', maxlength: opts.max || 200 });
      input.value = value || '';
      var body = h('div', opts.text ? h('p', opts.text) : null, h('div.field', h('label', label), input));
      var mm = modal({
        title: title,
        icon: opts.icon,
        body: body,
        actions: [
          { label: 'Cancel', kind: 'ghost', onClick: function () { done = true; resolve(null); } },
          { label: opts.ok || 'OK', kind: 'primary', onClick: function () { done = true; resolve(input.value.trim()); } }
        ],
        onClose: function () { if (!done) resolve(null); }
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); done = true; resolve(input.value.trim()); mm.close('enter'); }
      });
      setTimeout(function () { input.focus(); input.select(); }, 60);
    });
  }

  function alertBox(title, message, ok, ic) {
    return new Promise(function (resolve) {
      modal({ title: title, icon: ic, body: message, actions: [{ label: ok || 'Got it', kind: 'primary', onClick: function () {} }], onClose: function () { resolve(); } });
    });
  }

  /* ---------------- toasts ---------------- */
  var TOAST_ICON = { info: 'info', good: 'check', warn: 'warn', bad: 'alert' };
  function toast(msg, opts) {
    opts = opts || {};
    var type = opts.type || 'info';
    var wrap = document.getElementById('toasts');
    while (wrap.children.length >= 4) wrap.firstChild.remove();
    var t = h('div.toast.' + type, { role: type === 'bad' ? 'alert' : 'status' },
      h('div.t-ico', icon(opts.icon && ICONS[opts.icon] ? opts.icon : (TOAST_ICON[type] || 'info'))),
      h('div.t-msg', opts.title ? h('b', opts.title) : null, msg,
        opts.actions ? h('div.t-act', opts.actions.map(function (a) {
          return h('button.btn.sm' + (a.kind ? '.' + a.kind : ''), { onclick: function () { close(); if (a.onClick) a.onClick(); } }, a.label);
        })) : null),
      h('button.icon-btn.sm', { 'aria-label': 'Dismiss', onclick: function () { close(); } }, icon('x')));
    wrap.appendChild(t);
    var timer = null;
    var timeout = opts.timeout == null ? (type === 'bad' ? 7000 : 4200) : opts.timeout;
    function close() {
      clearTimeout(timer);
      if (!t.isConnected) return;
      t.classList.add('out');
      setTimeout(function () { t.remove(); }, 300);
    }
    if (timeout) {
      timer = setTimeout(close, timeout);
      t.addEventListener('mouseenter', function () { clearTimeout(timer); });
      t.addEventListener('mouseleave', function () { timer = setTimeout(close, 2000); });
    }
    if (window.Sound) { if (type === 'bad') Sound.error(); else if (opts.sound !== false) Sound.toast(); }
    return { close: close, el: t };
  }

  /* ---------------- context menu ---------------- */
  var openMenu = null;
  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
  function contextMenu(x, y, items) {
    closeMenu();
    var menu = h('div.ctx-menu', { role: 'menu' });
    items.forEach(function (it) {
      if (!it) return;
      if (it === 'sep') { menu.appendChild(h('div.sep')); return; }
      menu.appendChild(h('button' + (it.danger ? '.danger' : ''), {
        role: 'menuitem',
        onclick: function () { closeMenu(); if (window.Sound) Sound.select(); it.onClick(); }
      }, it.icon && ICONS[it.icon] ? icon(it.icon) : h('span'), it.label));
    });
    document.body.appendChild(menu);
    var r = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + 'px';
    openMenu = menu;
    setTimeout(function () { var b = menu.querySelector('button'); if (b) b.focus(); }, 10);
    return menu;
  }
  document.addEventListener('mousedown', function (e) { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }, true);
  document.addEventListener('keydown', function (e) { if (openMenu && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); } }, true);
  window.addEventListener('blur', closeMenu);
  window.addEventListener('resize', closeMenu);

  /* ---------------- game art ---------------- */
  function art(game, opts) {
    opts = opts || {};
    var url = game && game.cover ? D.coverUrl(game) : null;
    if (url) return h('img', { src: url, alt: '', draggable: false, loading: opts.lazy ? 'lazy' : null, decoding: 'async' });
    var c = (game && game.color) || U.colorFor(game ? game.name : '?');
    /* no picture yet: neon letters (or the emoji, if the player picked one) */
    var face = game && game.art === 'emoji' && game.emoji
      ? h('span.pe', game.emoji)
      : h('span.pl', initials(game ? game.name : '?'));
    var p = h('div.proc', face, opts.noName ? null : h('span.pn', game ? game.name : ''));
    p.style.setProperty('--c', c);
    if (opts.emojiSize) p.style.setProperty('--es', opts.emojiSize + 'px');
    return p;
  }

  /* "Space Blaster" -> "SB", "snake" -> "S" */
  function initials(name) {
    var words = String(name || '?').split(/[\s_\-:]+/).map(function (w) { return w.replace(/[^\p{L}\p{N}]/gu, ''); }).filter(Boolean);
    if (!words.length) return '?';
    return (words[0].charAt(0) + (words[1] ? words[1].charAt(0) : '')).toUpperCase();
  }
  function iconMarkup(name) { return ICONS[name] || ''; }

  /* Hold a finger on something (phones have no right-click). Android also fires
     contextmenu on long-press, so skip ours when that already happened. */
  var lastCtx = 0;
  document.addEventListener('contextmenu', function () { lastCtx = Date.now(); }, true);
  function longPress(el, fn) {
    var timer = null, sx = 0, sy = 0, fired = false;
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      fired = false;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (Date.now() - lastCtx < 800) return;
        fired = true;
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) { /* ignore */ } }
        fn(sx, sy);
      }, 600);
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      var p = e.touches[0];
      if (Math.abs(p.clientX - sx) > 10 || Math.abs(p.clientY - sy) > 10) clearTimeout(timer);
    }, { passive: true });
    el.addEventListener('touchend', function (e) { clearTimeout(timer); if (fired) e.preventDefault(); });
    el.addEventListener('touchcancel', function () { clearTimeout(timer); });
  }

  /* 3D tilt that follows the mouse */
  function tilt(el, max) {
    max = max || 10;
    var raf = 0, rx = 0, ry = 0;
    function apply() {
      raf = 0;
      el.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
    }
    el.addEventListener('mousemove', function (e) {
      var r = el.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      ry = (px - 0.5) * max * 2;
      rx = -(py - 0.5) * max * 2;
      el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      if (!raf) raf = requestAnimationFrame(apply);
    });
    el.addEventListener('mouseleave', function () {
      rx = ry = 0;
      if (!raf) raf = requestAnimationFrame(apply);
    });
  }

  /* ---------------- emoji picker ---------------- */
  var EMOJIS = ('🎮 🕹️ 👾 🎰 🎲 🃏 ♠️ 🌀 🔫 💣 🗡️ ⚔️ 🛡️ 🏹 🧟 👻 💀 🤖 👽 🚀 🛸 🌌 🪐 ⭐ 🔥 ⚡ 💎 💰 🪙 🏆 👑 🏎️ 🚗 🏍️ ✈️ 🚁 🚢 🏴‍☠️ ⚽ 🏀 🏈 ⚾ 🎾 🏐 ⛳ 🥊 🎯 🎳 🏓 🧩 ♟️ 🧠 🔬 🧪 ⛏️ 🧱 🏠 🏰 🌳 🌋 🏝️ 🐍 🐉 🦖 🐦 🐟 🐱 🐶 🦊 🐺 🦈 🍔 🍕 🍺 🍹 🍪 🎵 🎸 🎨 📦 🔑 🗺️ 🧭 ❤️ 💜 💙 💚 😎 😈 🤑 🥷 🧙 🦸 🕵️').split(' ');
  function pickEmoji(current) {
    return new Promise(function (resolve) {
      var done = false;
      var grid = h('div.emoji-grid');
      var custom = h('input.input', { placeholder: 'Or type/paste any emoji', maxlength: 8 });
      var mm = modal({
        title: 'Pick a game icon',
        body: h('div', grid, h('div.hr'), h('div.row', custom, h('button.btn', { onclick: function () { if (custom.value.trim()) { done = true; resolve(custom.value.trim()); mm.close(); } } }, 'Use'))),
        onClose: function () { if (!done) resolve(null); }
      });
      EMOJIS.forEach(function (e) {
        grid.appendChild(h('button' + (e === current ? '.on' : ''), { onclick: function () { done = true; resolve(e); mm.close(); }, title: e }, e));
      });
    });
  }

  /* ---------------- spatial navigation (arrow keys + controller) ---------------- */
  function visible(el) {
    if (!el || el.disabled) return false;
    if (el.closest('[hidden]')) return false;
    var v = el.closest('.view');
    if (v && !v.classList.contains('active')) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (r.bottom < 0 || r.top > window.innerHeight + 400) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }
  function focusables(root) {
    return Array.prototype.slice.call(root.querySelectorAll(
      'button, a[href], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(visible);
  }
  function navRoot() {
    var m = topModal();
    if (m) return m.back;
    if (openMenu) return openMenu;
    var qm = document.getElementById('quick-menu');
    if (qm && !qm.hidden) return qm;
    var app = document.getElementById('app');
    if (!app.hidden && document.getElementById('player').hidden) return app;
    return null;
  }
  function moveFocus(dir) {
    var root = navRoot();
    if (!root) return false;
    var list = focusables(root);
    if (!list.length) return false;
    var cur = document.activeElement;
    if (!cur || list.indexOf(cur) < 0) {
      var start = root.querySelector('.tile.sel') || root.querySelector('[data-autofocus]') || list[0];
      start.focus();
      return true;
    }
    var r = cur.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var best = null, bestScore = Infinity;
    list.forEach(function (el) {
      if (el === cur) return;
      var b = el.getBoundingClientRect();
      var x = b.left + b.width / 2, y = b.top + b.height / 2;
      var dx = x - cx, dy = y - cy, along, orth;
      var sameRow = b.bottom > r.top + 4 && b.top < r.bottom - 4;
      if (dir === 'right') { if (!sameRow || (b.left < r.right - 6 && dx <= 6)) return; along = dx; orth = Math.abs(dy); }
      else if (dir === 'left') { if (!sameRow || (b.right > r.left + 6 && dx >= -6)) return; along = -dx; orth = Math.abs(dy); }
      else if (dir === 'down') { if (b.top < r.bottom - 6 && dy <= 6) return; along = dy; orth = Math.abs(dx); }
      else { if (b.bottom > r.top + 6 && dy >= -6) return; along = -dy; orth = Math.abs(dx); }
      if (along <= 0) return;
      var score = along + orth * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) {
      best.focus();
      best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      if (window.Sound) Sound.move();
      return true;
    }
    return false;
  }

  function isTyping(el) {
    el = el || document.activeElement;
    if (!el) return false;
    if (el.closest && el.closest('.CodeMirror')) return true;
    var tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') return !/^(checkbox|radio|button|submit|range|color|file)$/i.test(el.type);
    return !!el.isContentEditable;
  }

  window.UI = {
    icon: icon, hasIcon: function (n) { return !!ICONS[n]; }, iconMarkup: iconMarkup, initials: initials, modal: modal, topModal: topModal, confirm: confirmBox, prompt: promptBox, alert: alertBox,
    toast: toast, contextMenu: contextMenu, longPress: longPress, closeMenu: closeMenu, art: art, tilt: tilt, pickEmoji: pickEmoji,
    moveFocus: moveFocus, focusables: focusables, isTyping: isTyping, modalCount: function () { return stack.length; }
  };
})();
