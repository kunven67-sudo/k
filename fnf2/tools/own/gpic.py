"""gpic: ask Google's picture AI ("Nano Banana", Gemini image models) for pictures, keep trying until one is good,
then hand them over for a final look.

  python3 tools/own/gpic.py "prompt" [--ref a.png --ref b.png] [--edit pic.png] [-n 4] [--tries 3] [--pass 7]
                            [--out DIR] [--name NAME] [--model MODEL] [--judge-model MODEL] [--no-judge]

  prompt        what to make (an FNF-style picture by default: --plain leaves the prompt exactly as typed)
  --ref         reference pictures sent with the prompt (characters, poses, style)
  --edit        change this picture instead of making a new one (the prompt says what to change)
  -n            how many good pictures to end up with
  --tries       how many times each one may be made again when the judge says it's bad
  --pass        the judge's score (1-10) a picture needs
  --out         where the pictures go (default fnf2/private/gpic: git-ignored, never in the public repo)

Every picture gets judged by Gemini itself first (FNF look: flat colours + thick black ink; and the "looks like AI"
tells: smudges, melted hands, extra fingers, garbled text, mushy outlines, glossy 3D shading). Bad ones are made
again with the judge's notes added to the prompt. At the end there's a contact sheet (all of them numbered, the
judge's score on each) + a JSON list, so whoever runs it (Claude) takes the last look and picks.

The key: GEMINI_API_KEY (or GOOGLE_API_KEY) in the environment. Never written anywhere, never printed.
"""
import os, sys, json, time, base64, argparse, re, io, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
API = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent'
MODEL = os.environ.get('GPIC_MODEL', 'gemini-2.5-flash-image')
JUDGE = os.environ.get('GPIC_JUDGE', 'gemini-2.5-flash')

STYLE = ("Style: Friday Night Funkin' (FNF) 2D cartoon art, like the official game sprites: flat solid colours with one "
         "hard-edged shadow tone, thick confident black ink outlines with slight hand-drawn wobble, chunky squat "
         "proportions, big expressive eyes, no gradients, no soft airbrush shading, no 3D render look, no glow, no text, "
         "no watermark, plain flat background unless asked.")

RUBRIC = ("You judge pictures for a fan-made Friday Night Funkin' game. The picture must look hand-drawn in FNF's own "
          "style (flat colours, one hard shadow tone, thick black ink outlines, chunky cartoon shapes) and must NOT look "
          "AI-made. AI tells: smudged or melted details, mushy or broken outlines, extra/missing/fused fingers, warped "
          "faces or eyes, garbled text or fake letters, glossy 3D or airbrushed shading, random noise or blotches, "
          "objects blending into each other, inconsistent line thickness. Also check it matches what was asked.\n"
          "What was asked: %s\n"
          "Answer ONLY with JSON: {\"score\": 1-10 (10 = could pass as official FNF art), \"fnf_style\": true/false, "
          "\"ai_tells\": [short strings], \"matches_request\": true/false, \"fix\": \"one sentence: what to change\"}")


def key():
    k = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    if not k:
        sys.exit('gpic: no GEMINI_API_KEY in the environment (add it in the environment settings, then start a new session)')
    return k


def post(model, body, tries=6):
    req = urllib.request.Request(API % model, data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json', 'x-goog-api-key': key()})
    wait = 4
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors='replace')[:400]
            if e.code in (429, 500, 502, 503, 504) and i < tries - 1:
                ra = e.headers.get('Retry-After')
                time.sleep(float(ra) if ra and ra.replace('.', '').isdigit() else wait); wait = min(60, wait * 2); continue
            raise SystemExit('gpic: %s %d: %s' % (model, e.code, re.sub(r'key=[^&"\s]+', 'key=***', msg)))
        except (urllib.error.URLError, TimeoutError) as e:
            if i < tries - 1: time.sleep(wait); wait = min(60, wait * 2); continue
            raise SystemExit('gpic: network: %s' % e)


def img_part(path):
    ext = os.path.splitext(path)[1].lower().lstrip('.')
    mime = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'webp': 'image/webp', 'gif': 'image/gif'}.get(ext, 'image/png')
    return {'inline_data': {'mime_type': mime, 'data': base64.b64encode(open(path, 'rb').read()).decode()}}


def make(model, prompt, refs):
    """-> (png bytes or None, the model's text)"""
    parts = [{'text': prompt}] + [img_part(p) for p in refs]
    res = post(model, {'contents': [{'role': 'user', 'parts': parts}],
                       'generationConfig': {'responseModalities': ['TEXT', 'IMAGE']}})
    data, text = None, []
    for c in res.get('candidates', []):
        for p in (c.get('content') or {}).get('parts', []):
            d = p.get('inline_data') or p.get('inlineData')
            if d and d.get('data'): data = base64.b64decode(d['data'])
            elif p.get('text'): text.append(p['text'])
    if data is None and not text:
        text.append(json.dumps(res.get('promptFeedback') or res)[:300])
    return data, ' '.join(text).strip()


def judge(model, png, asked):
    parts = [{'text': RUBRIC % asked}, {'inline_data': {'mime_type': 'image/png', 'data': base64.b64encode(png).decode()}}]
    res = post(model, {'contents': [{'role': 'user', 'parts': parts}],
                       'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0.2}})
    try:
        t = res['candidates'][0]['content']['parts'][0]['text']
        v = json.loads(t[t.index('{'):t.rindex('}') + 1])
        v['score'] = float(v.get('score', 0)); return v
    except Exception:
        return {'score': 0, 'fix': 'judge gave no answer', 'ai_tells': []}


def sheet(items, path):
    from PIL import Image, ImageDraw
    ims = [Image.open(io.BytesIO(open(i['file'], 'rb').read())).convert('RGB') for i in items]
    if not ims: return None
    H = 360; ims = [im.resize((max(1, int(im.width * H / im.height)), H)) for im in ims]
    W = sum(im.width for im in ims) + 8 * (len(ims) + 1)
    c = Image.new('RGB', (W, H + 40), (40, 40, 48)); d = ImageDraw.Draw(c); x = 8
    for i, (im, it) in enumerate(zip(ims, items)):
        c.paste(im, (x, 32)); d.text((x + 4, 8), '#%d  score %s' % (i + 1, it.get('score', '?')), fill=(255, 230, 0)); x += im.width + 8
    c.save(path); return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('prompt'); ap.add_argument('--ref', action='append', default=[]); ap.add_argument('--edit')
    ap.add_argument('-n', type=int, default=4); ap.add_argument('--tries', type=int, default=3); ap.add_argument('--pass', dest='need', type=float, default=7)
    ap.add_argument('--out', default=os.path.join(ROOT, 'private', 'gpic')); ap.add_argument('--name')
    ap.add_argument('--model', default=MODEL); ap.add_argument('--judge-model', default=JUDGE)
    ap.add_argument('--no-judge', action='store_true'); ap.add_argument('--plain', action='store_true')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    name = a.name or re.sub(r'[^a-z0-9]+', '-', a.prompt.lower())[:40].strip('-') or 'pic'
    stamp = time.strftime('%m%d-%H%M%S')
    refs = ([a.edit] if a.edit else []) + a.ref
    base = a.prompt if a.plain else (a.prompt + '\n' + STYLE)
    if a.edit: base = 'Edit the first picture: ' + base + '\nKeep everything else exactly the same.'
    items = []
    for i in range(a.n):
        prompt, best = base, None
        for t in range(a.tries + 1):
            png, text = make(a.model, prompt, refs)
            if png is None:
                print('  #%d try %d: no picture (%s)' % (i + 1, t + 1, text[:160]), file=sys.stderr); continue
            f = os.path.join(a.out, '%s-%s-%d-%d.png' % (name, stamp, i + 1, t + 1)); open(f, 'wb').write(png)
            v = {'score': None} if a.no_judge else judge(a.judge_model, png, a.prompt)
            it = {'file': f, 'try': t + 1, **v}
            print('  #%d try %d: score %s %s' % (i + 1, t + 1, v.get('score'), '; '.join(v.get('ai_tells', [])[:3])), file=sys.stderr)
            if best is None or (v.get('score') or 0) > (best.get('score') or 0): best = it
            if a.no_judge or v['score'] >= a.need: break
            prompt = base + '\nAvoid these problems from the last try: ' + '; '.join(v.get('ai_tells', [])[:5]) + '. ' + v.get('fix', '')
        if best: items.append(best)
    sh = sheet(items, os.path.join(a.out, '%s-%s-sheet.png' % (name, stamp)))
    print(json.dumps({'sheet': sh, 'pictures': items}, indent=1))


if __name__ == '__main__':
    main()
