// All UI styling in one place (no external fonts: Bahnschrift ships with Windows 10/11).
export const CSS = `
:root { --fg:#e9e6e1; --mut:#8c8b90; --red:#d4141a; --red2:#ff3b30; --panel:rgba(8,8,11,.62); --line:rgba(255,255,255,.09); --font: Bahnschrift, 'DIN Alternate', 'Roboto Condensed', 'Segoe UI', system-ui, sans-serif; }
#ui { position:fixed; inset:0; pointer-events:none; font-family:var(--font); color:var(--fg); user-select:none; z-index:10; letter-spacing:.02em; }
#ui .click { pointer-events:auto; }
.hud { position:absolute; inset:0; transition:opacity .4s; }
.hud.off { opacity:0; }
.stat { position:absolute; left:22px; top:20px; width:250px; }
.stat .hp { display:flex; align-items:baseline; gap:10px; }
.stat .hpn { font-size:34px; font-weight:700; line-height:1; }
.stat .lbl { font-size:11px; color:var(--mut); letter-spacing:.18em; text-transform:uppercase; }
.bar { height:4px; background:rgba(255,255,255,.08); margin:4px 0 9px; position:relative; overflow:hidden; }
.bar > i { position:absolute; left:0; top:0; bottom:0; background:var(--fg); transition:width .25s; }
.bar.hp > i { background:linear-gradient(90deg,#b0121a,#ff3b30); height:6px; }
.bar.hp { height:6px; }
.bar.hun > i { background:#d8a85a; } .bar.silk > i { background:#e8e8f0; } .bar.ven > i { background:#9bdc6a; } .bar.molt > i { background:#c79bff; }
.molt-ready { color:#c79bff; font-weight:700; animation:pulse 1.2s infinite; }
@keyframes pulse { 50% { opacity:.45; } }
.size { position:absolute; right:24px; top:18px; text-align:right; }
.size .big { font-size:34px; font-weight:700; line-height:1; }
.size .as { font-size:13px; color:var(--mut); margin-top:4px; }
.size .zone { font-size:11px; color:var(--mut); letter-spacing:.2em; text-transform:uppercase; margin-top:10px; }
.wanted { display:flex; gap:5px; justify-content:flex-end; margin-top:8px; }
.wanted b { width:9px; height:15px; clip-path:polygon(0 0,100% 0,50% 50%,100% 100%,0 100%,50% 50%); background:rgba(255,255,255,.14); }
.wanted b.on { background:var(--red2); box-shadow:0 0 10px var(--red); }
.wanted-lbl { font-size:11px; color:var(--red2); letter-spacing:.14em; margin-top:4px; text-transform:uppercase; min-height:13px; }
.mini { position:absolute; left:22px; bottom:22px; width:190px; height:190px; border-radius:50%; overflow:hidden; background:rgba(5,5,7,.55); border:1px solid var(--line); }
.cross { position:absolute; left:50%; top:50%; width:22px; height:22px; margin:-11px 0 0 -11px; }
.cross i { position:absolute; width:3px; height:3px; background:rgba(255,255,255,.8); border-radius:50%; box-shadow:0 0 2px #000; }
.target { position:absolute; left:50%; top:calc(50% + 34px); transform:translateX(-50%); text-align:center; min-width:220px; transition:opacity .2s; }
.target .nm { font-size:15px; font-weight:700; } .target .lt { font-size:11px; color:var(--mut); font-style:italic; }
.target .st { font-size:11px; color:#c79bff; letter-spacing:.15em; margin-top:2px; }
.target .act { margin-top:6px; font-size:13px; }
.key { display:inline-block; min-width:18px; padding:2px 6px; border:1px solid rgba(255,255,255,.35); border-bottom-width:2px; border-radius:4px; font-size:11px; font-weight:700; margin-right:6px; background:rgba(0,0,0,.4); }
.feedbar { position:absolute; left:50%; bottom:118px; width:240px; margin-left:-120px; height:5px; background:rgba(255,255,255,.1); display:none; }
.feedbar i { position:absolute; left:0; top:0; bottom:0; background:#b0121a; }
.subs { position:absolute; left:50%; bottom:70px; transform:translateX(-50%); width:min(900px,80vw); text-align:center; font-size:20px; text-shadow:0 2px 6px #000; }
.subs .who { color:#ff8a7a; font-weight:700; margin-right:8px; } .subs.muffled { color:#b8b0a8; font-style:italic; }
.toast { position:absolute; left:50%; bottom:150px; transform:translateX(-50%); padding:9px 18px; background:var(--panel); border:1px solid var(--line); font-size:15px; max-width:70vw; text-align:center; transition:opacity .4s; }
.obj { position:absolute; left:50%; top:16px; transform:translateX(-50%); font-size:13px; letter-spacing:.12em; color:var(--fg); text-transform:uppercase; padding:6px 14px; background:rgba(0,0,0,.35); border-left:2px solid var(--red); }
.title { position:absolute; left:0; right:0; top:28%; text-align:center; transition:opacity 1s; }
.title .t1 { font-size:46px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; text-shadow:0 4px 30px rgba(0,0,0,.8); }
.title .t2 { font-size:15px; color:var(--mut); letter-spacing:.3em; text-transform:uppercase; margin-top:8px; }
.hints { position:absolute; left:22px; top:240px; width:300px; display:flex; flex-direction:column; gap:8px; }
.hints div { padding:8px 12px; background:var(--panel); border:1px solid var(--line); font-size:13px; line-height:1.35; transition:opacity .6s, transform .6s; }
.feed { position:absolute; right:22px; top:170px; width:330px; display:flex; flex-direction:column; gap:8px; }
.feed div { padding:8px 12px; background:var(--panel); border:1px solid var(--line); font-size:13px; transition:opacity .8s; }
.feed .h { color:var(--mut); font-size:11px; letter-spacing:.1em; } .feed .news { border-left:2px solid var(--red); }
.cine { position:absolute; left:0; right:0; height:11vh; background:#000; transition:transform .8s; }
.cine.top { top:0; transform:translateY(-100%); } .cine.bot { bottom:0; transform:translateY(100%); }
.cine.on.top, .cine.on.bot { transform:none; }
.fade { position:absolute; inset:0; background:#000; opacity:0; pointer-events:none; }
.loading { position:fixed; inset:0; background:#050506; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:30; transition:opacity .6s; font-family:var(--font); color:var(--fg); }
.loading .lt { font-size:13px; letter-spacing:.3em; color:var(--mut); text-transform:uppercase; margin-top:22px; }
.loading .lb { width:280px; height:2px; background:rgba(255,255,255,.1); margin-top:14px; } .loading .lb i { display:block; height:100%; background:var(--red); transition:width .3s; }
.vib { position:absolute; width:60px; height:60px; margin:-30px 0 0 -30px; border:2px solid rgba(255,255,255,.5); border-radius:50%; animation:vib 1s ease-out forwards; }
@keyframes vib { from { transform:scale(.2); opacity:1; } to { transform:scale(2.2); opacity:0; } }
.trophy { position:absolute; right:22px; bottom:22px; padding:10px 16px; background:var(--panel); border:1px solid rgba(212,20,26,.5); font-size:14px; transition:opacity .5s; }
.danger { position:absolute; inset:0; box-shadow:inset 0 0 120px rgba(255,40,30,.0); transition:box-shadow .15s; }
/* menus */
.menu { position:fixed; inset:0; z-index:20; display:flex; pointer-events:auto; font-family:var(--font); color:var(--fg); }
.menu.dim { background:rgba(3,3,5,.72); backdrop-filter:blur(6px); }
.logo { font-size:clamp(54px,8vw,120px); font-weight:800; letter-spacing:.06em; line-height:.95; background:linear-gradient(180deg,#fafafa 0%,#a8acb2 38%,#2a2c30 52%,#9aa0a8 70%,#f2f2f2 100%); -webkit-background-clip:text; background-clip:text; color:transparent; filter:drop-shadow(0 6px 18px rgba(0,0,0,.9)); }
.logo .o { position:relative; display:inline-block; }
.logo .o svg { position:absolute; left:50%; top:52%; width:.34em; height:.5em; transform:translate(-50%,-50%); filter:drop-shadow(0 0 8px rgba(255,30,20,.8)); }
.mbox { margin:auto 0 auto 7vw; display:flex; flex-direction:column; gap:6px; }
.mbtn { font-family:var(--font); background:none; border:none; color:var(--fg); font-size:24px; letter-spacing:.18em; text-align:left; padding:8px 0; cursor:pointer; text-transform:uppercase; opacity:.78; transition:opacity .15s, transform .15s, color .15s; }
.mbtn:hover { opacity:1; transform:translateX(8px); color:#fff; } .mbtn:hover::before { content:''; display:inline-block; width:14px; height:2px; background:var(--red); vertical-align:middle; margin-right:10px; }
.mbtn.small { font-size:15px; } .mbtn[disabled] { opacity:.25; pointer-events:none; }
.sub { font-size:13px; color:var(--mut); letter-spacing:.3em; text-transform:uppercase; margin:10px 0 34px; }
.panel { margin:auto; width:min(980px,92vw); max-height:86vh; overflow:auto; background:rgba(10,10,13,.92); border:1px solid var(--line); padding:28px 34px; }
.panel h2 { margin:0 0 18px; font-size:26px; letter-spacing:.16em; text-transform:uppercase; font-weight:700; }
.tabs { display:flex; gap:4px; margin-bottom:18px; flex-wrap:wrap; } .tabs button { font-family:var(--font); background:rgba(255,255,255,.04); border:1px solid var(--line); color:var(--mut); padding:7px 14px; cursor:pointer; letter-spacing:.12em; font-size:13px; text-transform:uppercase; }
.tabs button.on { color:var(--fg); border-color:rgba(212,20,26,.7); background:rgba(212,20,26,.12); }
.row { display:flex; align-items:center; justify-content:space-between; padding:9px 0; border-bottom:1px solid rgba(255,255,255,.05); font-size:15px; gap:20px; }
.row .d { font-size:12px; color:var(--mut); margin-top:2px; }
.row input[type=range] { width:220px; accent-color:#d4141a; } .row select, .row button.opt { font-family:var(--font); background:#14141a; color:var(--fg); border:1px solid var(--line); padding:6px 10px; font-size:14px; }
.seg { display:flex; gap:3px; } .seg button { font-family:var(--font); background:#14141a; border:1px solid var(--line); color:var(--mut); padding:6px 12px; cursor:pointer; font-size:13px; letter-spacing:.08em; }
.seg button.on { color:#fff; border-color:#d4141a; background:rgba(212,20,26,.2); }
.cards { margin:auto; display:flex; gap:22px; align-items:stretch; }
.card { width:280px; background:linear-gradient(180deg,rgba(24,22,26,.97),rgba(10,10,12,.97)); border:1px solid rgba(255,255,255,.12); padding:20px; cursor:pointer; transition:transform .2s, border-color .2s; display:flex; flex-direction:column; }
.card:hover { transform:translateY(-8px); border-color:#d4141a; }
.card .k { font-size:11px; color:var(--mut); letter-spacing:.24em; text-transform:uppercase; } .card .t { font-size:24px; font-weight:700; letter-spacing:.08em; margin:6px 0 10px; }
.card .x { font-size:14px; line-height:1.4; color:#cfcac4; flex:1; } .card img { width:100%; height:150px; object-fit:contain; margin:8px 0; background:radial-gradient(circle,#1c1a1e,#09090b); }
.card .sb { display:grid; grid-template-columns:70px 1fr; gap:4px 8px; font-size:11px; color:var(--mut); margin-top:10px; align-items:center; }
.card .sb i { display:block; height:3px; background:#d4141a; }
.note { margin:auto; width:min(560px,90vw); background:#efeadf; color:#1d2633; padding:34px 40px; box-shadow:0 20px 80px rgba(0,0,0,.8); transform:rotate(-1deg); font-family:'Segoe Print','Bradley Hand','Ink Free',cursive; font-size:17px; line-height:1.55; white-space:pre-wrap; }
.note h3 { margin:0 0 12px; font-family:var(--font); letter-spacing:.12em; text-transform:uppercase; color:#8a1414; font-size:14px; }
.death { margin:auto; text-align:center; } .death .t1 { font-size:72px; font-weight:800; letter-spacing:.2em; color:#d4141a; } .death .c { font-size:20px; color:var(--fg); margin-top:6px; }
.grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:26px auto; width:min(760px,90vw); } .grid div { background:rgba(255,255,255,.04); border:1px solid var(--line); padding:12px; text-align:left; } .grid b { display:block; font-size:22px; } .grid span { font-size:11px; color:var(--mut); letter-spacing:.14em; text-transform:uppercase; }
.bestiary { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; } .bestiary div { background:rgba(255,255,255,.04); border:1px solid var(--line); padding:12px; font-size:13px; } .bestiary .lk { opacity:.35; }
.evo { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; } .evo div { background:rgba(255,255,255,.04); border:1px solid var(--line); padding:12px; text-align:center; } .evo button { margin-top:8px; }
`;
