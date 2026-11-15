#!/usr/bin/env python3
"""MakeHuman CC0 base body -> one compact game body for the ANT WORK rig.
   - 163 MakeHuman bones folded into the game rig joints (+ fingers, thumb, jaw)
   - arms + legs posed straight down (the rig's rest pose), metres, feet on y=0
   - every vertex tagged with a body part (so clothes can be cut per character)
   writes a JS module: const MHBODY={...base64 arrays...}"""
import json, math, base64, struct, sys, os
import numpy as np
D=os.path.dirname(os.path.abspath(__file__))
OUT=sys.argv[1:] or [os.path.join(D,'06b_mhbody.js')]

# ---------- the OBJ ----------
V=[];VT=[];faces=[];grp='?'
for ln in open(os.path.join(D,'base.obj')):
    if ln.startswith('v '): V.append([float(x) for x in ln.split()[1:4]])
    elif ln.startswith('vt '): VT.append([float(x) for x in ln.split()[1:3]])
    elif ln.startswith('g '): grp=ln.split()[1].strip()
    elif ln.startswith('f '):
        f=[tuple(int(x) if x else 0 for x in t.split('/')[:2]) for t in ln.split()[1:]]
        faces.append((grp,f))
V=np.array(V,dtype=np.float64)
def target(name):
    d=np.zeros_like(V)
    for ln in open(os.path.join(D,name+'.target')):
        if ln.startswith('#') or not ln.strip(): continue
        a=ln.split(); d[int(a[0])]=[float(a[1]),float(a[2]),float(a[3])]
    return d
# a MAN: MakeHuman's own male body shape (average of its three male targets), baked into the base
V=V+(target('caucasian-male-young')+target('african-male-young')+target('asian-male-young'))/3
DMUS=target('universal-male-young-maxmuscle-averageweight'); DWGT=target('universal-male-young-averagemuscle-maxweight')
skel=json.load(open(os.path.join(D,'default.mhskel'))); B=skel['bones']; JNT=skel['joints']
W=json.load(open(os.path.join(D,'default_weights.mhw')))['weights']
def jpos(name): return V[JNT[name]].mean(axis=0)
def bhead(b): return jpos(B[b]['head'])

# ---------- MakeHuman bone -> game bone ----------
def anc(b):
    out=[]
    while b: out.append(b); b=B[b].get('parent')
    return out
def mapbone(b):
    a=anc(b)
    if 'jaw' in a: return 'jaw'
    if any(x in a for x in ('head',)) and b not in ('neck01','neck02'): return 'head'
    if b in ('neck03',): return 'head'
    if b in ('neck01','neck02'): return 'chest'
    for s in ('L','R'):
        if b.endswith('.'+s):
            base=b[:-2]
            if base in ('upperarm01','upperarm02','shoulder01'): return 'sh'+s
            if base in ('lowerarm01','lowerarm02'): return 'el'+s
            if base in ('wrist',) or base.startswith('metacarpal'): return 'hd'+s
            if base.startswith('finger1-'): return 't'+s+('0' if base=='finger1-1' else '1')
            if base.startswith('finger'):
                i=int(base[6])-2; k=int(base[8])-1; return 'f'+s+str(i)+'abc'[k]
            if base in ('upperleg01','upperleg02'): return 'th'+s
            if base in ('lowerleg01','lowerleg02'): return 'kn'+s
            if base=='foot' or base.startswith('toe'): return 'ft'+s
            if base in ('clavicle','breast'): return 'chest'
            if base=='pelvis': return 'hips'
    if b in ('spine01','spine02'): return 'chest'
    if b in ('spine03','spine04'): return 'spine'
    if b in ('spine05','root'): return 'hips'
    raise Exception('unmapped '+b)
def partof(b):
    a=anc(b); base=b[:-2] if b[-2:] in ('.L','.R') else b
    if b in ('neck01','neck02','neck03'): return 1
    if 'head' in a: return 11 if base=='eye' else 0
    if base in ('spine01','spine02','clavicle','breast'): return 2
    if base in ('spine03','spine04'): return 3
    if base in ('spine05','root','pelvis'): return 4
    if base in ('shoulder01','upperarm01','upperarm02'): return 5
    if base in ('lowerarm01','lowerarm02'): return 6
    if base in ('wrist',) or base.startswith(('metacarpal','finger')): return 7
    if base in ('upperleg01','upperleg02'): return 8
    if base in ('lowerleg01','lowerleg02'): return 9
    if base=='foot' or base.startswith('toe'): return 10
    return 0
BONES=['root','hips','spine','chest','head','jaw']
for s in 'LR': BONES+=['sh'+s,'el'+s,'hd'+s]
for s in 'LR': BONES+=['th'+s,'kn'+s,'ft'+s]
for s in 'LR':
    for i in range(4): BONES+=['f'+s+str(i)+c for c in 'abc']
    BONES+=['t'+s+'0','t'+s+'1']
PARENT={'root':None,'hips':'root','spine':'hips','chest':'spine','head':'chest','jaw':'head'}
for s in 'LR':
    PARENT.update({'sh'+s:'chest','el'+s:'sh'+s,'hd'+s:'el'+s,'th'+s:'root','kn'+s:'th'+s,'ft'+s:'kn'+s,'t'+s+'0':'hd'+s,'t'+s+'1':'t'+s+'0'})
    for i in range(4): PARENT.update({'f'+s+str(i)+'a':'hd'+s,'f'+s+str(i)+'b':'f'+s+str(i)+'a','f'+s+str(i)+'c':'f'+s+str(i)+'b'})
BI={b:i for i,b in enumerate(BONES)}

# pivots (MakeHuman units, before posing)
PIV={'root':np.array([0,0,0.])}
PIV['hips']=bhead('spine05'); PIV['spine']=bhead('spine03'); PIV['chest']=bhead('spine01'); PIV['head']=bhead('neck03'); PIV['jaw']=bhead('jaw')
for s in 'LR':
    PIV['sh'+s]=bhead('upperarm01.'+s); PIV['el'+s]=bhead('lowerarm01.'+s); PIV['hd'+s]=bhead('wrist.'+s)
    PIV['th'+s]=bhead('upperleg01.'+s); PIV['kn'+s]=bhead('lowerleg01.'+s); PIV['ft'+s]=bhead('foot.'+s)
    for i in range(4):
        for k,c in enumerate('abc'): PIV['f'+s+str(i)+c]=bhead('finger%d-%d.%s'%(i+2,k+1,s))
    PIV['t'+s+'0']=bhead('finger1-2.'+s); PIV['t'+s+'1']=bhead('finger1-3.'+s)
PIV['root']=np.array([0,V[:,1].min(),PIV['hips'][2]])

# ---------- per-vertex weights (game bones) + body part ----------
n=len(V); acc=[dict() for _ in range(n)]; pw=[dict() for _ in range(n)]; BRW=np.zeros(n)
for b,lst in W.items():
    gb=mapbone(b); pt=partof(b)
    for vi,w in lst:
        acc[vi][gb]=acc[vi].get(gb,0)+w; pw[vi][pt]=pw[vi].get(pt,0)+w
        if b.startswith('breast'): BRW[vi]+=w
SJ=np.zeros((n,4),dtype=np.int32); SW=np.zeros((n,4)); PART=np.zeros(n,dtype=np.int32)
for i in range(n):
    it=sorted(acc[i].items(),key=lambda x:-x[1])[:4]; tot=sum(w for _,w in it) or 1
    for k,(b,w) in enumerate(it): SJ[i,k]=BI[b]; SW[i,k]=w/tot
    if not it: SJ[i,0]=BI['root']; SW[i,0]=1
    PART[i]=max(pw[i].items(),key=lambda x:x[1])[0] if pw[i] else 0

# ---------- pose arms + legs straight down (rotation about z at each joint), linear blend skinning ----------
def rotz(a): c,s=math.cos(a),math.sin(a); return np.array([[c,-s,0],[s,c,0],[0,0,1.]])
def M4(R,p): m=np.eye(4); m[:3,:3]=R; m[:3,3]=p-R@p; return m
LOC={b:np.eye(4) for b in BONES}
WORLD={}
def world(b):
    if b in WORLD: return WORLD[b]
    p=PARENT[b]; WORLD[b]=(world(p) if p else np.eye(4))@LOC[b]; return WORLD[b]
def align(d,t):   # minimal rotation taking direction d onto t (no twist around the bone)
    d=d/np.linalg.norm(d); t=t/np.linalg.norm(t); v=np.cross(d,t); c=float(np.dot(d,t)); sn=np.linalg.norm(v)
    if sn<1e-9: return np.eye(3)
    K=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]); return np.eye(3)+K+K@K*((1-c)/(sn*sn))
def straighten(b,child):
    WORLD.clear(); Wb=world(b); a=Wb@np.append(PIV[b],1); c=Wb@np.append(PIV[child],1); d=(c-a)[:3]
    Rw=align(d,np.array([0,-1.,0])); Rp=Wb[:3,:3]
    LOC[b]=M4(Rp.T@Rw@Rp,PIV[b])   # world-space correction expressed in the bone's rest frame
for s in 'LR':
    straighten('sh'+s,'el'+s); straighten('el'+s,'hd'+s)
    straighten('th'+s,'kn'+s); straighten('kn'+s,'ft'+s)
WORLD.clear(); MAT=np.array([world(b) for b in BONES])
Vh=np.c_[V,np.ones(n)]; P=np.zeros((n,3))
for k in range(4):
    P+=SW[:,k:k+1]*np.einsum('nij,nj->ni',MAT[SJ[:,k]],Vh)[:,:3]
PIVW={b:(MAT[BI[b]]@np.append(PIV[b],1))[:3] for b in BONES}
def posed(dl):   # a shape delta, turned the same way the arms/legs were
    out=np.zeros((n,3))
    for k in range(4): out+=SW[:,k:k+1]*np.einsum('nij,nj->ni',MAT[SJ[:,k]][:,:3,:3],dl)
    return out
PMUS=posed(DMUS); PWGT=posed(DWGT)

# ---------- metres, feet on the floor, hips over the origin ----------
ymin=P[:,1].min(); top=P[:,1].max(); S=1.76/(top-ymin)
off=np.array([0,-ymin,-PIVW['hips'][2]])
P=(P+off)*S
for b in PIVW: PIVW[b]=(PIVW[b]+off)*S
PIVW['root']=np.array([0,0,0.])

# ---------- triangles (split vertices on UV seams), pieces ----------
PIECE_OF=lambda g: 'body' if g=='body' else 'eyeL' if g=='helper-l-eye' else 'eyeR' if g=='helper-r-eye' else 'teethU' if g=='helper-upper-teeth' else 'teethL' if g=='helper-lower-teeth' else 'tongue' if g=='helper-tongue' else 'lashes' if 'eyelashes' in g else None
pieces={}
for g,f in faces:
    pc=PIECE_OF(g)
    if pc: pieces.setdefault(pc,[]).append(f)
key={}; outV=[]; outUV=[]; outSrc=[]; IDX=[]; RANGES={}
for pc in ['body','eyeL','eyeR','teethU','teethL','tongue','lashes']:
    st=len(IDX)
    for f in pieces.get(pc,[]):
        ids=[]
        for vi,ti in f:
            k=(vi,ti)
            if k not in key: key[k]=len(outV); outV.append(vi-1); outUV.append(VT[ti-1] if ti else [0,0])
            ids.append(key[k])
        for t in range(1,len(ids)-1): IDX+= [ids[0],ids[t],ids[t+1]]
    RANGES[pc]=[st,len(IDX)-st]
src=np.array(outV); POS=P[src].astype(np.float32); UV=np.array(outUV,dtype=np.float32)
# smooth normals on the ORIGINAL vertices (so UV seams don't show in the lighting)
NO=np.zeros((n,3))
for g,f in faces:
    if not PIECE_OF(g): continue
    ids=[vi-1 for vi,_ in f]
    for t in range(1,len(ids)-1):
        a,b,c=P[ids[0]],P[ids[t]],P[ids[t+1]]; fn=np.cross(b-a,c-a)
        for q in (ids[0],ids[t],ids[t+1]): NO[q]+=fn
NO/=np.maximum(np.linalg.norm(NO,axis=1,keepdims=True),1e-9)
NRM=NO[src].astype(np.float32)
SJo=SJ[src].astype(np.uint8); SWo=np.round(SW[src]*255).astype(np.int32)
for i in range(len(SWo)):   # make the 4 weights sum to exactly 255
    SWo[i,0]+=255-SWo[i].sum()
SWo=np.clip(SWo,0,255).astype(np.uint8)
PARTo=PART[src].astype(np.uint8); BRWo=np.clip(BRW[src]*255,0,255).astype(np.uint8)
for pc,code in (('eyeL',11),('eyeR',11),('teethU',12),('teethL',12),('tongue',12),('lashes',13)):
    st,cnt=RANGES[pc]
    for vi in set(IDX[st:st+cnt]): PARTo[vi]=code
IDXa=np.array(IDX,dtype=np.uint16 if len(POS)<65536 else np.uint32)

# ---------- face landmarks (for my own per-character face shapes) ----------
headv=[i for i in range(len(POS)) if PARTo[i]==0]
H=POS[headv]; front=H[:,2].max()
def near(c): return c.tolist()
L={}
L['headC']=near((PIVW['head']+np.array([0,(H[:,1].max()-PIVW['head'][1])*.45,0])))
L['skullTop']=near(H[H[:,1].argmax()])
cen=H[np.abs(H[:,0])<.008]
L['noseTip']=near(cen[cen[:,2].argmax()])
ny=L['noseTip'][1]
low=cen[cen[:,1]<ny-.03]; L['chin']=near(low[low[:,1].argmin()] if len(low) else cen[cen[:,1].argmin()])
L['mouth']=near(np.array([0,ny-.035,low[:,2].max() if len(low) else front-.01]))
for s,sg in (('L',1),('R',-1)):
    side=H[H[:,0]*sg>.03]
    L['eye'+s]=near(POS[[i for i in range(len(POS)) if PARTo[i]==11 and POS[i,0]*sg>0]].mean(axis=0))
    jw=side[(side[:,1]<ny-.02)&(side[:,1]>ny-.08)]; L['jaw'+s]=near(jw[(jw[:,0]*sg).argmax()]) if len(jw) else L['chin']
    ck=side[(np.abs(side[:,1]-(ny+.005))<.012)]; L['cheek'+s]=near(ck[ck[:,2].argmax()] if len(ck) else L['noseTip'])
    br=side[(side[:,1]>L['eye'+s][1]+.015)&(side[:,1]<L['eye'+s][1]+.04)]; L['brow'+s]=near(br[br[:,2].argmax()] if len(br) else L['eye'+s])

def sparse(dl):
    d=dl[src]*S; keep=np.where(np.abs(d).max(axis=1)>2e-5)[0]
    q=np.clip(np.round(d[keep]*8000),-32767,32767).astype(np.int16)
    return keep.astype(np.uint16),q
MI,MQ=sparse(PMUS); WI,WQ=sparse(PWGT)
def b64(a): return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
data={'bones':BONES,'parent':[PARENT[b] for b in BONES],'piv':{b:[round(float(x),5) for x in PIVW[b]] for b in BONES},
      'n':len(POS),'pos':b64(POS),'nrm':b64(NRM),'uv':b64(UV),'idx':b64(IDXa),'idx32':IDXa.dtype==np.uint32,'sj':b64(SJo),'sw':b64(SWo),'part':b64(PARTo),'brw':b64(BRWo),'oid':b64(src.astype(np.uint16)),'musI':b64(MI),'musD':b64(MQ),'wgtI':b64(WI),'wgtD':b64(WQ),
      'ranges':RANGES,'lm':{k:[round(float(x),5) for x in v] for k,v in L.items()}}
js='/* MakeHuman base body (CC0, makehumancommunity.org) folded into the ANT WORK rig. Built by tools/mhbody.py. */\nconst MHBODY='+json.dumps(data,separators=(',',':'))+';\n'
for o in OUT: open(o,'w').write(js)
print('verts',len(POS),'tris',len(IDX)//3,'KB',len(js)//1024, 'height', round(float(P[:,1].max()),3))
print('piv', {b:[round(float(x),3) for x in PIVW[b]] for b in ['hips','spine','chest','head','jaw','shL','elL','hdL','thL','knL','ftL']})
print('lm', {k:[round(x,3) for x in v] for k,v in L.items()})
