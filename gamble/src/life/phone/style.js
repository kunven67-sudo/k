// Styles for the cracked budget Android. Everything is CSS + generated SVG (no images).
// The phone is a physical object in your hand: a chunky plastic body with a glossy bezel,
// a waterdrop notch, a scratched screen protector and a spider-web crack from a corner drop.

import { injectStyle } from '../../core/util.js';

injectStyle(
  'life-phone',
  `
.ph-hold{position:absolute;left:50%;bottom:0;z-index:40;pointer-events:none;
  --s:1;width:300px;height:628px;margin-left:-150px;transform-origin:50% 100%;
  transform:translate3d(var(--px,0px),calc(100% + 40px),0) rotate(6deg) scale(var(--s));
  transition:transform .55s cubic-bezier(.25,.9,.3,1.04)}
.ph-hold.up{transform:translate3d(var(--px,0px),calc(1.5vh + var(--bob,0px)),0) rotate(var(--rot,-2.5deg)) scale(var(--s))}
.ph-body{position:absolute;inset:0;border-radius:36px;pointer-events:auto;
  background:linear-gradient(115deg,#2a2c31 0%,#16171a 22%,#0d0e10 60%,#24262b 100%);
  box-shadow:0 0 0 1px #000,0 0 0 2.5px #3a3c42,0 0 0 3.5px #0b0b0c,0 40px 80px rgba(0,0,0,.55),
    0 12px 24px rgba(0,0,0,.45),inset 0 1px 1px rgba(255,255,255,.12)}
.ph-body:before{content:'';position:absolute;right:-5px;top:150px;width:4px;height:58px;border-radius:0 3px 3px 0;
  background:linear-gradient(90deg,#2b2d32,#111);box-shadow:0 84px 0 0 #1c1d21}
.ph-body:after{content:'';position:absolute;left:-5px;top:118px;width:4px;height:90px;border-radius:3px 0 0 3px;
  background:linear-gradient(270deg,#2b2d32,#111)}
.ph-screen{position:absolute;left:11px;right:11px;top:13px;bottom:24px;border-radius:24px 24px 20px 20px;
  overflow:hidden;background:#000;font-family:var(--font-ui);color:#fff;-webkit-font-smoothing:antialiased;
  user-select:none;-webkit-user-select:none;touch-action:none}
.ph-chin{position:absolute;left:0;right:0;bottom:6px;text-align:center;font:600 7.5px/1 var(--font-ui);
  letter-spacing:.32em;color:#4a4c52;text-transform:uppercase}
.ph-notch{position:absolute;left:50%;top:0;width:58px;height:17px;margin-left:-29px;z-index:9;pointer-events:none;
  background:#000;border-radius:0 0 22px 22px/0 0 17px 17px}
.ph-notch:after{content:'';position:absolute;left:50%;top:4px;width:9px;height:9px;margin-left:-4.5px;border-radius:50%;
  background:radial-gradient(circle at 35% 35%,#2c3b6a 0,#0b0f1c 45%,#000 70%);box-shadow:0 0 0 1.5px #111}
.ph-glass{position:absolute;inset:0;z-index:8;pointer-events:none;border-radius:inherit;
  background:linear-gradient(125deg,rgba(255,255,255,.10) 0%,rgba(255,255,255,.02) 28%,rgba(255,255,255,0) 45%,rgba(255,255,255,.04) 80%,rgba(255,255,255,0) 100%)}
.ph-cracks{position:absolute;inset:0;z-index:7;pointer-events:none;width:100%;height:100%;mix-blend-mode:screen}
.ph-dim{position:absolute;inset:0;z-index:6;pointer-events:none;background:#000;opacity:0;transition:opacity .3s}
.ph-status{position:absolute;left:0;right:0;top:0;height:22px;z-index:5;display:flex;align-items:center;
  padding:0 14px 0 16px;font-size:11px;font-weight:600;letter-spacing:.01em;pointer-events:none;
  text-shadow:0 1px 2px rgba(0,0,0,.35)}
.ph-status .sp{flex:1}
.ph-status .ic{display:flex;gap:5px;align-items:center}
.ph-status svg{display:block}
.ph-bat{position:relative;width:21px;height:10px;border:1.3px solid currentColor;border-radius:3px;opacity:.95}
.ph-bat:after{content:'';position:absolute;right:-3.6px;top:2.2px;width:2px;height:3.6px;border-radius:0 1px 1px 0;background:currentColor}
.ph-bat i{position:absolute;left:1.3px;top:1.3px;bottom:1.3px;border-radius:1px;background:currentColor}
.ph-bat.low i{background:#ff4a3d}
.ph-pct{font-size:10.5px;font-weight:600;margin-left:3px}
.ph-view{position:absolute;inset:0;overflow:hidden}
.ph-app{position:absolute;inset:0;display:flex;flex-direction:column;background:#f4f4f6;color:#16171a;
  transform-origin:var(--ox,50%) var(--oy,50%);animation:phOpen .34s steps(7,end) both}
.ph-app.dark{background:#0f1012;color:#ececf0}
.ph-app.closing{animation:phClose .22s steps(5,end) both}
@keyframes phOpen{from{transform:scale(.18);opacity:0;border-radius:40px}to{transform:none;opacity:1}}
@keyframes phClose{to{transform:scale(.2);opacity:0}}
.ph-bar{flex:none;height:54px;padding:24px 14px 0 8px;display:flex;align-items:center;gap:6px;font-size:16.5px;font-weight:600}
.ph-bar .ttl{flex:1}
.ph-btn{all:unset;cursor:pointer;display:grid;place-items:center;min-width:30px;height:30px;border-radius:15px;
  font-size:13px;font-weight:600;position:relative;overflow:hidden}
.ph-btn:active{background:rgba(127,127,127,.18)}
.ph-scroll{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.ph-scroll::-webkit-scrollbar{display:none}
.ph-nav{flex:none;height:30px;display:flex;justify-content:space-around;align-items:center;padding:0 46px;
  background:inherit;filter:brightness(.97)}
.ph-nav b{all:unset;cursor:pointer;width:40px;height:26px;display:grid;place-items:center;opacity:.6}
.ph-nav b:active{opacity:1}
.ph-ripple{position:absolute;border-radius:50%;background:rgba(127,127,127,.28);transform:scale(0);
  animation:phRip .45s ease-out forwards;pointer-events:none}
@keyframes phRip{to{transform:scale(1);opacity:0}}

/* Lock screen */
.ph-lock{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;cursor:grab}
.ph-lock .tm{margin-top:86px;font-size:68px;font-weight:400;letter-spacing:-.03em;line-height:1;
  text-shadow:0 2px 14px rgba(0,0,0,.35)}
.ph-lock .dt{margin-top:8px;font-size:13.5px;font-weight:500;opacity:.92;text-shadow:0 1px 6px rgba(0,0,0,.4)}
.ph-lock .wx{margin-top:4px;font-size:12px;opacity:.8}
.ph-lock .sw{position:absolute;bottom:34px;left:0;right:0;text-align:center;font-size:11.5px;opacity:.8;letter-spacing:.02em}
.ph-lock .sw svg{display:block;margin:0 auto 6px;animation:phBob 1.6s ease-in-out infinite}
.ph-lock .lk{position:absolute;bottom:72px;left:50%;margin-left:-11px;opacity:.85}
@keyframes phBob{50%{transform:translateY(-5px);opacity:.6}}

/* Home */
.ph-home{position:absolute;inset:0;padding:64px 14px 0}
.ph-grid{display:grid;grid-template-columns:repeat(4,1fr);row-gap:18px;margin-top:22px}
.ph-ico{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:10.5px;
  text-shadow:0 1px 3px rgba(0,0,0,.6);letter-spacing:.01em}
.ph-ico .sq{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;position:relative;overflow:hidden;
  box-shadow:0 3px 8px rgba(0,0,0,.35)}
.ph-ico .sq:after{content:'';position:absolute;inset:0;background:linear-gradient(160deg,rgba(255,255,255,.22),rgba(255,255,255,0) 48%)}
.ph-ico:active .sq{filter:brightness(.8)}
.ph-widget{border-radius:22px;padding:14px 16px;background:rgba(20,20,26,.28);backdrop-filter:blur(10px);
  -webkit-backdrop-filter:blur(10px);display:flex;align-items:baseline;gap:10px;text-shadow:0 1px 4px rgba(0,0,0,.4)}
.ph-widget .big{font-size:38px;font-weight:400;letter-spacing:-.02em}
.ph-widget .sm{font-size:11.5px;opacity:.9;line-height:1.35}
.ph-dock{position:absolute;left:14px;right:14px;bottom:38px;display:grid;grid-template-columns:repeat(4,1fr);
  padding:10px 0;border-radius:24px;background:rgba(255,255,255,.12);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.ph-dots{position:absolute;bottom:114px;left:0;right:0;display:flex;justify-content:center;gap:5px}
.ph-dots i{width:5px;height:5px;border-radius:50%;background:#fff;opacity:.4}.ph-dots i:first-child{opacity:1}

/* Lists */
.ph-row{display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;position:relative;overflow:hidden}
.ph-row:active{background:rgba(0,0,0,.05)}
.ph-av{width:40px;height:40px;border-radius:50%;flex:none;display:grid;place-items:center;font-weight:600;font-size:16px;color:#fff}
.ph-row .mid{flex:1;min-width:0}
.ph-row .nm{font-size:14px;font-weight:600}
.ph-row .pv{font-size:12.5px;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.ph-row .tm{font-size:11px;opacity:.5;align-self:flex-start;margin-top:3px}
.ph-empty{padding:40px 30px;text-align:center;opacity:.5;font-size:13px}
.ph-msg{max-width:78%;padding:9px 12px;border-radius:18px;font-size:13.5px;line-height:1.35;margin:4px 12px;background:#e6e6ea}
.ph-msg.in{align-self:flex-start;border-bottom-left-radius:5px}
.ph-note{align-self:center;font-size:11px;opacity:.5;margin:14px 0 6px}

/* Call */
.ph-call{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding-top:80px;
  background:linear-gradient(180deg,#26313d,#10151b);color:#fff}
.ph-call .av{width:92px;height:92px;border-radius:50%;background:#56606c;display:grid;place-items:center;margin-bottom:16px}
.ph-call .nm{font-size:22px;font-weight:500}
.ph-call .st{margin-top:6px;font-size:13px;opacity:.75;min-height:1.3em;text-align:center;padding:0 26px;line-height:1.4}
.ph-call .end{all:unset;cursor:pointer;position:absolute;bottom:60px;left:50%;margin-left:-31px;width:62px;height:62px;
  border-radius:50%;background:#e5413a;display:grid;place-items:center;box-shadow:0 6px 18px rgba(229,65,58,.45)}

/* Wallet */
.ph-card{margin:10px 14px;border-radius:16px;padding:16px;color:#fff;position:relative;overflow:hidden;
  box-shadow:0 8px 18px rgba(0,0,0,.25)}
.ph-card .lb{font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.8}
.ph-card .v{font-size:28px;font-weight:600;margin-top:6px;letter-spacing:-.01em}
.ph-id{margin:10px 14px 20px;border-radius:12px;overflow:hidden;box-shadow:0 8px 18px rgba(0,0,0,.3)}
.ph-id img,.ph-id canvas{display:block;width:100%;height:auto}

/* Clock */
.ph-clockbig{text-align:center;font-size:54px;font-weight:300;letter-spacing:-.02em;margin:22px 0 2px}
.ph-alarm{display:flex;align-items:center;margin:16px 14px;padding:14px 16px;border-radius:18px;background:#1c1d21}
.ph-alarm .at{flex:1;font-size:34px;font-weight:400}
.ph-alarm .at small{font-size:14px;margin-left:4px;opacity:.7}
.ph-sw{width:42px;height:24px;border-radius:12px;background:#4a4b52;position:relative;cursor:pointer;transition:background .2s}
.ph-sw:after{content:'';position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#ddd;transition:left .2s steps(3)}
.ph-sw.on{background:#5b8def}.ph-sw.on:after{left:21px;background:#fff}
.ph-adj{display:flex;gap:10px;justify-content:center;margin-top:4px}
.ph-adj .ph-btn{background:#1c1d21;width:54px;height:40px;border-radius:20px;font-size:20px}
.ph-hint{text-align:center;font-size:11.5px;opacity:.5;margin:14px 26px}

/* Camera */
.ph-camui{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;background:transparent}
.ph-camui .grid{position:absolute;inset:22px 0 112px;pointer-events:none;
  background:linear-gradient(90deg,transparent calc(33.3% - .5px),rgba(255,255,255,.28) 33.3%,transparent calc(33.3% + .5px),transparent calc(66.6% - .5px),rgba(255,255,255,.28) 66.6%,transparent calc(66.6% + .5px)),
  linear-gradient(0deg,transparent calc(33.3% - .5px),rgba(255,255,255,.28) 33.3%,transparent calc(33.3% + .5px),transparent calc(66.6% - .5px),rgba(255,255,255,.28) 66.6%,transparent calc(66.6% + .5px))}
.ph-camui .bot{height:112px;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:space-around}
.ph-shut{all:unset;cursor:pointer;width:60px;height:60px;border-radius:50%;background:#fff;box-shadow:0 0 0 4px rgba(0,0,0,.6),0 0 0 7px #fff}
.ph-shut:active{transform:scale(.92)}
.ph-thumb{width:40px;height:40px;border-radius:8px;background:#222 center/cover;border:2px solid #fff}
.ph-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:4}
.ph-modes{position:absolute;bottom:118px;left:0;right:0;display:flex;justify-content:center;gap:16px;font-size:11px;
  font-weight:600;letter-spacing:.06em;text-transform:uppercase;opacity:.9}
.ph-modes b{color:#ffcf3f}

/* Toast inside the phone */
.ph-toast{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);background:rgba(40,40,44,.92);color:#fff;
  font-size:12px;padding:8px 14px;border-radius:16px;z-index:5;animation:phT 2s forwards}
@keyframes phT{0%{opacity:0}10%,80%{opacity:1}100%{opacity:0}}

/* Dead */
.ph-deadbat{position:absolute;left:50%;top:50%;margin:-14px 0 0 -26px;opacity:0;transition:opacity .3s}
.ph-deadbat.show{opacity:.9}

@media (pointer:coarse){.ph-hold{bottom:0}}
`,
);
