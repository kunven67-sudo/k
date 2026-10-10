// CSS for the DMV clipboard form and the photo-sequence overlays (scoped under .dmv / .dmvx).

import { injectStyle } from '../core/util.js';

const CSS = `
.dmv { position:absolute; left:calc(22px + var(--safe-left,0px)); top:18px; bottom:18px; width:min(440px, 42vw);
  display:flex; transition:transform .7s cubic-bezier(.6,-0.2,.3,1), opacity .5s; z-index:2; }
.dmv.away { transform:translateX(-115%) rotate(-6deg); opacity:0; pointer-events:none; }
.dmv.busy .dmv-paper { cursor:progress; }
.dmv-board { position:relative; flex:1; display:flex; padding:50px 14px 14px; border-radius:16px;
  background:
    radial-gradient(120% 80% at 30% 10%, rgba(255,255,255,.10), transparent 60%),
    repeating-linear-gradient(93deg, rgba(0,0,0,.05) 0 2px, transparent 2px 7px),
    repeating-linear-gradient(88deg, rgba(255,230,190,.05) 0 1px, transparent 1px 13px),
    linear-gradient(160deg, #8a6440, #6b4a2c 60%, #5a3d24);
  box-shadow: 0 30px 60px -20px rgba(0,0,0,.65), 0 2px 0 rgba(255,255,255,.12) inset, 0 -3px 0 rgba(0,0,0,.25) inset;
  transform: rotate(-.6deg); }
.dmv-clip { position:absolute; top:-10px; left:50%; width:150px; height:58px; transform:translateX(-50%);
  border-radius:10px 10px 18px 18px;
  background: linear-gradient(180deg,#f2f3f5,#a9adb5 45%,#e6e8ec 55%,#7d828b); box-shadow:0 6px 10px rgba(0,0,0,.45), 0 1px 0 #fff inset; z-index:3; }
.dmv-clip::after { content:''; position:absolute; left:18px; right:18px; bottom:8px; height:9px; border-radius:6px;
  background:linear-gradient(180deg,#5d626b,#c9ccd3); }
.dmv-clip-ring { position:absolute; top:9px; left:50%; width:34px; height:14px; transform:translateX(-50%); border-radius:8px;
  border:3px solid #6c7079; background:transparent; }
.dmv-paper { position:relative; flex:1; overflow-y:auto; overflow-x:hidden; border-radius:3px; padding:16px 18px 22px;
  color:#26303a; font-family:var(--font-ui); font-size:13px; -webkit-overflow-scrolling:touch; overscroll-behavior:contain;
  background:
    linear-gradient(90deg, transparent 22px, rgba(200,60,60,.22) 22px 23px, transparent 23px),
    radial-gradient(140% 90% at 70% 0%, #fbf8ef, #f1ead8 70%, #e9dfc7);
  box-shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 18px -12px rgba(0,0,0,.5);
  scrollbar-width:thin; scrollbar-color:#b9ab8a transparent; }
.dmv-paper::-webkit-scrollbar { width:8px; } .dmv-paper::-webkit-scrollbar-thumb { background:#c8b995; border-radius:4px; }
.dmv-head { display:grid; grid-template-columns:44px 1fr auto; gap:10px; align-items:center; padding:2px 0 8px 14px; border-bottom:2px solid #26303a; }
.dmv-seal { width:42px; height:42px; border-radius:50%; display:grid; place-items:center; border:2px solid #2c4a6e;
  box-shadow:0 0 0 3px #f6f1e3 inset, 0 0 0 4px #2c4a6e inset; color:#2c4a6e; font:400 15px var(--font-western); }
.dmv-dept { font:700 11px var(--font-ui); letter-spacing:.12em; text-transform:uppercase; }
.dmv-sub { font:500 10px var(--font-ui); letter-spacing:.06em; opacity:.7; }
.dmv-formno { font:400 10px var(--font-type); opacity:.6; text-align:right; max-width:90px; }
.dmv-title { font:400 22px/1.1 var(--font-type); margin:12px 0 8px 14px; letter-spacing:.01em; }
.dmv-sec { margin:0 0 0 14px; border-bottom:1px solid rgba(38,48,58,.35); }
.dmv-sec h2 { display:flex; align-items:center; gap:10px; margin:0; padding:11px 0; cursor:pointer; user-select:none;
  font:700 12px var(--font-ui); letter-spacing:.14em; text-transform:uppercase; outline:none; }
.dmv-sec h2:focus-visible { background:rgba(44,74,110,.08); }
.dmv-sec h2 b { width:22px; height:22px; display:grid; place-items:center; background:#26303a; color:#f6f1e3; font:400 13px var(--font-type); border-radius:2px; }
.dmv-sec h2 > span:nth-child(2) { flex:1; }
.dmv-sec .chev { width:9px; height:9px; border-right:2px solid #26303a; border-bottom:2px solid #26303a; transform:rotate(45deg); transition:transform .25s; margin-right:6px; }
.dmv-sec.open .chev { transform:rotate(225deg); }
.dmv-shuffle { font:400 11px var(--font-type); color:#2c4a6e; background:none; border:1px dashed rgba(44,74,110,.55); padding:3px 7px; border-radius:3px; cursor:pointer; letter-spacing:0; text-transform:none; }
.dmv-shuffle:hover { background:rgba(44,74,110,.08); }
.dmv-sec-body { display:none; padding:2px 0 14px; }
.dmv-sec.open .dmv-sec-body { display:block; animation:dmvIn .28s ease-out; }
@keyframes dmvIn { from { opacity:0; transform:translateY(-4px); } }
.dmv-applicant h2 { cursor:default; }
.dmv-field { padding:6px 0 7px; border-top:1px dotted rgba(38,48,58,.25); }
.dmv-field:first-child { border-top:none; }
.dmv-field.muted { opacity:.35; pointer-events:none; }
.dmv-field label { display:flex; gap:6px; align-items:baseline; font:600 10px var(--font-ui); letter-spacing:.09em; text-transform:uppercase; color:#4a5560; margin-bottom:4px; }
.dmv-field label i { font-style:normal; opacity:.55; min-width:18px; }
.dmv-names { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.dmv-ink { font:italic 400 21px var(--font-casino); color:#1b2f86; background:transparent; border:none; border-bottom:1.5px solid #26303a;
  width:100%; padding:2px 2px 1px; outline:none; border-radius:0; }
.dmv-ink:focus { background:rgba(27,47,134,.05); }
.dmv-age { border:none; width:auto; margin-left:auto; font-size:20px; letter-spacing:0; text-transform:none; }
.dmv-note { font:400 11px var(--font-type); color:#7a6a52; margin-top:3px; }
.dmv-range { -webkit-appearance:none; appearance:none; width:100%; height:24px; background:transparent; margin:0; cursor:pointer; --track:linear-gradient(#26303a,#26303a); }
.dmv-range::-webkit-slider-runnable-track { height:6px; border-radius:1px;
  background: repeating-linear-gradient(90deg, rgba(38,48,58,.75) 0 1px, transparent 1px 10%), var(--track);
  background-size:100% 6px, 100% 2px; background-position:0 0, 0 2px; background-repeat:no-repeat; }
.dmv-range::-moz-range-track { height:6px; background: repeating-linear-gradient(90deg, rgba(38,48,58,.75) 0 1px, transparent 1px 10%), var(--track); background-size:100% 6px, 100% 2px; background-position:0 0, 0 2px; background-repeat:no-repeat; }
.dmv-range::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; margin-top:-8px; border-radius:50%; background:transparent;
  border:2.5px solid #1b2f86; box-shadow:0 0 0 1px rgba(27,47,134,.25), inset 0 0 0 4px rgba(27,47,134,.12); transform:rotate(-12deg); }
.dmv-range::-moz-range-thumb { width:18px; height:18px; border-radius:50%; background:transparent; border:2.5px solid #1b2f86; }
.dmv-checks { display:grid; grid-template-columns:repeat(auto-fill, minmax(104px,1fr)); gap:2px 8px; }
.dmv-check { display:flex; align-items:center; gap:7px; background:none; border:none; padding:4px 0; cursor:pointer; color:#26303a; font:500 12.5px var(--font-ui); text-align:left; }
.dmv-check .box { position:relative; flex:none; width:14px; height:14px; border:1.5px solid #26303a; background:#fffdf6; }
.dmv-check.on .box::before, .dmv-check.on .box::after { content:''; position:absolute; left:50%; top:50%; width:19px; height:2.6px; background:#1b2f86; border-radius:2px; }
.dmv-check.on .box::before { transform:translate(-50%,-50%) rotate(42deg); }
.dmv-check.on .box::after { transform:translate(-50%,-50%) rotate(-48deg); width:17px; }
.dmv-check.on .lbl { color:#1b2f86; font-weight:700; }
.dmv-check:hover .lbl { text-decoration:underline; text-decoration-style:dotted; }
.dmv-swatches { display:flex; flex-wrap:wrap; gap:6px; }
.dmv-swatch { width:26px; height:26px; border-radius:3px; border:1px solid rgba(0,0,0,.35); cursor:pointer; background:var(--c);
  background-image:repeating-linear-gradient(45deg, rgba(255,255,255,.08) 0 2px, transparent 2px 4px); box-shadow:0 1px 1px rgba(0,0,0,.2); }
.dmv-swatch.on { outline:2.5px solid #1b2f86; outline-offset:2px; border-radius:50%; }
.dmv-voices { display:grid; grid-template-columns:1fr; gap:0; max-height:170px; overflow:auto; }
.dmv-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
.dmv-stamp { font:400 13px var(--font-type); padding:7px 12px; border-radius:4px; cursor:pointer; background:transparent;
  color:#2c4a6e; border:2px solid #2c4a6e; transform:rotate(-1deg); transition:transform .12s, background .12s; }
.dmv-stamp:hover { background:rgba(44,74,110,.08); transform:rotate(-1deg) scale(1.03); }
.dmv-stamp:active { transform:rotate(-1deg) scale(.96); }
.dmv-foot { margin:16px 0 0 14px; display:grid; gap:12px; }
.dmv-sign { border-bottom:1.5px solid #26303a; position:relative; min-height:42px; display:flex; align-items:flex-end; }
.dmv-sign .sig { font:italic 400 26px var(--font-casino); color:#1b2f86; transform:rotate(-3deg); transform-origin:left; padding-left:20px; white-space:nowrap; }
.dmv-sign label { position:absolute; left:0; bottom:-16px; font:600 9px var(--font-ui); letter-spacing:.12em; text-transform:uppercase; opacity:.6; }
.dmv-stamp.photo { margin-top:12px; justify-self:stretch; font:400 26px var(--font-display); letter-spacing:.12em; padding:12px 16px 9px;
  color:#b3202a; border:3px double #b3202a; transform:rotate(-2deg); background:rgba(179,32,42,.04); text-transform:uppercase; }
.dmv-stamp.photo:hover { background:rgba(179,32,42,.1); transform:rotate(-2deg) scale(1.02); }
.dmv-office { font:400 10px var(--font-type); opacity:.5; border:1px dashed rgba(38,48,58,.5); padding:16px 8px; text-align:center; letter-spacing:.2em; text-transform:uppercase; }

.dmvx-hint { position:absolute; right:22px; bottom:18px; font:400 12px var(--font-type); color:rgba(255,248,230,.7); text-shadow:0 1px 2px #000; pointer-events:none; transition:opacity .6s; }
.dmvx-zoom { position:absolute; right:22px; top:18px; display:flex; gap:6px; }
.dmvx-zoom button { font:400 13px var(--font-type); color:#f3ead8; background:rgba(20,22,26,.55); border:1px solid rgba(243,234,216,.35); padding:6px 11px; border-radius:3px; cursor:pointer; backdrop-filter:blur(4px); }
.dmvx-zoom button.on { background:#f3ead8; color:#1b1d22; }
.dmvx-bubble { position:absolute; left:58%; top:14%; max-width:260px; padding:12px 16px; background:#fffef8; color:#1b1d22; border-radius:18px;
  font:400 20px var(--font-type); box-shadow:0 10px 30px rgba(0,0,0,.45); transform-origin:85% 110%; animation:dmvPop .35s cubic-bezier(.3,1.6,.5,1) both; pointer-events:none; }
.dmvx-bubble::after { content:''; position:absolute; right:26px; bottom:-12px; border:12px solid transparent; border-top-color:#fffef8; border-bottom:0; }
.dmvx-bubble.out { animation:dmvOut .3s ease-in both; }
@keyframes dmvPop { from { transform:scale(.4); opacity:0; } }
@keyframes dmvOut { to { transform:scale(.8) translateY(6px); opacity:0; } }
.dmvx-count { position:absolute; inset:0; display:grid; place-items:center; pointer-events:none; font:400 min(30vw,220px) var(--font-display); color:rgba(255,255,255,.9);
  text-shadow:0 0 40px rgba(0,0,0,.6); }
.dmvx-count span { animation:dmvCount .9s ease-out both; }
@keyframes dmvCount { from { transform:scale(1.6); opacity:0; } 30% { opacity:1; transform:scale(1); } to { transform:scale(.85); opacity:0; } }
.dmvx-flash { position:absolute; inset:0; background:#fff; pointer-events:none; animation:dmvFlash 1.1s ease-out both; z-index:5; }
@keyframes dmvFlash { 0% { opacity:0; } 6% { opacity:1; } 25% { opacity:.92; } 100% { opacity:0; } }
.dmvx-card { position:absolute; inset:0; display:grid; place-items:center; z-index:6; background:radial-gradient(circle at 50% 45%, rgba(10,10,12,.35), rgba(10,10,12,.82)); animation:dmvFade .5s both; }
.dmvx-card img { width:min(78vw, 560px); border-radius:4%; box-shadow:0 40px 80px -10px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.2);
  animation:dmvSlide 1.1s cubic-bezier(.2,.9,.2,1) both; }
@keyframes dmvFade { from { opacity:0; } }
@keyframes dmvSlide { from { transform:translateY(60vh) rotate(-24deg) scale(.7); } 70% { transform:translateY(-6px) rotate(1.5deg); } to { transform:rotate(-1.5deg); } }
.dmvx-soon { position:absolute; inset:0; display:grid; place-items:center; z-index:7; background:rgba(8,8,10,.86); animation:dmvFade .6s both; }
.dmvx-soon > div { max-width:420px; margin:0 20px; padding:28px 28px 24px; text-align:center; color:#f3ead8; border:1px solid rgba(216,178,90,.45); border-radius:6px;
  background:linear-gradient(180deg, rgba(40,32,22,.9), rgba(18,14,10,.95)); box-shadow:0 30px 80px rgba(0,0,0,.6); }
.dmvx-soon img { width:100%; border-radius:12px; margin-bottom:18px; transform:rotate(-1.5deg); box-shadow:0 14px 30px rgba(0,0,0,.6); }
.dmvx-soon h3 { margin:0 0 8px; font:400 30px var(--font-western); color:var(--gold-bright); }
.dmvx-soon p { margin:0 0 18px; font:400 15px/1.4 var(--font-casino); opacity:.85; }
.dmvx-soon button { font:400 14px var(--font-type); color:#1b1d22; background:var(--gold); border:none; padding:10px 18px; border-radius:3px; cursor:pointer; }

@media (max-width: 760px), (max-aspect-ratio: 4/5) {
  .dmv { left:6px; right:6px; width:auto; top:44vh; bottom:0; }
  .dmv.away { transform:translateY(110%); }
  .dmv-board { border-radius:16px 16px 0 0; padding:40px 8px 0; transform:none; }
  .dmv-clip { width:120px; height:46px; top:-12px; }
  .dmv-paper { padding:12px 12px calc(20px + var(--safe-bottom,0px)); font-size:14px; }
  .dmv-title { font-size:18px; }
  .dmv-check { padding:7px 0; font-size:14px; }
  .dmv-swatch { width:32px; height:32px; }
  .dmvx-hint { display:none; }
  .dmvx-zoom { top:auto; bottom:calc(56vh + 8px); right:10px; }
  .dmvx-bubble { left:auto; right:8vw; top:8vh; font-size:17px; }
}
`;

export function injectFormStyle() {
  injectStyle('creator-style', CSS);
}
