#!/usr/bin/env python3
"""Fetch Poly Haven (CC0) textures + models for ANT WORK 4.
   textures -> assets/tex/<name>_{diff,nor,rough,ao}.jpg (1k)
   models   -> assets/models/<name>.glb (1k textures packed in, one file = works from the folder)"""
import json, os, struct, sys, urllib.request
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'aw-build'}),timeout=60) as r: return r.read()
def tex(name):
    f=json.loads(get('https://api.polyhaven.com/files/'+name)); out=os.path.join(ROOT,'assets/tex')
    for key,suf in [('Diffuse','diff'),('nor_gl','nor'),('Rough','rough'),('AO','ao')]:
        if key not in f: continue
        dst=os.path.join(out,f'{name}_{suf}.jpg')
        if os.path.exists(dst): continue
        open(dst,'wb').write(get(f[key]['1k']['jpg']['url']))
    print('tex',name)
def model(name,res='1k'):
    dst=os.path.join(ROOT,'assets/models',name+'.glb')
    if os.path.exists(dst): print('have',name); return
    f=json.loads(get('https://api.polyhaven.com/files/'+name))['gltf'][res]['gltf']
    g=json.loads(get(f['url'])); files={k:get(v['url']) for k,v in f['include'].items()}
    # one binary chunk: the original .bin first, then every image as its own bufferView
    binname=g['buffers'][0]['uri']; data=bytearray(files[binname])
    def pad(b):
        while len(b)%4: b.append(0)
    for img in g.get('images',[]):
        uri=img.pop('uri'); pad(data); bv={'buffer':0,'byteOffset':len(data),'byteLength':len(files[uri])}
        data+=files[uri]; g['bufferViews'].append(bv); img['bufferView']=len(g['bufferViews'])-1
        img['mimeType']='image/png' if uri.lower().endswith('.png') else 'image/jpeg'
    pad(data); g['buffers']=[{'byteLength':len(data)}]
    js=json.dumps(g,separators=(',',':')).encode()
    while len(js)%4: js+=b' '
    glb=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(data))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(data),0x004E4942)+bytes(data)
    os.makedirs(os.path.dirname(dst),exist_ok=True); open(dst,'wb').write(glb); print('model',name,len(glb)//1024,'KB')
if __name__=='__main__' and sys.argv[1] in ('tex','model'):
    kind=sys.argv[1]
    for n in sys.argv[2:]:
        try: (tex if kind=='tex' else model)(n)
        except Exception as e: print('FAIL',n,e)
def shrink(path,maxpx=512,q=80):
    """re-encode every texture inside a .glb at <=maxpx, JPEG q (keeps the game small + fast)"""
    import io; from PIL import Image
    b=open(path,'rb').read(); jl=struct.unpack('<I',b[12:16])[0]; g=json.loads(b[20:20+jl]); bl=struct.unpack('<I',b[20+jl:24+jl])[0]; data=b[28+jl:28+jl+bl]
    imgs={im['bufferView'] for im in g.get('images',[])}
    newdata=bytearray(); views=[]
    for i,bv in enumerate(g['bufferViews']):
        chunk=data[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]
        if i in imgs:
            im=Image.open(io.BytesIO(chunk)); im.thumbnail((maxpx,maxpx)); o=io.BytesIO(); im.convert('RGB').save(o,'JPEG',quality=q); chunk=o.getvalue()
        while len(newdata)%4: newdata.append(0)
        bv=dict(bv); bv['byteOffset']=len(newdata); bv['byteLength']=len(chunk); newdata+=chunk; views.append(bv)
    for im in g.get('images',[]): im['mimeType']='image/jpeg'
    while len(newdata)%4: newdata.append(0)
    g['bufferViews']=views; g['buffers']=[{'byteLength':len(newdata)}]
    js=json.dumps(g,separators=(',',':')).encode()
    while len(js)%4: js+=b' '
    out=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(newdata))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(newdata),0x004E4942)+bytes(newdata)
    open(path,'wb').write(out); print('shrunk',os.path.basename(path),len(b)//1024,'->',len(out)//1024,'KB')
if __name__=='__main__' and sys.argv[1]=='shrink':
    for n in sys.argv[2:]: shrink(n)
