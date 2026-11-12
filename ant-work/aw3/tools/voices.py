#!/usr/bin/env python3
"""Render every line in assets/voice/lines.json to assets/voice/<id>.mp3 with Microsoft's neural voices (edge-tts).
Jay and Jay 2 = en-PH-JamesNeural (the voice the owner picked as Jay). Jim = en-US-AndrewNeural, slower + deeper.
Only renders lines whose mp3 is missing or whose text changed (tracked in assets/voice/_rendered.json).
Needs: pip install edge-tts; behind the agent proxy: SSL_CERT_FILE=/root/.ccr/ca-bundle.crt and HTTPS_PROXY set."""
import asyncio, json, os, re, sys, hashlib
import edge_tts
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VDIR=os.path.join(ROOT,'assets','voice')
LINES=json.load(open(os.path.join(VDIR,'lines.json'),encoding='utf-8'))
VOICES={'Jay':('en-PH-JamesNeural','+0%','+0Hz'),'Jay2':('en-PH-JamesNeural','+0%','+0Hz'),'Jim':('en-US-AndrewNeural','-8%','-6Hz'),'Orrin':('en-GB-ThomasNeural','-12%','-10Hz'),'Bram':('en-US-GuyNeural','-6%','-12Hz'),'Teo':('en-AU-WilliamNeural','+6%','+0Hz'),'Steve':('en-US-ChristopherNeural','-4%','-8Hz'),'Alex':('en-GB-RyanNeural','-10%','-4Hz'),'OldJay':('en-PH-JamesNeural','-8%','-10Hz'),'Cust1':('en-US-BrianNeural','+0%','+0Hz'),'Cust2':('en-CA-LiamNeural','+0%','+0Hz'),'Cust3':('en-US-EricNeural','-6%','-4Hz')}
state_path=os.path.join(VDIR,'_rendered.json')
state=json.load(open(state_path)) if os.path.exists(state_path) else {}
def spoken(t):
    t=re.sub(r'\[[^\]]*\]','',t)          # stage directions
    t=re.sub(r'<[^>]+>','',t)
    t=t.replace('—','... ').replace('–','-')
    return re.sub(r'\s+',' ',t).strip()
async def main():
    proxy=os.environ.get('HTTPS_PROXY')
    todo=[]
    for id_,L in LINES.items():
        if id_.startswith('_'): continue
        who=L['who']; txt=spoken(L['text']); key=hashlib.md5((who+'|'+txt).encode()).hexdigest()
        dst=os.path.join(VDIR,id_+'.mp3')
        if os.path.exists(dst) and state.get(id_)==key: continue
        todo.append((id_,who,txt,key,dst))
    print('to render:',len(todo))
    for id_,who,txt,key,dst in todo:
        v,rate,pitch=VOICES[who]
        whisper='[whisper]' in LINES[id_]['text']
        r=rate if not whisper else '-12%'
        for attempt in range(3):
            try:
                await edge_tts.Communicate(txt,v,rate=r,pitch=pitch,proxy=proxy).save(dst)
                break
            except Exception as e:
                print('retry',id_,e); await asyncio.sleep(2+attempt*3)
        state[id_]=key; print(id_,os.path.getsize(dst) if os.path.exists(dst) else 'FAIL')
        json.dump(state,open(state_path,'w'),indent=0)
asyncio.run(main())
