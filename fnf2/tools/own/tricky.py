"""VS Tricky ("The Full-Ass Tricky Mod", by Banbuds + Rozebud + KadeDev + Cval + YingYang48 + JADS + Moro) for FNF 2 -
PRIVATE build only.

Reads the V-Slice port of the mod (GameBanana file 1706935, port by thisaintcub + PurSnake + LeonidKosherny) and copies
what FNF 2 plays into the git-ignored mod pack folder build/mods/tricky (never the repo; credits in
fnf2/private/CREDITS-mods.txt). The port is made for the real FNF engine, so its files go to the same places FNF's own do.

  songs       Improbable Outset, Madness, Hellclown (easy/normal/hard), Expurgation (the mod's chart = HARD, EASY +
              NORMAL are made from it here)
  characters  Tricky with his mask, Tricky, Hellclown Tricky, EX Tricky, the BF + GF for each of them, the sign death
  stages      Nevada (+ the Madness one), Hellclown's red island, the Auditor's hell
  notes       fire notes (don't hit them: they burn) + halo notes (don't hit them: they kill), the smoke splash
  cutscenes   the jaws + "OMFG CLOWN!!!!" intro, the Madness + Hellclown videos, the "CLOWN KILLS YOU" ending, EX Tricky
              climbing out of the ground
  mechanics   the static + red words, signs, the HP gremlin, clones, floor spikes, the energy wall (src/44-tricky.js)

  python3 tools/own/tricky.py [port folder]
"""
import glob, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
MOD = sys.argv[1] if len(sys.argv) > 1 else '/home/user/ref/mods/trickyvs/x/Vs Tricky'
OWN = os.environ.get('FNF_OWN') or os.path.join(ROOT, 'build', 'mods', 'tricky')   # this mod's pack folder (tools/pack_assets.py --packs)
VIDEOS = ('HankFuckingShootsTricky', 'HELLCLOWN_ENGADGED', 'TricksterMan')
HALO = 'trickydeath'
FA = os.environ.get('FNF_ASSETS', '/home/user/ref/fa')   # FNF's own files: the old BOYFRIEND sheet the mod's BF uses (FNF 2's own BF is the atlas one)
# the jaws closing over the screen: 32 frames of 2075x2305 (a 12462x13842 sheet, ~700 MB once decoded) drawn at 1.38x
# from (-300, -760), so only this part of each frame is ever on the screen (+ a few px around it): the sheet keeps just
# that (src/44-tricky.js draws it at the same spot)
JAWS_CROP = (480, 850, 1450, 1410)
# effect + cutscene sheets only ever drawn small (on the HUD at 0.67-0.76x, or in a stage the camera sees at 0.55x):
# packed at this fraction of their size (src/44-tricky.js draws them at scale / fraction, same spot: shrunk())
SHRINK = {'mechanics/Sign_Post_Mechanic': 0.7, 'mechanics/HP GREMLIN': 0.8, 'bgs/expurgation/EXENTER': 0.6,
          'bgs/expurgation/Clone': 0.6, 'bgs/expurgation/FloorSpikes': 0.6, 'cutscenes/somewhere': 0.5}
# the same sound as FNF's own (not taken twice)
SKIP = {'shared/sounds/gameplay/gameover/fnf_loss_sfx.ogg'}


def dest(rel):
    # V-Slice libraries: images/, data/, music/, sounds/ = 'preload'; shared/, songs/, videos/ keep their names
    if rel.startswith(('shared/', 'songs/', 'videos/')): return rel
    if rel.startswith('fonts/'): return 'fonts/mods/' + rel[6:]
    return 'preload/' + rel


def load(p): return json.load(open(p, encoding='utf-8-sig'))
def save(obj, p): os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(obj, open(p, 'w'), indent=1)


def expurgation_easier(hard, bpm):
    """EASY + NORMAL from the HARD chart: your normal notes thinned (nene.thin), every 2nd (NORMAL) / 3rd (EASY) halo
    note kept, Tricky's side left as it is (his poses + EX Hank stay)."""
    from nene import thin
    opp = [n for n in hard if n['d'] >= 4]
    mine = [n for n in hard if n['d'] < 4 and n.get('k') != HALO]
    halos = sorted((n for n in hard if n['d'] < 4 and n.get('k') == HALO), key=lambda q: (q['t'], q['d']))
    out = {}
    for level, every in (('easy', 3), ('normal', 2)):
        kept = thin(mine, bpm, level)
        busy = {}
        for n in kept: busy.setdefault(n['d'], []).append(n['t'])
        # (a halo right on top of a note you have to hit in the same lane would be unfair: the note wins, the halo goes)
        hl = [h for i, h in enumerate(halos) if i % every == 0 and not any(abs(h['t'] - t) < 130 for t in busy.get(h['d'], ()))]
        out[level] = sorted(kept + hl + opp, key=lambda q: (q['t'], q['d']))
    return out


def crop_sheet(png, xml_path, out_base, rect):
    """Every frame of a Sparrow sheet cut down to `rect` (frame space), packed in a grid: frames named the same."""
    from PIL import Image
    from repack_sparrow import frames_of
    Image.MAX_IMAGE_PIXELS = None
    img = Image.open(png).convert('RGBA')
    frames = frames_of(open(xml_path, encoding='utf-8-sig').read())
    x0, y0, x1, y1 = rect; w, h = x1 - x0, y1 - y0
    cols = max(1, 4096 // (w + 2)); rows = (len(frames) + cols - 1) // cols
    out = Image.new('RGBA', (cols * (w + 2), rows * (h + 2)))
    lines = []
    for i, f in enumerate(frames):
        cut = img.crop((int(f['x']), int(f['y']), int(f['x'] + f['width']), int(f['y'] + f['height'])))
        if f['rot']: cut = cut.transpose(Image.ROTATE_90)
        full = Image.new('RGBA', (int(f['fw']), int(f['fh']))); full.paste(cut, (int(f['fx']), int(f['fy'])))
        px, py = (i % cols) * (w + 2), (i // cols) * (h + 2)
        out.paste(full.crop(rect), (px, py))
        lines.append('\t<SubTexture name="%s" x="%d" y="%d" width="%d" height="%d"/>' % (f['name'], px, py, w, h))
    out.save(out_base + '.png', optimize=True)
    open(out_base + '.xml', 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<TextureAtlas imagePath="%s.png">\n%s\n</TextureAtlas>\n'
                                       % (os.path.basename(out_base), '\n'.join(lines)))


def main():
    n = 0
    for src in glob.glob(os.path.join(glob.escape(MOD), '**', '*'), recursive=True):
        if os.path.isdir(src): continue
        rel = os.path.relpath(src, MOD).replace(os.sep, '/')
        if rel.endswith(('.astc', '.hxc', '.mp4')) or '/' not in rel or rel.startswith('scripts/') or rel in SKIP: continue
        if rel.startswith('shared/images/') and rel[14:].rsplit('.', 1)[0] in set(SHRINK) | {'Jaws'}: continue
        dst = os.path.join(OWN, dest(rel))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst); n += 1
    J = os.path.join(MOD, 'shared', 'images', 'Jaws')
    crop_sheet(J + '.png', J + '.xml', os.path.join(OWN, 'shared', 'images', 'Jaws'), JAWS_CROP); n += 2
    from repack_sparrow import repack
    for k, f in SHRINK.items():
        src, out = os.path.join(MOD, 'shared', 'images', k), os.path.join(OWN, 'shared', 'images', k)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        repack(src + '.png', src + '.xml', out, scale=f); n += 2
    for ext in ('.png', '.xml'):
        shutil.copyfile(os.path.join(FA, 'shared', 'images', 'characters', 'BOYFRIEND' + ext), os.path.join(OWN, 'shared', 'images', 'characters', 'BOYFRIEND' + ext)); n += 1
    D = lambda *p: os.path.join(OWN, 'preload', 'data', *p)
    # BF's scared shake in the intro: the port names it 'Scared' (its own sheet); FNF's BOYFRIEND calls it 'BF idle shaking'
    p = D('characters', 'bftricky.json'); c = load(p)
    for a in c['animations']:
        if a['name'] == 'scared': a['prefix'] = 'BF idle shaking'
    save(c, p)
    # every week is open from the start in FNF 2 (the mod hides Expurgation until the clown week is beaten)
    p = D('levels', 'expurgation.json'); L = load(p); L['visible'] = True; save(L, p)
    # Expurgation: one chart in the mod (HARD); EASY + NORMAL made from it
    cp, mp = D('songs', 'expurgation', 'expurgation-chart.json'), D('songs', 'expurgation', 'expurgation-metadata.json')
    C, M = load(cp), load(mp)
    hard = C['notes']['hard']
    C['notes'] = dict(expurgation_easier(hard, M['timeChanges'][0]['bpm']), hard=hard)
    sp = C['scrollSpeed'].get('hard', 3.4)
    C['scrollSpeed'] = {'default': sp, 'easy': round(sp * 0.78, 2), 'normal': round(sp * 0.88, 2), 'hard': sp}
    pd = M['playData']; r = pd['ratings'].get('hard', 15)
    pd['difficulties'] = ['easy', 'normal', 'hard']; pd['ratings'] = {'easy': round(r * 0.4), 'normal': round(r * 0.66), 'hard': r}
    save(C, cp); save(M, mp)
    print('   expurgation', {k: (len(v), sum(q.get('k') == HALO and q['d'] < 4 for q in v)) for k, v in C['notes'].items()}, '(notes, halos)')
    # the videos as WebM (VP9 + Opus: plays in every browser; the mod's mp4s are H.264)
    for v in VIDEOS:
        out = os.path.join(OWN, 'videos', 'videos', v + '.webm')
        if not os.path.exists(out):
            os.makedirs(os.path.dirname(out), exist_ok=True)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(MOD, 'videos', 'videos', v + '.mp4'), '-c:v', 'libvpx-vp9',
                            '-b:v', '0', '-crf', '34', '-row-mt', '1', '-c:a', 'libopus', '-b:a', '112k', out], check=True)
        n += 1
    print('tricky:', n, 'files')


if __name__ == '__main__':
    sys.path.insert(0, HERE)
    main()
