"""VS Tabi (Ex Boyfriend, the Tabi Revival team) for FNF 2 - PRIVATE build only.

The official mod (GameBanana 286388, Codename Engine) and its V-Slice port by SangMzG (GameBanana 587524) use the very
same art + songs; the port is in FNF's own formats, so it's the one we read. Everything goes into the git-ignored
build/own folder (never the repo; credits in fnf2/private/CREDITS-mods.txt).

  songs       My Battle, Last Chance, Genocide (+ the bonus Last Chance Noimix, My Battle Pico Mix)
  characters  tabi, tabi-new (Pico mix), tabi-genocide, bf-genocide, gf-tabi, gf-genocide, nene-tabi (Nene at a table)
  stages      the restaurant, at night (Pico mix), on fire (Genocide)
  look        Tabi's own arrows + splashes, health bar, ratings + numbers, fonts
  cutscenes   the comic panels + voiced lines, the Last Chance video, the official credits video after Genocide

  python3 tools/own/tabi.py [port folder] [official mod folder]
"""
import glob, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
MOD = sys.argv[1] if len(sys.argv) > 1 else '/home/user/ref/mods/tabivs/x/Vs Tabi Revival'
OFFICIAL = sys.argv[2] if len(sys.argv) > 2 else '/home/user/ref/mods/tabi/x/1vs-tabi'
OWN = os.environ.get('FNF_OWN') or os.path.join(ROOT, 'build', 'mods', 'tabi')   # this mod's pack folder (tools/pack_assets.py --packs)

FILES = [
    'data/characters/*.json', 'images/characters/*',
    'data/stages/*.json', 'images/stages/restaurant/*.png', 'images/stages/restaurant/fire/*', 'images/vignette.png',
    'data/songs/*/*.json', 'songs/*/*.ogg',
    'data/levels/tabi.json', 'data/levels/tabi-bonus.json', 'images/storymenu/props/*', 'images/storymenu/titles/*',
    'data/notestyles/tabi.json', 'images/ui/*',
    'data/ui/freeplay/albums/*.json', 'images/freeplay/album/*', 'images/freeplay/icons/*', 'images/icons/*',
    'data/cutscenes/*.json', 'images/dialogue/box.png', 'images/dialogue/characters/*/*', 'images/dialogue/panels/*',
    'music/cutscenes/*.ogg', 'music/tabi game over loop.ogg', 'sounds/crash.ogg', 'sounds/fnf_loss_sfx-tabi.ogg',
    'sounds/dialogue/*.ogg', 'sounds/dialogue/*/*.ogg',
]


def dest(rel):
    # V-Slice libraries: images/, data/, music/, sounds/ = 'preload'; songs/, videos/ keep their names
    if rel.startswith(('shared/', 'songs/', 'videos/')): return rel
    if rel.startswith('fonts/'): return 'fonts/mods/' + rel[6:]
    return 'preload/' + rel


def load(p): return json.load(open(p, encoding='utf-8-sig'))
def save(obj, p): os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(obj, open(p, 'w'), indent=1)


def webm(src, dst, height=720):
    """A video as WebM (VP9 + Opus) at 720p: every browser plays it, and it's small."""
    if os.path.exists(dst): return
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', f'scale=-2:{height}', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36',
                    '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-c:a', 'libopus', '-b:a', '96k', dst], check=True)


def overlay_bake(path, alpha):
    """The fire stage's flames use the mod's overlay.frag (bbpanzu's bloom + an orange overlay, drawn additive).
    Same maths here, once, on the whole sheet (the shader reads the sheet around each frame the same way), so the
    game draws a plain picture with additive blending instead of running a shader. The picture holds the colour
    that gets added: rgb = added / a, a = the strongest channel."""
    import numpy as np
    from PIL import Image
    im = np.asarray(Image.open(path).convert('RGBA'), dtype=np.float32) / 255
    a = im[..., 3:4]
    tex = np.concatenate([im[..., :3] * a, a], -1) * alpha        # flixel_texture2D: premultiplied, times the sprite's alpha
    del im
    def shift(arr, d, axis):                                          # sample at +d pixels, edges clamped
        idx = np.clip(np.arange(arr.shape[axis]) + d, 0, arr.shape[axis] - 1)
        return np.take(arr, idx, axis=axis)
    W = {0: 0.227027, 1: 0.054054, 2: 0.016216}                       # (the shader uses weight3 at +-1 and weight4 at +-2)
    col = np.zeros_like(tex)
    for axis in (1, 0):                                               # horizontal pass + vertical pass, then averaged
        acc = tex * W[0]
        for k in (1, 2):
            acc += (shift(tex, -k * 18, axis) + shift(tex, k * 18, axis)) * W[k]
        col += acc
        del acc
    col *= 0.5
    bloom = tex / 1.8 + col
    del tex, col
    rgb = bloom[..., :3]
    lum = rgb.mean(-1, keepdims=True)
    low = np.stack([2 * rgb[..., 0], rgb[..., 1], np.zeros_like(rgb[..., 0])], -1)
    high = np.stack([np.ones_like(rgb[..., 0]), rgb[..., 1], 2 * rgb[..., 2] - 1], -1)
    add = np.clip(np.where(lum < 0.5, low, high), 0, 1)
    # nothing to add where the bloom is empty (the shader adds black there)
    add[bloom[..., 3] <= 0] = 0
    del low, high, bloom, rgb, lum
    out_a = add.max(-1, keepdims=True)
    out_rgb = np.where(out_a > 0, add / np.maximum(out_a, 1e-6), 0)
    out = np.concatenate([out_rgb, out_a], -1)
    Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA').save(path, optimize=False)


def main():
    n = 0
    for pat in FILES:
        hits = glob.glob(os.path.join(glob.escape(MOD), pat))
        if not hits: print('missing:', pat)
        for src in hits:
            if os.path.isdir(src): continue
            rel = os.path.relpath(src, MOD).replace(os.sep, '/')
            dst = os.path.join(OWN, dest(rel))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(src, dst); n += 1
    for f in glob.glob(os.path.join(glob.escape(MOD), 'fonts', '*')):
        dst = os.path.join(OWN, 'fonts', 'mods', os.path.basename(f))
        os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copyfile(f, dst); n += 1
    # videos: the Last Chance ending and the official mod's credits (played after Genocide)
    webm(os.path.join(MOD, 'videos', 'videos', 'end-cutscene.mp4'), os.path.join(OWN, 'videos', 'videos', 'tabi-end-cutscene.webm'))
    webm(os.path.join(OFFICIAL, 'videos', 'credits.mkv'), os.path.join(OWN, 'videos', 'videos', 'tabi-credits.webm'))
    n += 2
    # Genocide's flames with the mod's glow shader baked in (alpha 0.55 at the back, 0.95 in front)
    fire = os.path.join(OWN, 'preload', 'images', 'stages', 'restaurant', 'fire')
    for name, alpha in (('backmost flames', 0.55), ('front flame right', 0.95), ('front flame left', 0.95)):
        overlay_bake(os.path.join(fire, name + '.png'), alpha)
    D = lambda *p: os.path.join(OWN, 'preload', 'data', *p)
    # everything open from the start in FNF 2; the bonus song shows in freeplay
    for lv in ('tabi', 'tabi-bonus'):
        p = D('levels', lv + '.json'); L = load(p); L['visible'] = lv == 'tabi'
        if lv == 'tabi-bonus': L['capsule'] = {'name': 'TABI BONUS'}   # (the freeplay capsule's week label)
        save(L, p)
    difficulties()
    print('tabi:', n, 'files')


def spaced(notes, gap):
    """Thinning for a chart that isn't on the beat grid (My Battle's Pico mix): on each side, a note only when the
    last one kept was at least `gap` ms before, one note at a time (the longest hold of a chord)."""
    out = []
    for side in (0, 1):
        groups = {}
        for n in notes:
            if (n['d'] >= 4) == bool(side): groups.setdefault(round(n['t']), []).append(n)
        last = -1e9
        for t in sorted(groups):
            if t - last < gap - 5: continue
            out.append(sorted(groups[t], key=lambda n: (-n.get('l', 0), n['d']))[0]); last = t
    return sorted(out, key=lambda q: (q['t'], q['d']))


def difficulties():
    """The mod has one chart per song (called 'normal'). In FNF 2 that chart is HARD; NORMAL + EASY are made from it
    (normal: no 16th runs, few jumps; easy: a beat or more between notes, no jumps), like Nene's songs (nene.py)."""
    from nene import thin
    D = lambda *p: os.path.join(OWN, 'preload', 'data', *p)
    for cp in sorted(glob.glob(D('songs', '*', '*-chart*.json'))):
        mp = cp.replace('-chart', '-metadata')
        if not os.path.exists(mp): continue
        C, M = load(cp), load(mp)
        hard = C['notes'].get('hard') or C['notes'].get('normal') or []
        if not hard: continue
        bpm = (M.get('timeChanges') or [{'bpm': 100}])[0]['bpm']
        beat = 60000 / bpm
        on_grid = sum(abs(n['t'] / beat * 4 - round(n['t'] / beat * 4)) < 0.08 for n in hard) / len(hard)
        if on_grid > 0.6: C['notes'] = {'easy': thin(hard, bpm, 'easy'), 'normal': thin(hard, bpm, 'normal'), 'hard': hard}
        else: C['notes'] = {'easy': spaced(hard, beat), 'normal': spaced(hard, beat / 2), 'hard': hard}   # (off the grid: by spacing)
        ss = C.get('scrollSpeed') or {}; sp = ss.get('hard') or ss.get('normal') or ss.get('default') or 2
        C['scrollSpeed'] = {'default': sp, 'easy': round(sp * 0.85, 2), 'normal': round(sp * 0.92, 2), 'hard': sp}
        pd = M['playData']; r = (pd.get('ratings') or {}); r = r.get('hard') or r.get('normal') or 5
        pd['difficulties'] = ['easy', 'normal', 'hard']
        pd['ratings'] = {'easy': max(1, round(r * 0.35)), 'normal': max(1, round(r * 0.6)), 'hard': r}
        save(C, cp); save(M, mp)
        print('  ', os.path.basename(cp), {k: len(v) for k, v in C['notes'].items()})


if __name__ == '__main__':
    main()
