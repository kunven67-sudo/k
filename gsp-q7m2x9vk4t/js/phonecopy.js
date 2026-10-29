/* Copy to my phone: the QR code to scan with the phone's camera, and how the copying goes. */
import { h } from './dom.js';
import { modal } from './modal.js';
import { icon } from './icons.js';

export async function openPhoneCopy(toast) {
  const status = h('div.ph-status', 'Starting…');
  const qr = h('img.ph-qr', { alt: 'QR code' });
  const addr = h('div.ph-addr');
  const steps = h('ol.ph-steps',
    h('li', 'Phone on the same Wi-Fi as this PC.'),
    h('li', 'Open the phone\'s camera and point it at the code.'),
    h('li', 'Tap the link, then "Copy to my phone".'));
  const body = h('div.ph', h('div.ph-left', qr, addr), h('div.ph-right', steps, status));
  let off = null;
  const m = modal({
    title: 'Copy to my phone',
    lead: 'Your games, their saves, covers and your console sounds go to Game System 3 on your phone.',
    body: body,
    wide: true,
    onClose: function () { if (off) off(); window.gs.invoke('phone:stop'); },
    actions: (window.gs.platform === 'win32' ? [{ label: 'Phone can\'t open it?', icon: 'shield', onClick: function () { fixFirewall(status); return false; } }] : [])
      .concat([{ label: 'Close', kind: 'primary', default: true }])
  });
  try {
    const r = await window.gs.invoke('phone:start');
    qr.src = r.qr;
    addr.textContent = r.url;
    const gb = r.bytes >= 1073741824 ? (r.bytes / 1073741824).toFixed(1) + ' GB' : Math.max(1, Math.round(r.bytes / 1048576)) + ' MB';
    status.textContent = r.games + (r.games === 1 ? ' game' : ' games') + ' ready to copy (' + gb + '). Waiting for your phone…';
    if (/^127\./.test(r.ip)) status.textContent = 'This PC isn\'t on Wi-Fi or a network right now, so the phone can\'t reach it.';
  } catch (e) {
    status.textContent = 'Couldn\'t start: ' + (e && e.message || e);
  }
  off = window.gs.on('phone:status', function (s) {
    if (!s) return;
    if (s.step === 'opened') status.textContent = 'Your phone opened the page. Tap "Copy to my phone" on it.';
    if (s.step === 'copying') status.textContent = 'Copying to your phone… keep both on.';
    if (s.step === 'done') {
      status.innerHTML = '';
      status.appendChild(h('span', { html: icon('check') }));
      status.appendChild(document.createTextNode(' Done! ' + s.games + (s.games === 1 ? ' game is' : ' games are') + ' on your phone.'));
      status.classList.add('ok');
      if (toast) toast({ kind: 'good', icon: 'check', title: 'Copied to your phone', text: s.games + (s.games === 1 ? ' game' : ' games') + ' with their saves.' });
    }
  });
  return m;
}

/* the phone page spins forever = Windows' firewall keeps the phone out: one click lets Game System 3 in */
let fixing = false;
async function fixFirewall(status) {
  if (fixing) return;
  fixing = true;
  status.classList.remove('ok');
  status.textContent = 'Windows will ask "Do you want to allow this app to make changes?" Click Yes.';
  const r = await window.gs.invoke('phone:firewall').catch(function () { return { ok: false }; });
  fixing = false;
  if (r && r.ok) status.textContent = 'Fixed. Windows lets your phone in now. Scan the code again (or reload the page on your phone).';
  else if (r && r.why === 'said no') status.textContent = 'Nothing changed (Windows was told no). Press "Phone can\'t open it?" again and click Yes.';
  else status.textContent = 'That didn\'t work. Check that the phone is on the same Wi-Fi as this PC, not on mobile data.';
}
