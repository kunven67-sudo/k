// Main menu (live lab behind frosted glass), new world, load, pause, settings, help, game over,
// character maker, saving.
import * as THREE from 'three';
import { h, put, clear, btn, seg, slider, toggle, setrow, colorInput } from './dom.js';
import { settings, saveSettings, KEY_LABELS, DEFAULT_KEYS, keyName } from '../core/settings.js';
import { setQualityChoice } from '../core/quality.js';
import { applyVolumes, playTrack, playMp3, TRACKS, initAudio, sfx } from '../core/audio.js';
import { lockPointer, unlockPointer, input } from '../core/input.js';
import { THEMES } from '../world/cage.js';
import { CLAUDE_MODELS, loadLocal, localState } from '../talk/llm.js';
import { listWorlds, getWorld, putWorld, deleteWorld, newId, downloadWorld, readWorldFile } from '../save.js';
import { Preview } from './preview.js';
import { Body, poseTargets } from '../life/body.js';
import { scientistLook, SKIN, HAIR_COLORS } from '../life/looks.js';
import { HAIR_STYLES } from '../life/parts.js';
import { rand, escapeHtml } from '../core/util.js';

const HAND_SVG = '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg"><path fill="#dff" d="M30 115c-12-8-22-30-24-44-1-8 8-10 12-2l8 16V20c0-8 11-8 11 0v38h3V10c0-8 11-8 11 0v48h3V14c0-8 11-8 11 0v46h3V26c0-8 11-8 11 0v50c0 22-10 34-20 39z"/></svg>';

export function buildMenus(ui) {
  const g = ui.g;
  const M = {};
  let menuEl = null;
  let menuT = 0, bangT = 4;

  // ------------------------------------------------------------- main menu
  M.main = () => {
    ui.state = 'menu';
    ui.close(true);
    ui.showHud(false);
    unlockPointer();
    if (menuEl) menuEl.remove();
    menuEl = h('div', { id: 'menu' },
      h('div', { class: 'logo-glass' },
        h('h1', { class: 'logo' }, 'TERRARIUM'),
        h('div', { class: 'logo-sub' }, 'shrink them · keep them · watch them live'),
        h('div', { class: 'handprint', html: HAND_SVG }),
        h('div', { class: 'menu-btns' },
          btn('Play (new world)', () => M.newWorld(), 'primary'),
          btn('Load', () => M.load()),
          btn('Your look', () => M.character()),
          btn('Settings', () => M.settings()),
          btn('Controls', () => M.help()),
        ),
      ),
      h('div', { class: 'menu-foot' }, 'TERRARIUM · early playable · everything is saved in this browser'),
    );
    put(ui.root, menuEl);
  };

  M.hideMain = () => { if (menuEl) { menuEl.remove(); menuEl = null; } };

  // the camera drifts around the dark lab and the glowing cage
  M.menuCamera = (cam, dt) => {
    menuT += dt;
    const a = 0.6 + Math.sin(menuT * 0.05) * 0.5;
    const r = 2.5 + Math.sin(menuT * 0.07) * 0.3;
    cam.position.set(Math.sin(a) * r + 0.4, 1.45 + Math.sin(menuT * 0.09) * 0.12, -0.5 + Math.cos(a) * r);
    cam.lookAt(-0.35, 1.0, -0.55);
    cam.near = 0.01; cam.far = 200; cam.updateProjectionMatrix();
    // one of them bangs on the glass and yells
    bangT -= dt;
    if (bangT <= 0) {
      bangT = 9 + Math.random() * 8;
      const p = g.people.filter((q) => q.alive && !q.kid && q.inCage).sort((x, y) => x.pos.distanceTo(cam.position) - y.pos.distanceTo(cam.position))[0];
      if (p) {
        g.ai.giveTask(p, { type: 'escape' });
        setTimeout(() => { if (g.people.includes(p) && ui.state === 'menu') p.say(rand.pick(['HEY! LET US OUT!', 'Is anyone out there?!', 'HELP! PLEASE!', 'We can see you!']), { kind: 'scared', scream: true }); }, 2500);
      }
    }
  };

  // ------------------------------------------------------------- new world
  M.newWorld = () => {
    const o = { name: `Lab ${Math.floor(Math.random() * 900 + 100)}`, mode: 'creative', theme: 'mixed', count: 25, money: 400 };
    const body = h('div', { class: 'col' });
    const draw = () => {
      clear(body);
      const nameInp = h('input', { type: 'text', class: 'txt', value: o.name, maxlength: 40 });
      nameInp.addEventListener('input', () => { o.name = nameInp.value; });
      put(body, 
        h('label', { class: 'field' }, 'World name', nameInp),
        setrow('Mode', seg([['creative', 'Creative'], ['money', 'Money mode']], o.mode, (v) => { o.mode = v; draw(); }), o.mode === 'creative' ? 'Everything free and unlocked. Pure sandbox.' : 'Start basic. Earn money (sell gadgets, computer jobs) and buy parts, pets, upgrades.'),
        o.mode === 'money' ? setrow('Starting money', slider(0, 3000, 50, o.money, (v) => { o.money = v; }, (v) => '$' + v)) : null,
        h('div', { class: 'muted', style: { marginTop: '6px' } }, 'The cage: pick a premade terrarium (you can still change it later with the terrain brush) or start with an empty one and build it yourself.'),
        h('div', { class: 'grid3' }, Object.entries(THEMES).map(([k, label]) => h('div', { class: 'card click' + (o.theme === k ? ' on' : ''), onclick: () => { o.theme = k; draw(); } }, h('b', {}, label), h('div', { class: 'muted' }, {
          forest: 'Oak trees, a pond, berry bushes.', desert: 'Sand, cactus, rocks, a tiny oasis.', snow: 'Snow, pine trees, a frozen pond.', jungle: 'Thick trees, mud, a big lake.', island: 'An island surrounded by water.', mixed: 'A bit of everything.', empty: 'Flat dirt. You shape it.',
        }[k] || '')))),
        setrow('Tiny people at the start', slider(0, 40, 1, o.count, (v) => { o.count = v; })),
      );
    };
    draw();
    ui.showModal('newworld', { title: 'New world', body, buttons: [['Back', () => M.main()], ['Create world', () => M.start(o), 'primary']] });
  };

  M.start = (o) => {
    initAudio();
    ui.close(true);
    M.hideMain();
    ui.fade(() => {
      g.newWorld({ ...o, id: newId() });
      M.enterPlay();
      ui.toast('Press H any time for controls.');
      setTimeout(() => M.saveWorld(true), 1500);
    });
  };

  M.enterPlay = () => {
    ui.state = 'play';
    g.running = true;
    ui.showHud(true);
    M.hideMain();
    initAudio();
    playTrack(settings.musicTrack);
    lockPointer();
  };

  // ------------------------------------------------------------- load
  M.load = async () => {
    const body = h('div', { class: 'col' }, h('div', { class: 'muted' }, 'Loading...'));
    ui.showModal('load', { title: 'Load a world', body, wide: true, buttons: [['Back', () => M.main()]] });
    const fileInp = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    fileInp.addEventListener('change', async () => {
      const f = fileInp.files[0];
      if (!f) return;
      try { const rec = await readWorldFile(f); await putWorld(rec); ui.toast(`Uploaded "${rec.name}".`); M.load(); } catch (e) { ui.toast('That file isn\'t a TERRARIUM save.'); }
    });
    const list = await listWorlds();
    clear(body);
    put(body, h('div', { class: 'row' }, btn('Upload a save file', () => fileInp.click()), fileInp, h('span', { class: 'muted' }, `${list.length} saved world${list.length === 1 ? '' : 's'}`)));
    if (!list.length) put(body, h('div', { class: 'muted', style: { padding: '20px 0' } }, 'No saved worlds yet. Make one with Play.'));
    const grid = h('div', { class: 'grid3' });
    for (const w of list) {
      put(grid, h('div', { class: 'card col' },
        w.thumb ? h('img', { src: w.thumb, style: { width: '100%', borderRadius: '8px', aspectRatio: '16/9', objectFit: 'cover' } }) : h('div', { style: { aspectRatio: '16/9', background: '#0b1213', borderRadius: '8px' } }),
        h('b', {}, w.name),
        h('div', { class: 'muted' }, `${w.mode === 'money' ? 'Money mode' : 'Creative'} · day ${w.day || 1} · ${w.people ?? '?'} alive · ${new Date(w.updated).toLocaleString()}`),
        h('div', { class: 'row' },
          btn('Play', async () => { const rec = await getWorld(w.id); if (!rec) return; ui.close(true); M.hideMain(); ui.fade(() => { try { g.load(rec.data); g.worldId = rec.id; g.worldName = rec.name; M.enterPlay(); } catch (e) { console.error(e); ui.toast('That save is broken: ' + e.message); M.main(); } }); }, 'primary small'),
          btn('Download', async () => { const rec = await getWorld(w.id); if (rec) downloadWorld(rec); }, 'small'),
          btn('Rename', async () => { const n = prompt('New name', w.name); if (!n) return; const rec = await getWorld(w.id); rec.name = n.slice(0, 40); await putWorld(rec); M.load(); }, 'small'),
          btn('Delete', async () => { if (!confirm(`Delete "${w.name}" forever?`)) return; await deleteWorld(w.id); M.load(); }, 'danger small'),
        )));
    }
    put(body, grid);
  };

  // ------------------------------------------------------------- saving
  M.thumb = () => {
    try {
      const w = g.world;
      const cam = new THREE.PerspectiveCamera(46, 16 / 9, 0.01, 60);
      cam.position.set(0.2, 1.75, 1.55); cam.lookAt(0, 0.9, -0.5);
      const vis = [w.lab.visible, w.house.visible, w.street.visible];
      w.lab.visible = true; w.house.visible = false; w.street.visible = false;
      const bg = g.scene.background; g.scene.background = new THREE.Color(0x0b0f10);
      const fog = g.scene.fog; g.scene.fog = null;
      const pv = g.player.vm.visible; g.player.vm.visible = false;
      g.renderer.render(g.scene, cam);
      const c = document.createElement('canvas'); c.width = 320; c.height = 180;
      c.getContext('2d').drawImage(g.renderer.domElement, 0, 0, 320, 180);
      [w.lab.visible, w.house.visible, w.street.visible] = vis; g.scene.background = bg; g.scene.fog = fog; g.player.vm.visible = pv;
      return c.toDataURL('image/jpeg', 0.7);
    } catch (e) { return null; }
  };

  M.saveWorld = async (quiet = false) => {
    if (!g.running || g.over) return false;
    if (!g.worldId) g.worldId = newId();
    let data;
    try { data = g.save(); } catch (e) { console.error(e); ui.toast('Save failed: ' + e.message); return false; }
    const ok = await putWorld({ id: g.worldId, name: g.worldName, mode: g.mode, thumb: M.thumb(), day: g.world.day, people: g.people.filter((p) => p.alive && p.inCage).length, data });
    if (!quiet) ui.toast(ok ? 'Saved.' : 'Could not save (browser storage blocked?). Use Download in the pause menu.');
    return ok;
  };

  M.autosave = () => { M.saveWorld(true); };

  // ------------------------------------------------------------- pause
  M.pause = () => {
    if (g.over) return;
    const body = h('div', { class: 'col' },
      h('div', { class: 'muted' }, `${g.worldName} · ${g.mode === 'money' ? 'Money mode' : 'Creative'} · ${g.world.timeString()}`),
      h('div', { class: 'menu-btns', style: { width: '100%' } },
        btn('Resume', () => ui.close(), 'primary'),
        btn('Save now', () => M.saveWorld()),
        btn('Download save file', async () => { await M.saveWorld(true); const rec = await getWorld(g.worldId); if (rec) downloadWorld(rec); else downloadWorld({ name: g.worldName, mode: g.mode, data: g.save() }); }),
        btn('Settings', () => M.settings(true)),
        btn('Controls', () => M.help()),
        btn('Your look', () => M.character(true)),
        btn('Save and quit to menu', async () => { await M.saveWorld(true); M.quitToMenu(); }, 'danger'),
      ),
    );
    ui.showModal('pause', { title: 'Paused', body });
  };

  M.quitToMenu = () => {
    ui.close(true);
    ui.fade(() => {
      g.running = false;
      g.newWorld({ demo: true, count: 14, theme: 'mixed' });
      g.player.vm.visible = false;
      M.main();
    });
  };

  // ------------------------------------------------------------- help
  M.help = () => {
    const k = (a) => h('span', { class: 'k' }, keyName(settings.keys[a]));
    const row = (keys, text) => h('div', {}, keys, text);
    const body = h('div', { class: 'grid', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 22px', fontSize: '13px' } },
      row([k('forward'), k('left'), k('back'), k('right')], 'move'), row([k('jump')], 'jump'),
      row([k('sprint')], 'sprint'), row([k('crouch')], 'crouch'),
      row([k('shrink')], 'hold: shrink yourself (size watch)'), row([k('grow')], 'hold: grow yourself'),
      row([h('span', { class: 'k' }, 'Click')], 'grab / drop / use tool'), row([h('span', { class: 'k' }, 'R-click')], 'hold: look close at what you hold'),
      row([k('throw')], 'throw what you hold / pour the bottle'), row([k('squeeze')], 'hold: squeeze (or shake the bottle)'),
      row([k('pullLimb')], 'pull a limb (gore MAX)'), row([k('flip')], 'flip gadget mode / bottle lid'),
      row([h('span', { class: 'k' }, '1-9'), h('span', { class: 'k' }, 'Wheel')], 'tool belt'), row([k('backpack')], 'backpack (all your gadgets + potions)'),
      row([k('interact')], 'use machines, doors, jars, your car'), row([k('view')], 'first / third person'),
      row([k('talk')], 'talk (type)'), row([k('mic')], 'hold: talk with your mic'),
      row([k('info')], 'person info card'), row([k('follow')], 'follow cam on someone'),
      row([k('changer')], 'the changer (become something else)'), row([k('feed')], 'show / hide the news feed'),
      row([k('slower'), k('faster')], 'cage time slower / faster / pause'), row([h('span', { class: 'k' }, 'Esc')], 'pause'),
      row([h('span', { class: 'k' }, 'H')], 'this help'), h('div', { class: 'muted', style: { gridColumn: '1 / -1', marginTop: '8px' } }, 'The cage control panel, workbench (make gadgets), computer, chem set (make potions), spawn machine, shrink chamber, clone machine, jars and experiment table are all in the lab. Walk up and press ' + keyName(settings.keys.interact) + '. Upstairs: your house (secret bookshelf door), then the street.'),
    );
    ui.showModal('help', { title: 'Controls', body, buttons: [['Rebind keys', () => M.settings(ui.state === 'play', 'controls')], ['Close', () => (ui.state === 'play' ? ui.close() : M.main())]] });
  };

  // ------------------------------------------------------------- game over (permadeath)
  M.gameOver = (from) => {
    unlockPointer();
    const id = g.worldId;
    const body = h('div', { class: 'col', style: { textAlign: 'center', padding: '20px' } },
      h('div', { style: { fontSize: '42px', fontWeight: 900, letterSpacing: '.2em', color: '#ff7a7a' } }, 'YOU DIED'),
      h('div', {}, from && from.name ? `${from.name} killed you.` : 'Hardcore mode: there is no coming back.'),
      h('div', { class: 'muted' }, 'This world is gone forever.'),
    );
    if (id) deleteWorld(id);
    g.worldId = null;
    ui.showModal('gameover', { title: 'The end', body, locked: true, buttons: [['Back to the menu', () => M.quitToMenu(), 'primary']] });
  };

  // ------------------------------------------------------------- settings
  M.settings = (inGame = ui.state === 'play', tab = 'graphics') => {
    const tabs = h('div', { class: 'tabs' });
    const body = h('div', { class: 'col' });
    const TABS = [['graphics', 'Graphics'], ['gameplay', 'Gameplay'], ['brain', 'AI brain'], ['audio', 'Voices + audio'], ['controls', 'Controls']];
    const save = () => saveSettings();
    const draw = () => {
      clear(tabs);
      for (const [k, l] of TABS) put(tabs, h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; draw(); } }, l));
      clear(body);
      if (tab === 'graphics') {
        put(body, 
          setrow('Quality', seg([['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra'], ['insane', 'INSANE']], settings.quality, (v) => setQualityChoice(v)), 'Auto watches your FPS and picks the best look that stays smooth (it never goes above High by itself). INSANE turns everything to max even if it lags.'),
          setrow('Shadows', toggle(settings.shadows, (v) => { settings.shadows = v; save(); })),
          setrow('Grass', toggle(settings.grass, (v) => { settings.grass = v; save(); })),
          setrow('Jiggle physics', toggle(settings.jiggle, (v) => { settings.jiggle = v; save(); })),
          setrow('Water reflections', toggle(settings.reflections, (v) => { settings.reflections = v; save(); })),
          setrow('Blood amount', slider(0, 2, 0.1, settings.blood, (v) => { settings.blood = v; save(); }, (v) => Math.round(v * 100) + '%')),
          setrow('Resolution', slider(0.5, 1.5, 0.05, settings.resScale, (v) => { settings.resScale = v; save(); }, (v) => Math.round(v * 100) + '%')),
          setrow('FPS counter', toggle(settings.showFps, (v) => { settings.showFps = v; save(); })),
        );
      } else if (tab === 'gameplay') {
        put(body, 
          setrow('Gore', seg([['none', 'None'], ['some', 'Some blood'], ['max', 'MAX']], settings.gore, (v) => { settings.gore = v; save(); }), 'MAX: limbs come off depending on the weapon and where it hits. Kids can never be hurt, no matter what.'),
          setrow('Kids grow up', slider(0.25, 4, 0.25, settings.kidGrow, (v) => { settings.kidGrow = v; save(); }, (v) => v + 'x')),
          setrow('Witnesses on the street', seg([['police', 'Police + wanted'], ['panic', 'Panic only'], ['none', 'Nobody cares']], settings.witnesses, (v) => { settings.witnesses = v; save(); })),
          setrow('Tiny people can escape', toggle(settings.escapes, (v) => { settings.escapes = v; save(); })),
          setrow('Glass strength', seg([[1, 'Thin'], [2, 'Normal'], [3, 'Bulletproof']], settings.glassStrength, (v) => { settings.glassStrength = v; save(); })),
          setrow('Gadget backfires', toggle(settings.backfires, (v) => { settings.backfires = v; save(); }), 'Crazy combos can glitch: hit you, shoot somewhere random, or blow up.'),
          setrow('Your own needs', toggle(settings.yourNeeds, (v) => { settings.yourNeeds = v; save(); }), 'Hunger, thirst and sleep for you. Health always counts.'),
          setrow('If you die in the cage', seg([['respawn', 'Wake up in the lab'], ['keepgear', 'They keep your gadgets'], ['permadeath', 'Permadeath']], settings.cageDeath, (v) => { settings.cageDeath = v; save(); })),
          setrow('Mouse sensitivity', slider(0.2, 3, 0.05, settings.sensitivity, (v) => { settings.sensitivity = v; save(); }, (v) => v.toFixed(2))),
          setrow('Invert mouse Y', toggle(settings.invertY, (v) => { settings.invertY = v; save(); })),
        );
      } else if (tab === 'brain') {
        const keyInp = h('input', { type: 'password', class: 'txt', value: settings.claudeKey, placeholder: 'sk-ant-...', style: { width: '280px' } });
        keyInp.addEventListener('change', () => { settings.claudeKey = keyInp.value.trim(); save(); });
        const modelSel = h('select', { class: 'txt' }, CLAUDE_MODELS.map(([id, label]) => h('option', { value: id, selected: settings.claudeModel === id }, label)));
        modelSel.addEventListener('change', () => { settings.claudeModel = modelSel.value; save(); });
        const st = h('span', { class: 'muted' }, `Local AI: ${localState.status}${localState.progress ? ' ' + Math.round(localState.progress * 100) + '%' : ''}`);
        put(body, 
          setrow('Who thinks for them', seg([['builtin', 'Built-in brain'], ['local', 'Free local AI'], ['claude', 'Your Claude key']], settings.brain, (v) => { settings.brain = v; save(); draw(); }), 'Built-in: instant, no download, knows their personality, mood and memories. Local: a free AI model that downloads once and runs on your graphics card. Claude: your own API key (smartest, costs a little per message).'),
        );
        if (settings.brain === 'claude') put(body, setrow('Claude API key', keyInp, 'Stays in this browser and is only sent to Anthropic.'), setrow('Model', modelSel));
        if (settings.brain === 'local') put(body, setrow('Local model', h('span', { class: 'row' }, btn('Download + load', async () => { try { await loadLocal((p) => { st.textContent = `Local AI: ${localState.status} ${Math.round(p * 100)}%`; }); st.textContent = 'Local AI: ready'; } catch (e) { st.textContent = 'Local AI failed: ' + e.message; } }), st), 'About 400 MB, once. Needs a browser with WebGPU (Chrome/Edge). If it fails, people use the built-in brain.'));
        put(body, h('div', { class: 'muted' }, 'If the AI brain fails or is slow, the built-in brain answers instead, so talking never breaks.'));
      } else if (tab === 'audio') {
        const mp3 = h('input', { type: 'file', accept: 'audio/*', style: { display: 'none' } });
        mp3.addEventListener('change', () => { if (mp3.files[0]) { playMp3(mp3.files[0]); ui.toast('Playing your music.'); } });
        put(body, 
          setrow('Voices', seg([['babble', 'Babble (Sims style)'], ['spoken', 'Real spoken voice']], settings.voice, (v) => { settings.voice = v; save(); })),
          setrow('Subtitles (speech bubbles)', toggle(settings.subtitles, (v) => { settings.subtitles = v; save(); })),
          setrow('Master volume', slider(0, 1, 0.05, settings.master, (v) => { settings.master = v; save(); applyVolumes(); }, (v) => Math.round(v * 100) + '%')),
          setrow('Music', slider(0, 1, 0.05, settings.music, (v) => { settings.music = v; save(); applyVolumes(); }, (v) => Math.round(v * 100) + '%')),
          setrow('Sound effects', slider(0, 1, 0.05, settings.sfx, (v) => { settings.sfx = v; save(); applyVolumes(); }, (v) => Math.round(v * 100) + '%')),
          setrow('Voices volume', slider(0, 1, 0.05, settings.voices, (v) => { settings.voices = v; save(); applyVolumes(); }, (v) => Math.round(v * 100) + '%')),
          setrow('Music track', seg(Object.entries(TRACKS).map(([k, t]) => [k, t.name]), settings.musicTrack, (v) => { settings.musicTrack = v; save(); initAudio(); playTrack(v); }), 'It never changes by itself.'),
          setrow('Your own music', h('span', { class: 'row' }, btn('Load an MP3', () => mp3.click()), mp3)),
        );
      } else if (tab === 'controls') {
        for (const [a, label] of Object.entries(KEY_LABELS)) {
          const b = h('button', { class: 'btn small', style: { minWidth: '90px' } }, keyName(settings.keys[a]));
          b.addEventListener('click', () => {
            b.textContent = 'press a key...';
            const on = (e) => {
              e.preventDefault(); e.stopPropagation();
              removeEventListener('keydown', on, true);
              if (e.code !== 'Escape') { settings.keys[a] = e.code; save(); }
              draw();
            };
            addEventListener('keydown', on, true);
          });
          put(body, setrow(label, b));
        }
        put(body, h('div', { class: 'row', style: { marginTop: '8px' } }, btn('Reset to default', () => { settings.keys = { ...DEFAULT_KEYS }; save(); draw(); })));
      }
    };
    draw();
    ui.showModal('settings', { title: 'Settings', body, tabs, wide: true, buttons: [['Done', () => (inGame ? ui.close() : M.main()), 'primary']] });
  };

  // ------------------------------------------------------------- character maker (your look)
  M.character = (inGame = ui.state === 'play') => {
    const L = { ...(g.customLook || {}) };
    const cv = h('canvas', { class: 'preview', style: { width: '100%', height: '320px', borderRadius: '10px', background: 'radial-gradient(circle at 50% 40%, #213536, #0b1213)' } });
    const pv = new Preview(cv, { dist: 3.1, height: 0.95, fov: 32 });
    let body3 = null;
    const rebuild = () => {
      if (body3) body3.dispose();
      body3 = new Body(scientistLook(L), pv.scene, { pos: new THREE.Vector3(0, 0, 0), yaw: 0, scale: 1, hi: true });
      body3.groundFn = () => 0;
    };
    rebuild();
    let t = 0;
    pv.onFrame = () => { t += 1 / 60; poseTargets(body3, { pos: new THREE.Vector3(), yaw: 0, phase: 0, speed: 0, action: null, at: t }); body3.simulate(1 / 60, 9.8, 24); body3.render(t); };
    const ctl = h('div', { class: 'col' });
    const upd = (k, v) => { L[k] = v; rebuild(); };
    put(ctl, 
      setrow('Body', seg([['m', 'Masc'], ['f', 'Fem']], L.sex || 'm', (v) => upd('sex', v))),
      setrow('Skin', h('div', { class: 'row' }, SKIN.map((c) => h('span', { class: 'swatch', style: { background: '#' + c.toString(16).padStart(6, '0') }, onclick: () => upd('skin', c) })), colorInput(L.skin ?? 0xe8b893, (c) => upd('skin', c)))),
      setrow('Hair', seg(HAIR_STYLES.map((s) => [s, s]), L.hair || 'spiky', (v) => upd('hair', v))),
      setrow('Hair color', h('div', { class: 'row' }, HAIR_COLORS.map((c) => h('span', { class: 'swatch', style: { background: '#' + c.toString(16).padStart(6, '0') }, onclick: () => upd('hairColor', c) })), colorInput(L.hairColor ?? 0xdcdcdc, (c) => upd('hairColor', c)))),
      setrow('Lab coat', colorInput(L.coat ?? 0xe9ecdf, (c) => upd('coat', c))),
      setrow('Gloves', colorInput(L.gloves ?? 0x2fa38a, (c) => upd('gloves', c))),
      setrow('Shirt', colorInput(L.shirt ?? 0x3d4d55, (c) => upd('shirt', c))),
      setrow('Pants', colorInput(L.pants ?? 0x2b2f33, (c) => upd('pants', c))),
      setrow('Goggles', toggle(L.goggles !== false, (v) => upd('goggles', v))),
      setrow('Beard', toggle(!!L.beard, (v) => upd('beard', v))),
      setrow('Height', slider(0.85, 1.15, 0.01, L.height ?? 1.02, (v) => upd('height', v), (v) => Math.round(v * 175) + ' cm')),
      setrow('Build', slider(0, 1, 0.05, L.fat ?? 0.15, (v) => upd('fat', v), (v) => (v < 0.3 ? 'skinny' : v < 0.6 ? 'normal' : 'big'))),
    );
    const body = h('div', { class: 'wb' }, h('div', { class: 'col' }, ctl), h('div', { class: 'col' }, cv, h('div', { class: 'muted' }, 'Drag to spin. The changer (C) can still turn you into a robot, alien, cat, mantis, or a copy of someone.')));
    ui.showModal('character', {
      title: 'Your look', body, wide: true,
      onClose: () => { pv.dispose(); if (body3) body3.dispose(); },
      buttons: [['Reset', () => { for (const k of Object.keys(L)) delete L[k]; rebuild(); }], ['Save look', () => {
        g.customLook = { ...L };
        try { localStorage.setItem('terrarium.look', JSON.stringify(g.customLook)); } catch (e) { /* ignore */ }
        if (g.player.form === 'scientist') { const sc = g.player.scale; g.player.changeFormQuiet(); g.player.body.rescale(sc); }
        sfx('ui');
        if (inGame) ui.close(); else M.main();
      }, 'primary']],
    });
  };

  void escapeHtml; void input;
  return M;
}
