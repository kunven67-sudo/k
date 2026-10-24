// DOM UI: title menu, HUD, settings, molt/evolution cards. Injected from JS.
const CSS=`
#ui{position:fixed;inset:0;pointer-events:none;font-family:system-ui,Segoe UI,Roboto,sans-serif;z-index:10}
#ui .pane{pointer-events:auto}
.center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center}
.title{font-weight:900;letter-spacing:2px;font-size:min(13vw,96px);line-height:.9;
  background:linear-gradient(180deg,#f4f6ff,#9aa3b8 55%,#5a6072);-webkit-background-clip:text;background-clip:text;color:transparent;
  text-shadow:0 2px 30px rgba(120,160,255,.25);filter:drop-shadow(0 3px 2px #000)}
.title .red{color:#d31420;-webkit-text-fill-color:#d31420}
.sub{color:#aab;letter-spacing:4px;font-size:14px;text-transform:uppercase;opacity:.8}
.btn{pointer-events:auto;cursor:pointer;border:1px solid #5a6686;background:rgba(18,22,34,.8);color:#e8ecff;
  padding:12px 30px;border-radius:10px;font-size:18px;font-weight:700;letter-spacing:1px;transition:.15s;min-width:200px}
.btn:hover{background:rgba(40,52,86,.95);border-color:#8ea0ff;transform:translateY(-1px)}
.btn.small{min-width:0;padding:8px 16px;font-size:14px}
.menu-bg{position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,rgba(40,20,60,.25),rgba(0,0,0,.72))}
#hud{position:absolute;inset:0;pointer-events:none;color:#fff;text-shadow:0 1px 3px #000}
.hudTL{position:absolute;left:16px;top:14px;font-size:13px;line-height:1.7}
.bar{width:180px;height:12px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.25);border-radius:7px;overflow:hidden;margin-top:2px}
.bar>i{display:block;height:100%;width:50%;transition:width .2s}
.hpv{color:#ff6a6a;font-weight:800;font-size:20px}
.sizev{position:absolute;left:50%;top:14px;transform:translateX(-50%);text-align:center}
.sizeBig{font-size:26px;font-weight:900;letter-spacing:1px}
.sizeAs{font-size:12px;opacity:.8}
.hint{position:absolute;left:50%;bottom:9%;transform:translateX(-50%);background:rgba(10,12,20,.7);
  border:1px solid rgba(255,255,255,.2);padding:9px 18px;border-radius:24px;font-size:15px;opacity:0;transition:opacity .3s}
.hint.show{opacity:1}
.crosshair{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border:1px solid rgba(255,255,255,.7);border-radius:50%}
.news{position:absolute;right:14px;top:14px;width:230px;font-size:12px;text-align:right;opacity:.9}
.news .n{background:rgba(10,12,20,.55);border-left:3px solid #d31420;padding:5px 8px;margin-bottom:5px;border-radius:4px;animation:slideIn .4s}
@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1}}
.cards{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;max-width:90vw}
.card{pointer-events:auto;cursor:pointer;width:200px;background:linear-gradient(180deg,rgba(30,34,52,.95),rgba(16,18,28,.95));
  border:1px solid #556;border-radius:14px;padding:16px;transition:.15s}
.card:hover{border-color:#ff5a6a;transform:translateY(-3px);box-shadow:0 10px 30px rgba(255,40,60,.2)}
.card h3{color:#ff8a98;margin-bottom:6px;font-size:18px}
.card p{font-size:13px;color:#bcc;line-height:1.4}
.flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .15s}
.cine{position:absolute;left:0;right:0;text-align:center;bottom:14%;font-size:clamp(18px,3vw,30px);font-weight:700;color:#fff;
  text-shadow:0 2px 20px #000,0 0 40px #d31420;opacity:0;transition:opacity .6s;padding:0 10%}
.cine.show{opacity:1}
.bars{position:absolute;left:0;right:0;height:0;background:#000;transition:height .5s}
.bars.t{top:0}.bars.b{bottom:0}.bars.on{height:11%}
.set{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.8)}
.setbox{pointer-events:auto;width:min(520px,92vw);max-height:86vh;overflow:auto;background:#12151f;border:1px solid #445;border-radius:16px;padding:22px}
.setbox h2{margin-bottom:14px;color:#cdd}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #23262f;font-size:14px}
.row select,.row input[type=range]{accent-color:#d31420}
.seg{display:flex;gap:4px}.seg button{cursor:pointer;background:#1c2030;border:1px solid #445;color:#ccd;border-radius:6px;padding:5px 10px;font-size:13px}
.seg button.on{background:#d31420;border-color:#d31420;color:#fff}
.fps{position:absolute;right:10px;bottom:10px;font-size:11px;color:#7f8;opacity:.7}
`;
export class UI{
  constructor(game){
    this.game=game;
    const s=document.createElement('style'); s.textContent=CSS; document.head.appendChild(s);
    const d=document.createElement('div'); d.id='ui'; document.body.appendChild(d); this.root=d;
    this._menu();
  }
  _el(html){ const t=document.createElement('div'); t.innerHTML=html.trim(); return t.firstChild; }
  clear(){ this.root.innerHTML=''; }
  _menu(){
    this.clear();
    const m=this._el(`<div class="pane"><div class="menu-bg"></div>
      <div class="center">
        <div class="sub">a spider that eats the world</div>
        <div class="title">APEX&nbsp;WID<span class="red">O</span>W</div>
        <button class="btn" id="play">PLAY</button>
        <button class="btn" id="settings">SETTINGS</button>
        <div class="sub" style="opacity:.5;font-size:11px">PC · keyboard + mouse · adults · max intensity</div>
      </div></div>`);
    this.root.appendChild(m);
    m.querySelector('#play').onclick=()=>this.game.start();
    m.querySelector('#settings').onclick=()=>this.settings(()=>this._menu());
  }
  hud(){
    this.clear();
    const h=this._el(`<div id="hud">
      <div class="hudTL">
        <div>HP <span class="hpv" id="hp">100</span></div>
        <div>Hunger<div class="bar"><i id="hunger" style="background:#ffb13b"></i></div></div>
        <div>Molt<div class="bar"><i id="molt" style="background:#b06bff"></i></div></div>
        <div>Silk<div class="bar"><i id="silk" style="background:#eef"></i></div></div>
        <div style="margin-top:4px;opacity:.85">Eaten <span id="kills">0</span></div>
      </div>
      <div class="sizev"><div class="sizeBig" id="size">2 mm</div><div class="sizeAs" id="sizeas">a lab spider</div></div>
      <div class="news" id="news"></div>
      <div class="crosshair"></div>
      <div class="hint" id="hint"></div>
      <div class="flash" id="flash"></div>
      <div class="bars t" id="barT"></div><div class="bars b" id="barB"></div>
      <div class="cine" id="cine"></div>
      <div class="fps" id="fps"></div>
    </div>`);
    this.root.appendChild(h);
    this.h={hp:h.querySelector('#hp'),hunger:h.querySelector('#hunger'),molt:h.querySelector('#molt'),
      silk:h.querySelector('#silk'),size:h.querySelector('#size'),sizeas:h.querySelector('#sizeas'),
      kills:h.querySelector('#kills'),hint:h.querySelector('#hint'),news:h.querySelector('#news'),
      flash:h.querySelector('#flash'),cine:h.querySelector('#cine'),barT:h.querySelector('#barT'),
      barB:h.querySelector('#barB'),fps:h.querySelector('#fps')};
  }
  setHUD(s){
    if(!this.h)return;
    this.h.hp.textContent=Math.max(0,Math.round(s.hp));
    this.h.hunger.style.width=(s.hunger*100).toFixed(0)+'%';
    this.h.molt.style.width=(s.molt*100).toFixed(0)+'%';
    this.h.silk.style.width=(s.silk*100).toFixed(0)+'%';
    this.h.kills.textContent=s.kills;
    this.h.size.textContent=s.sizeLabel; this.h.sizeas.textContent='as big as '+s.asBig;
  }
  hint(t){ if(!this.h)return; if(t){this.h.hint.textContent=t;this.h.hint.classList.add('show');} else this.h.hint.classList.remove('show'); }
  news(t){ if(!this.h)return; const n=this._el(`<div class="n">${t}</div>`); this.h.news.prepend(n); setTimeout(()=>n.remove(),6000); while(this.h.news.children.length>4)this.h.news.lastChild.remove(); }
  flash(c='#fff'){ if(!this.h)return; this.h.flash.style.background=c; this.h.flash.style.opacity='.9'; setTimeout(()=>this.h.flash.style.opacity='0',120); }
  cine(t){ if(!this.h)return; if(t){this.h.cine.textContent=t;this.h.cine.classList.add('show');}else this.h.cine.classList.remove('show'); }
  bars(on){ if(!this.h)return; this.h.barT.classList.toggle('on',on); this.h.barB.classList.toggle('on',on); }
  cards(title, opts, cb){
    const c=this._el(`<div class="pane"><div class="menu-bg"></div><div class="center">
      <div class="title" style="font-size:min(7vw,40px)">${title}</div>
      <div class="cards"></div></div></div>`);
    const box=c.querySelector('.cards');
    opts.forEach(o=>{const el=this._el(`<div class="card"><h3>${o.name}</h3><p>${o.desc}</p></div>`);el.onclick=()=>{c.remove();cb(o);};box.appendChild(el);});
    this.root.appendChild(c); this._cardPane=c;
  }
  settings(back){
    const g=this.game, s=g.settings;
    const box=this._el(`<div class="pane set"><div class="setbox">
      <h2>SETTINGS</h2>
      <div class="row">Graphics <div class="seg" id="q">
        ${['Auto','Low','Med','High','Ultra'].map(x=>`<button data-q="${x}">${x}</button>`).join('')}</div></div>
      <div class="row">Gore <div class="seg" id="gore">
        ${['Low','Medium','MAX'].map(x=>`<button data-g="${x}">${x}</button>`).join('')}</div></div>
      <div class="row">Spider fear mode <input type="checkbox" id="fear"></div>
      <div class="row">Music <input type="range" id="mus" min="0" max="1" step="0.05"></div>
      <div class="row">Sound FX <input type="range" id="sfx" min="0" max="1" step="0.05"></div>
      <div class="row">Camera shake <input type="checkbox" id="shake"></div>
      <div class="row">Sensitivity <input type="range" id="sens" min="0.0008" max="0.006" step="0.0002"></div>
      <div class="row" style="border:0;justify-content:center;margin-top:10px"><button class="btn small" id="back">BACK</button></div>
    </div></div>`);
    this.root.appendChild(box);
    const setSeg=(id,val,attr)=>{box.querySelectorAll(`#${id} button`).forEach(b=>b.classList.toggle('on',b.dataset[attr]===val));};
    setSeg('q',s.quality,'q'); setSeg('gore',s.gore,'g');
    box.querySelectorAll('#q button').forEach(b=>b.onclick=()=>{s.quality=b.dataset.q;setSeg('q',s.quality,'q');g.applyQuality();});
    box.querySelectorAll('#gore button').forEach(b=>b.onclick=()=>{s.gore=b.dataset.g;setSeg('gore',s.gore,'g');});
    const fear=box.querySelector('#fear');fear.checked=s.fear;fear.onchange=()=>{s.fear=fear.checked;g.applyFear&&g.applyFear();};
    const mus=box.querySelector('#mus');mus.value=g.audio.mus;mus.oninput=()=>{g.audio.mus=+mus.value;g.audio.setIntensity(g._intensity||0);};
    const sfx=box.querySelector('#sfx');sfx.value=g.audio.sfx;sfx.oninput=()=>{g.audio.sfx=+sfx.value;};
    const shake=box.querySelector('#shake');shake.checked=s.shake;shake.onchange=()=>s.shake=shake.checked;
    const sens=box.querySelector('#sens');sens.value=g.ctrl?g.ctrl.sens:0.0025;sens.oninput=()=>{if(g.ctrl)g.ctrl.sens=+sens.value;};
    box.querySelector('#back').onclick=()=>{box.remove();back&&back();};
  }
}
