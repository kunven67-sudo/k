// "Where should this work?" picker, shared by the Apps page and the Voice page.
import { h, section, chips, button, toast } from '../lib.js';
import { nav } from '../nav.js';

const cv = window.cv;

export function targetEditor(title, target, save, note) {
  const box = h('div');
  const running = h('div', { class: 'list' }, h('small', {}, 'Click "Refresh" to see apps that are open right now.'));
  const addApp = async (app) => {
    const exe = String(app.exe || '').toLowerCase().trim();
    if (!exe) return;
    if (target.apps.some((a) => a.exe === exe)) { toast('Already in the list 👍'); return; }
    target = { ...target, apps: [...target.apps, { exe, name: app.name || exe }] };
    await save(target);
    toast(`➕ Added ${app.name || exe}`, 'good');
    nav.refresh();
  };

  box.append(
    chips({
      value: target.mode,
      options: [{ value: 'all', label: 'Everywhere (whole PC)', emoji: '🌍' }, { value: 'apps', label: 'Only the apps I pick', emoji: '🎯' }],
      onChange: async (v) => { await save({ ...target, mode: v }); nav.refresh(); },
    }),
    note ? h('p', { class: 'hint' }, note) : null,
  );
  if (target.mode === 'apps') {
    box.append(
      h('h3', { style: { marginTop: '16px' } }, `✅ Picked apps (${target.apps.length})`),
      target.apps.length ? h('div', { class: 'list' }, target.apps.map((a) => h('div', { class: 'item' },
        h('span', { class: 'grow' }, h('b', {}, a.name || a.exe), ' ', h('small', {}, a.exe)),
        button('✖ Remove', async () => { await save({ ...target, apps: target.apps.filter((x) => x.exe !== a.exe) }); nav.refresh(); }, 'small'))))
        : h('p', { class: 'muted' }, 'No apps yet. Add some below 👇 (CursorVerse itself always counts.)'),
      h('h3', { style: { marginTop: '16px' } }, '➕ Add an app'),
      h('div', { class: 'row' },
        button('🖱️ Pick by clicking it', async () => {
          toast('Now click on the app you want (you have 15 seconds) 👆', 'info', 4000);
          const app = await cv.apps.pick();
          if (app) addApp(app); else toast('Did not catch an app 😅 try again', 'bad');
        }, 'primary'),
        button('🔄 Refresh open apps', async () => {
          const { running: list } = await cv.apps.list();
          running.replaceChildren(...(list.length ? list.map((a) => h('div', { class: 'item' }, h('span', { class: 'grow' }, a.name, ' ', h('small', {}, a.exe)), button('Add', () => addApp(a), 'small'))) : [h('small', {}, 'No open apps found.')]));
        })),
      h('div', { style: { marginTop: '10px' } }, running),
      h('h3', { style: { marginTop: '16px' } }, '⭐ Popular apps'),
      h('div', { class: 'chips' }, COMMON.map((a) => h('button', { class: 'chip', onclick: () => addApp(a) }, a.name))),
      h('div', { class: 'row', style: { marginTop: '12px' } },
        h('input', { class: 'text', style: { maxWidth: '260px' }, placeholder: 'or type an .exe name, like game.exe', id: 'exe-input' }),
        button('Add', () => {
          const el = box.querySelector('#exe-input');
          let v = el.value.trim().toLowerCase();
          if (!v) return;
          if (!v.endsWith('.exe')) v += '.exe';
          addApp({ exe: v, name: v.replace(/\.exe$/, '') });
        })),
    );
  }
  return section(title, box);
}

const COMMON = [
  { exe: 'chrome.exe', name: 'Google Chrome' }, { exe: 'msedge.exe', name: 'Microsoft Edge' }, { exe: 'firefox.exe', name: 'Firefox' },
  { exe: 'opera.exe', name: 'Opera / Opera GX' }, { exe: 'discord.exe', name: 'Discord' }, { exe: 'spotify.exe', name: 'Spotify' },
  { exe: 'steam.exe', name: 'Steam' }, { exe: 'robloxplayerbeta.exe', name: 'Roblox' }, { exe: 'javaw.exe', name: 'Minecraft (Java)' },
  { exe: 'minecraft.windows.exe', name: 'Minecraft (Bedrock)' }, { exe: 'fortniteclient-win64-shipping.exe', name: 'Fortnite' },
  { exe: 'code.exe', name: 'VS Code' }, { exe: 'explorer.exe', name: 'File Explorer / Desktop' }, { exe: 'notepad.exe', name: 'Notepad' },
  { exe: 'winword.exe', name: 'Word' }, { exe: 'excel.exe', name: 'Excel' },
];
