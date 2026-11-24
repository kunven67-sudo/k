// Windows 11 system icons: the real "Segoe Fluent Icons" font when it exists (it does on every Windows 11 PC),
// otherwise Microsoft's Fluent System Icons pictures (same design) so it still looks right everywhere.
import { asset } from './util.js';
const GLYPH = { search: '', wifi: '', ethernet: '', volume: '', mic: '', bell: '', chevup: '', power: '', settings: '',
  person: '', close: '', min: '', max: '', restore: '', chevright: '', folder: '', doc: '', refresh: '',
  lock: '', sleep: '', restart: '', back: '', fwd: '', up: '', home: '', desktop: '', download: '',
  pictures: '', music: '', video: '', more: '', add: '', cut: '', copy: '', paste: '', rename: '',
  share: '', del: '', view: '', sort: '', filter: '', sun: '', moon: '', airplane: '', bt: '', access: '' };
const SVG = { search: 'search_20_regular', wifi: 'wifi_1_20_regular', ethernet: 'desktop_20_regular', volume: 'speaker_2_20_regular', mic: 'mic_20_regular', bell: 'alert_20_regular',
  chevup: 'chevron_up_20_regular', power: 'power_20_regular', settings: 'settings_20_regular', person: 'person_20_regular', close: 'dismiss_16_regular', min: 'subtract_16_regular',
  max: 'square_16_regular', restore: 'square_multiple_16_regular', chevright: 'chevron_right_16_regular', folder: 'folder_20_regular', doc: 'document_20_regular',
  refresh: 'arrow_clockwise_20_regular', lock: 'lock_closed_20_regular', sleep: 'weather_moon_20_regular', restart: 'arrow_sync_20_regular', back: 'arrow_left_20_regular',
  fwd: 'arrow_right_20_regular', up: 'arrow_up_20_regular', home: 'home_20_regular', desktop: 'desktop_20_regular', download: 'arrow_download_20_regular', pictures: 'image_20_regular',
  music: 'music_note_2_20_regular', video: 'video_20_regular', more: 'more_horizontal_20_regular', add: 'add_20_regular', cut: 'cut_20_regular', copy: 'copy_20_regular',
  paste: 'clipboard_paste_20_regular', rename: 'rename_20_regular', share: 'share_20_regular', del: 'delete_20_regular', view: 'grid_20_regular', sort: 'apps_list_20_regular',
  filter: 'filter_20_regular', sun: 'weather_sunny_20_regular', moon: 'weather_moon_20_regular', airplane: 'arrow_up_20_regular', bt: 'settings_20_regular', access: 'person_20_regular' };
let hasFont = false;
export async function initIcons() {
  try {
    const c = document.createElement('canvas').getContext('2d');
    const w = (f) => { c.font = f; return c.measureText('\uE721\uE995\uE701').width; };
    hasFont = process.platform === 'win32' && w('32px "Segoe Fluent Icons", monospace') !== w('32px monospace');
  } catch (e) { hasFont = false; }
  return hasFont;
}
export function ico(name, size = 16, extra = '') {
  if (hasFont && GLYPH[name]) return `<i class="gi" style="font-size:${size}px;${extra}">${GLYPH[name]}</i>`;
  return `<i class="si" style="width:${size}px;height:${size}px;background-image:url('${asset('fluent/' + SVG[name] + '.svg')}');${extra}"></i>`;
}
