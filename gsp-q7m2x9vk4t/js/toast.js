/* Small corner pop-ups (top right, never the middle), ~3 seconds. */
import { h } from './dom.js';
import { icon } from './icons.js';

const KIND_ICON = { good: 'check', warn: 'warn', bad: 'warn', info: 'info', shot: 'camera', save: 'save' };

export function makeToaster(root, onEmpty) {
  let count = 0;
  return function toast(opts) {
    if (typeof opts === 'string') opts = { text: opts };
    const kind = opts.kind || 'info';
    const lead = opts.thumb ? h('div.thumb', { style: { backgroundImage: 'url("' + opts.thumb + '")' } }) : h('div.ic', { html: icon(opts.icon || KIND_ICON[kind] || 'info') });
    const body = h('div', { style: { minWidth: 0, flex: '1' } },
      opts.title ? h('div.tt', opts.title) : null,
      h(opts.title ? 'div.ts' : 'div', opts.text || ''));
    const el = h('div.toast.' + kind, lead, body);
    if (opts.button) {
      el.appendChild(h('button.tbtn', { onclick: function () { opts.button.onClick(); close(); } }, opts.button.label));
    }
    count++;
    root.appendChild(el);
    while (root.children.length > 4) root.firstChild.remove();
    let gone = false;
    function close() {
      if (gone) return;
      gone = true;
      el.classList.add('out');
      setTimeout(function () {
        el.remove();
        count--;
        if (!root.children.length && onEmpty) onEmpty();
      }, 260);
    }
    setTimeout(close, opts.timeout || 3200);
    return close;
  };
}
