/* Home styles: switch the whole Game System 3 to look + sound like a console.
   Each style = a home screen layout, fonts + colors (body[data-style]), button sounds, startup sound, menu music.
   Settings can still override the button sounds, the startup sound, the game start sound and the menu music.
   skin = every other screen too (Library, Settings, pop-ups, corner notes, quick menu) looks like that console (body[data-skin]). */

export const STYLES = [
  { id: 'gs3', name: 'Game System 3', family: 'Game System 3', layout: 'own', boot: 'gs3', music: null, pack: 'gs3', gameStart: 'gs3' },
  { id: 'ps5', name: 'PS5', family: 'PlayStation', layout: 'own', boot: 'boot-ps5', music: 'music-ps5', pack: 'ps5', gameStart: 'ui-ps5-ok', skin: 'ps5' },
  { id: 'ps4', name: 'PS4', family: 'PlayStation', layout: 'ps4', boot: 'boot-ps4', music: 'music-ps4', pack: 'ps4', gameStart: 'ui-ps4-ok', skin: 'ps4' },
  { id: 'ps3', name: 'PS3', family: 'PlayStation', layout: 'xmb', boot: 'boot-ps3-fat', music: null, pack: 'ps3', gameStart: 'ui-ps3-decide' },
  { id: 'psp', name: 'PSP', family: 'PlayStation', layout: 'xmb', boot: 'boot-psp', music: null, pack: 'ps3', gameStart: 'ui-ps3-decide' },
  { id: 'ps2', name: 'PS2', family: 'PlayStation', layout: 'ps2', boot: 'boot-ps2', music: 'music-ps2', pack: 'ps2', gameStart: 'ps2' },
  { id: 'xbox', name: 'Xbox Series X|S', family: 'Xbox', layout: 'xbox', boot: 'boot-xseries', music: null, pack: 'xbox', gameStart: 'ui-xbox-ok', bg: 'console', skin: 'xbox' },
  { id: 'xboxone', name: 'Xbox One', family: 'Xbox', layout: 'xbox', boot: 'boot-xboxone', music: null, pack: 'xbox', gameStart: 'ui-xbox-ok', bg: 'console', skin: 'xbox' },
  { id: 'x360nxe', name: 'Xbox 360', family: 'Xbox', layout: 'nxe', boot: 'boot-xbox360', music: 'music-xbox360', pack: 'x360', gameStart: 'x360' },
  { id: 'x360blades', name: 'Xbox 360 (Blades)', family: 'Xbox', layout: 'blades', boot: 'boot-xbox360', music: null, pack: 'x360', gameStart: 'x360' },
  { id: 'switch', name: 'Nintendo Switch', family: 'Nintendo', layout: 'switch', boot: 'boot-switch', music: null, pack: 'switch', gameStart: 'ui-switch-launch', skin: 'switch' },
  { id: 'wii', name: 'Wii', family: 'Nintendo', layout: 'wii', boot: 'boot-wii', music: 'music-wii', pack: 'wii', gameStart: 'ui-wii-start' },
  { id: '3ds', name: 'Nintendo 3DS / DS', family: 'Nintendo', layout: '3ds', boot: 'boot-nintendo3ds', music: 'music-dsi', pack: '3ds', gameStart: 'ui-switch-launch' },
  { id: 'steam', name: 'Steam Big Picture', family: 'PC', layout: 'steam', boot: 'boot-steam', music: null, pack: 'steam', gameStart: 'steam' },
  { id: 'dreamcast', name: 'Dreamcast', family: 'SEGA', layout: 'dreamcast', boot: 'boot-segadreamcast', music: null, pack: 'dreamcast', gameStart: 'dreamcast' }
];

/* button sounds: real sound files first; the live-made preset (sound.js) fills in what's missing */
export const BUTTON_SOUNDS = [
  { id: 'gs3', name: 'Game System 3', pack: { preset: 'gs3' } },
  { id: 'ps5', name: 'PS5', pack: { move: 'ui-ps5-move', ok: 'ui-ps5-ok', back: 'ui-ps5-back', preset: 'ps5', gain: 0.75 } },
  { id: 'ps4', name: 'PS4', pack: { move: 'ui-ps4-move', ok: 'ui-ps4-ok', back: 'ui-ps4-back', preset: 'ps4', gain: 0.75 } },
  { id: 'ps3', name: 'PS3 / PSP', pack: { move: 'ui-ps3-cursor', ok: 'ui-ps3-decide', back: 'ui-ps3-cancel', open: 'ui-ps3-option', error: 'ui-ps3-system_ng', good: 'ui-ps3-system_ok', gain: 0.9 } },
  { id: 'ps2', name: 'PS2', pack: { preset: 'x360' } },
  { id: 'xbox', name: 'Xbox Series / One', pack: { move: 'ui-xbox-move', ok: 'ui-xbox-ok', preset: 'xbox', gain: 0.7 } },
  { id: 'x360', name: 'Xbox 360', pack: { move: 'ui-xbox-move', preset: 'x360', gain: 0.7 } },
  { id: 'switch', name: 'Nintendo Switch', pack: { move: 'ui-switch-move', open: 'ui-switch-popup', home: 'ui-switch-home', preset: 'switch', gain: 0.7 } },
  { id: 'wii', name: 'Wii', pack: { move: 'ui-wii-click', ok: 'ui-wii-select', back: 'ui-wii-back', open: 'ui-wii-enter', gain: 0.7 } },
  { id: '3ds', name: 'Nintendo 3DS / DS', pack: { move: 'ui-3ds-move', preset: 'switch', gain: 0.6 } },
  { id: 'gc', name: 'GameCube', pack: { ok: 'ui-gc-select', preset: 'gc', gain: 0.7 } },
  { id: 'steam', name: 'Steam', pack: { preset: 'steam' } },
  { id: 'dreamcast', name: 'Dreamcast', pack: { preset: 'dreamcast' } }
];
export function buttonPack(id) { return (BUTTON_SOUNDS.find(function (b) { return b.id === id; }) || BUTTON_SOUNDS[0]).pack; }

export const STARTUP_SOUNDS = [
  { id: 'gs3', name: 'Game System 3' },
  { id: 'boot-ps5', name: 'PS5' },
  { id: 'boot-ps4', name: 'PS4' },
  { id: 'boot-ps3-fat', name: 'PS3' },
  { id: 'boot-ps3-slim', name: 'PS3 Slim' },
  { id: 'boot-ps2', name: 'PS2' },
  { id: 'boot-ps1', name: 'PlayStation (PS1)' },
  { id: 'boot-psp', name: 'PSP' },
  { id: 'boot-xseries', name: 'Xbox Series X|S' },
  { id: 'boot-xboxonex', name: 'Xbox One X' },
  { id: 'boot-xboxone', name: 'Xbox One' },
  { id: 'boot-xbox360', name: 'Xbox 360' },
  { id: 'boot-xbox', name: 'Xbox (original)' },
  { id: 'boot-switch', name: 'Nintendo Switch' },
  { id: 'boot-wii', name: 'Wii' },
  { id: 'boot-wiiu', name: 'Wii U' },
  { id: 'boot-gamecube01', name: 'GameCube' },
  { id: 'boot-n64', name: 'Nintendo 64' },
  { id: 'boot-nintendo3ds', name: 'Nintendo 3DS' },
  { id: 'boot-nintendodsi', name: 'Nintendo DSi' },
  { id: 'boot-nintendods', name: 'Nintendo DS' },
  { id: 'boot-gameboyadvance', name: 'Game Boy Advance' },
  { id: 'boot-gameboy', name: 'Game Boy' },
  { id: 'boot-segadreamcast', name: 'Dreamcast' },
  { id: 'boot-steam', name: 'Steam Big Picture' },
  { id: 'none', name: 'No sound' }
];

/* what a real console plays when you start a game (never its startup chime) */
export const GAMESTART_SOUNDS = [
  { id: 'gs3', name: 'Game System 3' },
  { id: 'ui-ps5-ok', name: 'PS5' },
  { id: 'ui-ps4-ok', name: 'PS4' },
  { id: 'ui-ps3-decide', name: 'PS3 / PSP' },
  { id: 'ui-xbox-ok', name: 'Xbox' },
  { id: 'x360', name: 'Xbox 360' },
  { id: 'ui-switch-launch', name: 'Nintendo Switch' },
  { id: 'ui-wii-start', name: 'Wii' },
  { id: 'ui-gc-select', name: 'GameCube' },
  { id: 'steam', name: 'Steam' },
  { id: 'dreamcast', name: 'Dreamcast' },
  { id: 'none', name: 'No sound' }
];

export const MUSIC = [
  { id: 'music-ps5', name: 'PS5 Home Menu' },
  { id: 'music-ps4', name: 'PS4 Home Menu' },
  { id: 'music-ps4plus', name: 'PS4 (PS Plus theme)' },
  { id: 'music-gamecube', name: 'GameCube Menu' },
  { id: 'music-halloween', name: 'Halloween (Danse Macabre)' },
  { id: 'music-wii', name: 'Wii Menu' },
  { id: 'music-wiishop', name: 'Wii Shop Channel' },
  { id: 'music-wiiu', name: 'Wii U Menu' },
  { id: 'music-dsi', name: 'Nintendo DSi Menu' },
  { id: 'music-dsishop', name: 'Nintendo DSi Shop' },
  { id: 'music-3dsshop', name: 'Nintendo 3DS eShop' },
  { id: 'music-ps2', name: 'PS2 System Menu' },
  { id: 'music-xbox360', name: 'Xbox 360 (Avatar theme)' },
  { id: 'music-xbox', name: 'Xbox (original dashboard)' }
];

export function styleById(id) { return STYLES.find(function (s) { return s.id === id; }) || STYLES[0]; }
export function nameOf(list, id) { const x = list.find(function (s) { return s.id === id; }); return x ? x.name : id; }
