/* ================================================================
   PEOPLE v2: the MakeHuman CC0 base body (a neutral artist-made body,
   not a scan) on the game rig. Everything that makes a person THEM is
   done here: face shape (from their own face numbers), build, clothes cut
   from the body (real fabric), hair / brows / beard grown as shells,
   eyes with their iris colour. Every pose, walk and talk of the old rig
   drives it (the old code-built body is hidden, attachments stay).
   ================================================================ */
const MH={data:null};
function mhData(){
  if(MH.data) return MH.data; const d=MHBODY;
  const dec=(s,T)=>{ const b=atob(s), u=new Uint8Array(b.length); for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return new T(u.buffer); };
  const D={bones:d.bones,parent:d.parent,piv:d.piv,lm:d.lm,ranges:d.ranges,n:d.n,
    pos:dec(d.pos,Float32Array),nrm:dec(d.nrm,Float32Array),uv:dec(d.uv,Float32Array),idx:dec(d.idx,d.idx32?Uint32Array:Uint16Array),
    sj:dec(d.sj,Uint8Array),sw:dec(d.sw,Uint8Array),part:dec(d.part,Uint8Array),brw:d.brw?dec(d.brw,Uint8Array):null,oid:d.oid?dec(d.oid,Uint16Array):null,musI:d.musI?dec(d.musI,Uint16Array):null,musD:d.musD?dec(d.musD,Int16Array):null,wgtI:d.wgtI?dec(d.wgtI,Uint16Array):null,wgtD:d.wgtD?dec(d.wgtD,Int16Array):null};
  D.bi={}; D.bones.forEach((b,i)=>D.bi[b]=i);
  MH.data=D; return D;
}
function mhEyeTex(hex){ const key='mhEye'+hex; if(TEXCACHE[key]) return TEXCACHE[key];
  const t=canvasTex(256,256,(x,w,h)=>{ const c=w/2;
    const sg=x.createRadialGradient(c,c,w*.1,c,c,w*.5); sg.addColorStop(0,'#f6f1ea'); sg.addColorStop(.75,'#eee6dc'); sg.addColorStop(1,'#d9b5aa'); x.fillStyle=sg; x.fillRect(0,0,w,h);
    for(let i=0;i<14;i++){ x.strokeStyle='rgba(190,60,60,.18)'; x.lineWidth=.6; x.beginPath(); const a=Math.random()*7; x.moveTo(c+Math.cos(a)*w*.48,c+Math.sin(a)*w*.48); x.quadraticCurveTo(c+Math.cos(a+.2)*w*.38,c+Math.sin(a+.2)*w*.38,c+Math.cos(a+.1)*w*.3,c+Math.sin(a+.1)*w*.3); x.stroke(); }
    const ic=new THREE.Color(hex); const r=w*.2;
    const ig=x.createRadialGradient(c,c,r*.3,c,c,r); ig.addColorStop(0,'#'+ic.clone().multiplyScalar(.55).getHexString()); ig.addColorStop(.6,'#'+ic.getHexString()); ig.addColorStop(.92,'#'+ic.clone().multiplyScalar(.6).getHexString()); ig.addColorStop(1,'#1a1410');
    x.fillStyle=ig; x.beginPath(); x.arc(c,c,r,0,7); x.fill();
    for(let i=0;i<90;i++){ const a=Math.random()*7; x.strokeStyle=`rgba(${Math.random()<.5?'255,255,255':'0,0,0'},${Math.random()*.18})`; x.lineWidth=.8; x.beginPath(); x.moveTo(c+Math.cos(a)*r*.38,c+Math.sin(a)*r*.38); x.lineTo(c+Math.cos(a)*r*.95,c+Math.sin(a)*r*.95); x.stroke(); }
    x.fillStyle='#050505'; x.beginPath(); x.arc(c,c,r*.36,0,7); x.fill();
    x.fillStyle='rgba(255,255,255,.85)'; x.beginPath(); x.arc(c-r*.3,c-r*.32,r*.12,0,7); x.fill(); });
  TEXCACHE[key]=t; return t; }

/* one person's geometry: face + build + clothes + hair, all from their own numbers */
function mhGeometry(opt,mats){
  const D=mhData(), n=D.n, P=new Float32Array(D.pos), part=D.part, lm=D.lm, piv=D.piv;
  const R=RNG(((opt.seed!=null?opt.seed*7919:0)+String(opt.name||'x').length*131+977)>>>0);
  const hd=opt.head||{}, v3=a=>new THREE.Vector3(a[0],a[1],a[2]);
  const isHead=i=>part[i]===0||part[i]===1;
  // ---- the face (their own numbers from the person generator: jaw, nose, chin, cheek, flat) ----
  const bump=(c,r,dx,dy,dz,only)=>{ const r2=2*r*r; for(let i=0;i<n;i++){ if(!(only?only(i):part[i]===0)) continue; const x=P[i*3]-c[0], y=P[i*3+1]-c[1], z=P[i*3+2]-c[2]; const k=Math.exp(-(x*x+y*y+z*z)/r2); if(k<.01) continue; P[i*3]+=dx*k; P[i*3+1]+=dy*k; P[i*3+2]+=dz*k; } };
  const nose=(hd.nose!=null?hd.nose:1)-1, jaw=(hd.jaw!=null?hd.jaw:.32)-.32, chin=(hd.chin!=null?hd.chin:1)-1, cheek=(hd.cheek!=null?hd.cheek:1)-1, flat=(hd.flat!=null?hd.flat:1)-1;
  bump(lm.noseTip,.016,0,-nose*.002,nose*.011);
  bump([lm.noseTip[0],lm.noseTip[1]+.012,lm.noseTip[2]-.008],.012,0,0,nose*.004+R()*.003-.0015);
  for(const [s,sg] of [['L',1],['R',-1]]){
    bump(lm['jaw'+s],.026,sg*jaw*.03,0,0);
    bump(lm['cheek'+s],.018,sg*cheek*.006,cheek*.002,cheek*.005-flat*.004);
    bump(lm['brow'+s],.016,0,R()*.002,(R()-.4)*.005);
  }
  bump(lm.chin,.019,0,-chin*.012,chin*.008);
  bump(lm.mouth,.014,0,0,(R()-.5)*.004-flat*.003);
  { const hs=1+((hd.ry!=null?hd.ry:.103)/.103-1)*.6, c=lm.headC; for(let i=0;i<n;i++){ if(part[i]!==0) continue; for(let k=0;k<3;k++) P[i*3+k]=c[k]+(P[i*3+k]-c[k])*hs; } }
  // ---- build: MakeHuman's own muscle + weight shapes (the body is already a man: its male shape is baked in) ----
  { const bw=opt.build||1, mus=opt.muscle!=null?opt.muscle:Math.max(0,Math.min(.8,(R()-.25)*.9+(bw<1?.15:0))), wgt=Math.max(0,Math.min(2.4,(bw-1)*6.5));   /* MakeHuman's max-weight shape is mild: big guys go past it */
    const ap=(I,Dq,k)=>{ if(!I||!k) return; for(let j=0;j<I.length;j++){ const v=I[j]; P[v*3]+=Dq[j*3]/8000*k; P[v*3+1]+=Dq[j*3+1]/8000*k; P[v*3+2]+=Dq[j*3+2]/8000*k; } };
    ap(D.musI,D.musD,mus); ap(D.wgtI,D.wgtD,wgt); }
  /* fresh smooth normals for THIS body shape (seam copies share one normal via the original vertex id) */
  let N=D.nrm;
  if(D.oid){ const NA=new Float32Array(65536*3), r=D.ranges.body, ix=D.idx; const va=new THREE.Vector3(), vb=new THREE.Vector3(), vc=new THREE.Vector3();
    for(let k=r[0];k<r[0]+r[1];k+=3){ const a=ix[k],b=ix[k+1],c=ix[k+2]; va.set(P[a*3],P[a*3+1],P[a*3+2]); vb.set(P[b*3],P[b*3+1],P[b*3+2]).sub(va); vc.set(P[c*3],P[c*3+1],P[c*3+2]).sub(va); vb.cross(vc);
      for(const v of [a,b,c]){ const o=D.oid[v]*3; NA[o]+=vb.x; NA[o+1]+=vb.y; NA[o+2]+=vb.z; } }
    N=new Float32Array(D.nrm); for(let i=0;i<n;i++){ if(part[i]>10) continue; const o=D.oid[i]*3, L=Math.hypot(NA[o],NA[o+1],NA[o+2]); if(L>1e-12){ N[i*3]=NA[o]/L; N[i*3+1]=NA[o+1]/L; N[i*3+2]=NA[o+2]/L; } } }
  /* CLOTHES = their own layer over the skin, with an exact cut line (hem, neckline, cuffs, sock line) done per pixel.
     cut(v) = how far inside the garment a vertex is (metres); the shader throws away pixels where it's < 0. */
  const longS=opt.sleeves==='long', shY=(piv.shL[1]+piv.elL[1])/2+.02, waistY=piv.hips[1]+.05, cuffY=piv.hdL[1]+.018, shoeY=piv.ftL[1]+.014;
  const neckY=(x,z)=>{ const r=Math.hypot(x,z)||1; return 1.456-.034*Math.max(0,z/r)-.006*Math.max(0,-z/r); };   /* a round crew neck */
  const idx=D.idx, T=idx.length/3;
  const arm=i=>part[i]>=5&&part[i]<=7, leg=i=>part[i]>=8&&part[i]<=10;
  const CUT={
    shirt:i=>{ const y=P[i*3+1], z=P[i*3+2]; if(part[i]===0||leg(i)) return -1; if(arm(i)) return longS?y-cuffY:y-shY; const r=Math.hypot(P[i*3],z-.012), open_=.064+.016*Math.max(0,(z-.012)/(r||1)); const nc=y<1.405?1:r-open_; return Math.min(nc,y-waistY+.015); },
    pants:i=>{ const y=P[i*3+1]; if(part[i]<=2||arm(i)) return -1; return Math.min(waistY+.012-y,y-shoeY); },
    shoes:i=>{ const y=P[i*3+1]; if(!leg(i)) return -1; return shoeY+.006-y; },
    vest:i=>{ if(!opt.vest) return -1; const y=P[i*3+1], z=P[i*3+2], x=P[i*3]; if(part[i]<=1||leg(i)||arm(i)) return -1; const open=z>0?Math.max(0,.082*(y-1.21)/.24):0; return Math.min(Math.abs(x)-open,y-(waistY-.04),(z<0?1.46:1.43)-y); },
    apron:i=>{ if(!opt.apron||!opt.apronMH) return -1;   /* off: on these bodies it read like a tunic */ const y=P[i*3+1], z=P[i*3+2], x=P[i*3]; if(part[i]<=1||arm(i)||(leg(i)&&y<waistY-.2)) return -1; return Math.min(z-.03,y-(waistY-.19),1.37-y,.165-Math.abs(x)); },
    coat:i=>{ if(!opt.coat) return -1; const y=P[i*3+1], z=P[i*3+2], x=P[i*3]; if(part[i]===0||leg(i)) return -1; if(arm(i)) return y-(cuffY+.025); const open=(z>.02&&y<1.39)?Math.abs(x)-.035:1; const neck=part[i]===1?1.475-y:1; return Math.min(open,neck,y-(waistY-.14)); } };
  const LAY=[['shirt',1,.013],['pants',2,.009],['shoes',3,.012],['vest',9,.022],['coat',8,.027],['apron',11,.034]];   /* clothes sit OFF the body */
  const tri=[[],[],[],[],[],[],[]], body=D.ranges.body;
  const under=v=>CUT.shirt(v)>.012||CUT.pants(v)>.012||CUT.shoes(v)>.012;   /* skin fully under clothes isn't drawn (it poked through + costs GPU) */
  tri[10]=[]; const oh=!!opt.oldHead; for(let k=body[0];k<body[0]+body[1];k+=3){ const a=idx[k],b=idx[k+1],c=idx[k+2]; if(under(a)&&under(b)&&under(c)) continue; if(oh&&(part[a]===0||part[b]===0||part[c]===0)) continue; if(opt.metalHandR&&part[a]===7&&P[a*3]<0) tri[10].push(a,b,c); else tri[0].push(a,b,c); }
  for(const [pc,m] of (opt.oldHead?[]:[['eyeL',4],['eyeR',4],['teethU',5],['teethL',5],['tongue',5],['lashes',6]])){ const r=D.ranges[pc]; for(let k=r[0];k<r[0]+r[1];k++) tri[m].push(idx[k]); }
  const lay={pos:[],nrm:[],uv:[],sj:[],sw:[],cut:[],src:[],idx:{}};
  let nl=0; const layBase=n;   // layer vertices are appended after the body
  for(const [name,m,inf] of LAY){ const fn=CUT[name], map=new Map(), out=[]; const cv=new Float32Array(n).fill(NaN);
    const cut=v=>{ if(isNaN(cv[v])) cv[v]=fn(v); return cv[v]; };
    for(let k=body[0];k<body[0]+body[1];k+=3){ const a=idx[k],b=idx[k+1],c=idx[k+2]; const ca=cut(a),cb=cut(b),cc=cut(c); if(Math.max(ca,cb,cc)<-.004) continue;
      for(const v of [a,b,c]){ if(!map.has(v)){ map.set(v,layBase+nl++); lay.src.push(v); lay.pos.push(P[v*3]+N[v*3]*inf,P[v*3+1]+N[v*3+1]*inf,P[v*3+2]+N[v*3+2]*inf); lay.nrm.push(N[v*3],N[v*3+1],N[v*3+2]); lay.uv.push(D.uv[v*2],D.uv[v*2+1]); for(let q=0;q<4;q++){ lay.sj.push(D.sj[v*4+q]); lay.sw.push(D.sw[v*4+q]); } lay.cut.push(cut(v)); } out.push(map.get(v)); } }
    /* fabric doesn't follow every muscle: smooth the garment's own surface a few times (keeps its size), then it drapes */
    { const start=layBase+nl-map.size, cnt=map.size, nb=new Map(); const loc=v=>v-start;
      for(let k=0;k<out.length;k+=3){ for(let q=0;q<3;q++){ const a=loc(out[k+q]), b=loc(out[k+(q+1)%3]); if(!nb.has(a)) nb.set(a,new Set()); if(!nb.has(b)) nb.set(b,new Set()); nb.get(a).add(b); nb.get(b).add(a); } }
      const base=start*3-layBase*3, pos=lay.pos, cp=lay.cut.length-cnt;
      for(let it=0;it<(name==='shoes'?1:name==='coat'?7:4);it++){ const tmp=new Float32Array(cnt*3);
        for(let v=0;v<cnt;v++){ const ns=nb.get(v); const o=base+v*3; if(!ns||lay.cut[cp+v]<.004){ tmp[v*3]=pos[o]; tmp[v*3+1]=pos[o+1]; tmp[v*3+2]=pos[o+2]; continue; }
          let x=0,y=0,z=0; for(const u of ns){ const q=base+u*3; x+=pos[q]; y+=pos[q+1]; z+=pos[q+2]; } const k=ns.size;
          tmp[v*3]=pos[o]*.5+x/k*.5; tmp[v*3+1]=pos[o+1]*.5+y/k*.5; tmp[v*3+2]=pos[o+2]*.5+z/k*.5; }
        for(let v=0;v<cnt;v++){ const o=base+v*3; pos[o]=tmp[v*3]; pos[o+1]=tmp[v*3+1]; pos[o+2]=tmp[v*3+2]; } } }
    /* lighting normals from the garment's own (smoothed) shape, seam copies averaged */
    { const start=layBase+nl-map.size, cnt=map.size, base=(start-layBase)*3, pos=lay.pos, acc=new Map(), va=new THREE.Vector3(), vb=new THREE.Vector3(), vc=new THREE.Vector3();
      const key=v=>D.oid?D.oid[lay.src[v-layBase]]:v;
      for(let k=0;k<out.length;k+=3){ const [a,b,c]=[out[k],out[k+1],out[k+2]].map(v=>(v-layBase)*3);
        va.set(pos[a],pos[a+1],pos[a+2]); vb.set(pos[b],pos[b+1],pos[b+2]).sub(va); vc.set(pos[c],pos[c+1],pos[c+2]).sub(va); vb.cross(vc);
        for(const v of [out[k],out[k+1],out[k+2]]){ const kk=key(v); const e=acc.get(kk)||[0,0,0]; e[0]+=vb.x; e[1]+=vb.y; e[2]+=vb.z; acc.set(kk,e); } }
      for(let v=start;v<start+cnt;v++){ const e=acc.get(key(v)); if(!e) continue; const L=Math.hypot(e[0],e[1],e[2])||1, o=(v-layBase)*3; lay.nrm[o]=e[0]/L; lay.nrm[o+1]=e[1]/L; lay.nrm[o+2]=e[2]/L; } }
    lay.idx[m]=out; }
  // ---- hair, brows, beard: shells grown off the head (new vertices, same bones as the skin under them) ----
  const extra={pos:[],nrm:[],uv:[],sj:[],sw:[],idx:[]}; let nx=n+nl;
  const shell=(want,thick,noise)=>{ const map=new Map(), sIdx=[]; const tw=v=>{ const w=want(v); return w>0?w:0; };
    for(let t=0;t<T;t++){ const a=idx[t*3],b=idx[t*3+1],c=idx[t*3+2]; if(part[a]>1||part[b]>1||part[c]>1) continue; const wa=tw(a),wb=tw(b),wc=tw(c); if(wa+wb+wc<.6) continue;
      const ids=[a,b,c].map(v=>{ if(map.has(v)) return map.get(v); const w=Math.min(1,want(v)), th=thick*Math.max(.15,w)*(1+(noise?(R()-.5)*noise:0));
        extra.pos.push(P[v*3]+N[v*3]*th,P[v*3+1]+N[v*3+1]*th,P[v*3+2]+N[v*3+2]*th); extra.nrm.push(N[v*3],N[v*3+1],N[v*3+2]); extra.uv.push(P[v*3]*9,P[v*3+1]*9);
        for(let k=0;k<4;k++){ extra.sj.push(D.sj[v*4+k]); extra.sw.push(D.sw[v*4+k]); } map.set(v,nx); return nx++; });
      sIdx.push(...ids); }
    return sIdx; };
  const brow=lm.browL[1], eyeZ=lm.eyeL[2], st=opt.hairStyle||'short';
  const hairW=v=>{ const y=P[v*3+1], z=P[v*3+2], x=P[v*3]; let line; if(z>eyeZ-.035) line=brow+.022+Math.abs(x)*.25; else if(Math.abs(x)>.05&&z>eyeZ-.115) line=lm.eyeL[1]+.016+(st==='long'?-.07:0); else line=lm.jawL[1]+.012+(st==='long'?-.07:0); return (y-line)/.015; };   /* front hairline, above the ears, down to the nape */
  const thick={bald:0,buzz:.0025,short:.009,curly:.016,spiky:.012,long:.012}[st]; let hairIdx=[];
  if(thick&&!opt.oldHead) hairIdx=shell(hairW,thick,st==='curly'?.9:st==='spiky'?1.4:.25);
  const browIdx=[];
  if(!opt.oldHead) for(const s of ['L','R']){ const b=lm['brow'+s]; browIdx.push(...shell(v=>{ const dx=(P[v*3]-b[0]*1.12)/.017, dy=(P[v*3+1]-b[1]-.0035-(Math.abs(P[v*3])-Math.abs(b[0]))*.12)/.0042; return P[v*3+2]>eyeZ?1.3-(dx*dx+dy*dy):0; },(opt.browThick||1)*.0013,.4)); }
  let beardIdx=[];
  if(opt.beard&&!opt.oldHead){ const m=lm.mouth; beardIdx=shell(v=>{ const y=P[v*3+1], z=P[v*3+2], x=P[v*3]; if(z<lm.jawL[2]-.03||y>lm.noseTip[1]-.012) return 0; const mx=x/.026, my=(y-m[1])/.009; if(mx*mx+my*my<1) return 0; return 1.2; },.005,.6); }
  // ---- one geometry, one draw group per material ----
  const g=new THREE.BufferGeometry();
  const cat=(T_,...arrs)=>{ let L=0; for(const a of arrs) L+=a.length; const o=new T_(L); let off=0; for(const a of arrs){ o.set(a,off); off+=a.length; } return o; };
  const UVb=new Float32Array(D.uv);
  for(const [s_,ec] of [['L',lm.eyeL],['R',lm.eyeR]]){ const [st_,cnt]=D.ranges['eye'+s_]; for(let k=st_;k<st_+cnt;k++){ const v=idx[k]; UVb[v*2]=.5+(P[v*3]-ec[0])/.026; UVb[v*2+1]=.5+(P[v*3+1]-ec[1])/.026; } }
  const ones=new Float32Array(n).fill(1), eone=new Float32Array(extra.pos.length/3).fill(1);
  g.setAttribute('position',new THREE.BufferAttribute(cat(Float32Array,P,lay.pos,extra.pos),3));
  g.setAttribute('normal',new THREE.BufferAttribute(cat(Float32Array,N,lay.nrm,extra.nrm),3));
  g.setAttribute('uv',new THREE.BufferAttribute(cat(Float32Array,UVb,lay.uv,extra.uv),2));
  g.setAttribute('skinIndex',new THREE.BufferAttribute(cat(Uint8Array,D.sj,lay.sj,extra.sj),4));
  g.setAttribute('skinWeight',new THREE.BufferAttribute(cat(Uint8Array,D.sw,lay.sw,extra.sw),4,true));
  g.setAttribute('cut',new THREE.BufferAttribute(cat(Float32Array,ones,lay.cut,eone),1));
  const all=[]; const grp=(arr,m)=>{ if(!arr||!arr.length) return; g.addGroup(all.length,arr.length,m); for(const v of arr) all.push(v); };
  tri.forEach((a,m)=>{ if(m>0&&m<4) return; grp(a,m); }); grp(lay.idx[1],1); grp(lay.idx[2],2); grp(lay.idx[3],3); grp(lay.idx[9],9); grp(lay.idx[8],8); grp(tri[10],10); grp(lay.idx[11],11); grp(hairIdx,7); grp(browIdx,7); grp(beardIdx,7);
  const tot=n+nl+extra.pos.length/3; g.setIndex(new THREE.BufferAttribute(tot>65535?new Uint32Array(all):new Uint16Array(all),1));
  g.computeBoundingSphere();
  return g;
}

/* swap a code-built person for the MakeHuman body (the rig, poses, props, voice all stay) */
function mhAttach(g){
  if(typeof MHBODY==='undefined') return; const U=g.userData, J=U.J, opt=U.opt, D=mhData();
  const keep=new Set(); if(opt.oldHead&&U.headJ) U.headJ.traverse(o=>keep.add(o));   /* oldHead: their own old face stays on the new body */
  g.traverse(o=>{ if((o.isMesh||o.isLine||o.isPoints)&&o.visible&&!keep.has(o)){ o.visible=false; o.userData.mhHidden=1; } });
  const pv=b=>new THREE.Vector3(...D.piv[b]), rel=(a,b)=>pv(a).sub(pv(b));
  // the rig joints move onto the new skeleton (so props in hands, hats, poses all line up)
  J.hips.position.copy(pv('hips')); U.hipY=J.hips.position.y; J.spine.position.copy(rel('spine','hips')); J.chest.position.copy(rel('chest','spine')); J.head.position.copy(rel('head','chest')); if(opt.oldHead){ J.head.position.add(new THREE.Vector3(0,-.028,.012)); J.head.scale.setScalar(1.22); }   /* the old head, sized for the new body */
  for(const s of ['L','R']){ J['sh'+s].position.copy(rel('sh'+s,'chest')); J['el'+s].position.copy(rel('el'+s,'sh'+s)); J['hd'+s].position.copy(rel('hd'+s,'el'+s));
    J['th'+s].position.copy(pv('th'+s)); J['kn'+s].position.copy(rel('kn'+s,'th'+s)); J['ft'+s].position.copy(rel('ft'+s,'kn'+s)); }
  // bones
  const bones={}, list=[];
  D.bones.forEach((b,i)=>{ const bo=new THREE.Bone(); bo.name='mh_'+b; const p=D.parent[i]; bo.position.copy(p?rel(b,p):pv(b)); bones[b]=bo; list.push(bo); if(p) bones[p].add(bo); });
  const mats=mhMats(U);
  const geo=mhGeometry(opt,mats);
  const sm=new THREE.SkinnedMesh(geo,mats); sm.name='mhBody'; sm.add(bones.root); sm.bind(new THREE.Skeleton(list)); sm.castShadow=true; sm.receiveShadow=true; sm.frustumCulled=false; g.add(sm);
  // who drives which bone: [bone, rig joint, inverse of the joint's rest rotation]
  const drive=[], add=(bn,o)=>{ if(o&&bones[bn]) drive.push([bones[bn],o,o.quaternion.clone().invert()]); };
  add('hips',J.hips); add('spine',J.spine); add('chest',J.chest); add('head',J.head); add('jaw',J.jaw);
  for(const s of ['L','R']){ for(const k of ['sh','el','hd','th','kn','ft']) add(k+s,J[k+s]);
    const H=U.hands&&U.hands[s]&&U.hands[s].H; if(H){ H.fingers.forEach((f,i)=>{ add('f'+s+i+'a',f.a); add('f'+s+i+'b',f.b); add('f'+s+i+'c',f.c); }); add('t'+s+'0',H.thumb); add('t'+s+'1',H.thumb2); } }
  U.mh={sm,bones,drive}; U.mats.mhMats=mats;
}
function mhMats(U){ const opt=U.opt; const M=U.mats, sk=m=>{ const c=m.clone(); c.skinning=true; return c; };
  const shoeM=new THREE.MeshPhysicalMaterial({color:col(opt.shoes!=null?opt.shoes:0x2a2420),roughness:.5,clearcoat:.25,clearcoatRoughness:.5});
  { const L=charTex().leather; if(L){ shoeM.map=L.map; shoeM.normalMap=L.normalMap; shoeM.roughnessMap=L.roughnessMap; } }
  const eyeM=new THREE.MeshPhysicalMaterial({map:mhEyeTex(opt.eye!=null?opt.eye:0x5a3a1a),roughness:.08,clearcoat:1,clearcoatRoughness:.02});
  const teethM=new THREE.MeshStandardMaterial({color:col(0xece4d6),roughness:.3});
  const lashM=new THREE.MeshStandardMaterial({color:col(0x1a120c),roughness:.8,visible:false});
  const hairM=M.hairM.clone(); hairM.polygonOffset=true; hairM.polygonOffsetFactor=-2; hairM.polygonOffsetUnits=-2;
  const cloth=(hex,set,rough)=>{ const m=new THREE.MeshPhysicalMaterial({color:col(hex),roughness:rough,sheen:col(0x222222)}); const T=charTex()[set]; if(T){ m.map=T.map; m.normalMap=T.normalMap; m.roughnessMap=T.roughnessMap; } return m; };
  const coatM=cloth(opt.coat!=null?opt.coat:0x4a3a2a,'coat',.92), vestM=cloth(opt.vest!=null?opt.vest:0x3a2a1a,'leather',.7), metalM=new THREE.MeshPhysicalMaterial({color:col(0x8a8a90),metalness:1,roughness:.35});
  const apronM=cloth(opt.apron!=null?opt.apron:0xe8e0d0,'cloth',.9);
  const mats=[M.skinM,M.shirtM,M.pantsM,shoeM,eyeM,teethM,lashM,hairM,coatM,vestM,metalM,apronM].map(sk);
  const rep=(m,r,keys=['map','normalMap','roughnessMap'])=>{ for(const k of keys) if(m[k]){ const t=m[k].clone(); t.needsUpdate=true; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(r,r); m[k]=t; } };
  const cutify=m=>{ const ob=m.onBeforeCompile; m.onBeforeCompile=(sh,r)=>{ if(ob) ob(sh,r); sh.vertexShader='attribute float cut;\nvarying float vCut;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCut=cut;'); sh.fragmentShader='varying float vCut;\n'+sh.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vCut<0.0) discard;'); }; const ck=m.customProgramCacheKey; m.customProgramCacheKey=()=>(ck?ck.call(m):'')+'cut'; };
  rep(mats[0],14,['normalMap']); skinify(mats[0]); [1,2,3,8,9,11].forEach(k=>cutify(mats[k])); rep(mats[1],22); rep(mats[2],20); rep(mats[3],7); rep(mats[8],16); rep(mats[9],9); rep(mats[11],20);   /* the body's UV map is one big sheet: fabric + pores tiled to real size */
  return mats; }
/* outfit changed after the body was made (cowboy coats, vests, a metal hand): rebuild the body's geometry + materials, same bones */
function mhRebuild(g){ const U=g.userData, M=U.mh; if(!M) return; const old=M.sm.geometry; M.sm.geometry=mhGeometry(U.opt); old.dispose(); M.sm.material=mhMats(U); U.mats.mhMats=M.sm.material; }
/* where a point of the base body sits relative to one of its bones (to pin hats, badges, mustaches on) */
function mhRel(p,bone){ const v=mhData().piv[bone]; return new THREE.Vector3(p[0]-v[0],p[1]-v[1],p[2]-v[2]); }
function mhChestFront(x,y){ const D=mhData(); let best=null; for(let i=0;i<D.n;i++){ if(D.part[i]!==2) continue; const px=D.pos[i*3], py=D.pos[i*3+1]; if(Math.abs(px-x)>.012||Math.abs(py-y)>.012) continue; if(!best||D.pos[i*3+2]>best[2]) best=[px,py,D.pos[i*3+2]]; } return best||[x,y,.12]; }
function mhSync(h){ const M=h.userData.mh; if(!M) return; for(const d of M.drive) d[0].quaternion.copy(d[2]).multiply(d[1].quaternion); }
