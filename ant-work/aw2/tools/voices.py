"""Record every Ant Work 2 line with neural voices (edge-tts), one voice per character.
Needs: pip install edge-tts; behind the agent proxy: SSL_CERT_FILE=/root/.ccr/ca-bundle.crt and HTTPS_PROXY set.
Run from ant-work/aw2: python3 tools/voices.py     (only renders missing/changed lines)"""
import asyncio, json, os, hashlib, edge_tts
CAST = {   # who: (voice, rate, pitch)
    'You': ('en-PH-JamesNeural', '+0%', '+0Hz'),          # Jay (same voice as Ant Work 3)
    'Jim': ('en-US-AndrewNeural', '-8%', '-6Hz'),
    'JimTired': ('en-US-AndrewNeural', '-24%', '-12Hz'),
    'Larry': ('en-AU-WilliamNeural', '+4%', '+14Hz'),
    'Seller': ('en-US-ChristopherNeural', '+6%', '+16Hz'),
    'Converter': ('en-US-SteffanNeural', '-6%', '-14Hz'),
    'Steve': ('en-GB-ThomasNeural', '-6%', '-14Hz'),
    'Kid': ('en-US-AnaNeural', '+6%', '+0Hz'),
    'Bob': ('en-US-BrianNeural', '+0%', '-4Hz'),
    'Alex': ('en-GB-SoniaNeural', '-4%', '-6Hz'),
}
SKIP = {'Jeff', 'Jim', 'JimTired'}   # Jeff is a dog (real bark); Jim keeps his original Ant Work 2 voice
L = json.load(open('assets/voice/lines.json')); st_p = 'assets/voice/_rendered.json'
state = json.load(open(st_p)) if os.path.exists(st_p) else {}
proxy = os.environ.get('HTTPS_PROXY')
async def one(i, v):
    voice, rate, pitch = CAST.get(v['who'], CAST['Jim'])
    key = hashlib.md5((voice + rate + pitch + v['text']).encode()).hexdigest()
    out = f'assets/voice/{i}.mp3'
    if state.get(i) == key and os.path.exists(out): return False
    for tries in range(4):
        try:
            await edge_tts.Communicate(v['text'], voice, rate=rate, pitch=pitch, proxy=proxy).save(out)
            state[i] = key; return True
        except Exception as e:
            print('retry', i, str(e)[:80]); await asyncio.sleep(2 + tries * 3)
    return False
async def main():
    todo = [(i, v) for i, v in L.items() if v['who'] not in SKIP and v['who'] in CAST]   # aliens/robots/crowd keep their computer voices
    print('lines:', len(todo)); n = 0; sem = asyncio.Semaphore(5)
    async def run(i, v):
        nonlocal n
        async with sem:
            if await one(i, v):
                n += 1; print(i, v['who'], v['text'][:50], flush=True); json.dump(state, open(st_p, 'w'))
    await asyncio.gather(*(run(i, v) for i, v in todo))
    json.dump(state, open(st_p, 'w')); print('done, rendered', n)
asyncio.run(main())
