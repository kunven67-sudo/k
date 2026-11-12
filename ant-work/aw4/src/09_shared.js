/* shared helpers (from Ant Work 3) */
async function timedChoice(opts,sec,def){
  const p=choose(opts.map((o,i)=>Object.assign({},o,{i})),{lead:'DECIDE'});
  const bar=document.createElement('div'); bar.style.cssText='height:6px;margin:10px auto 0;width:100%;max-width:420px;background:rgba(255,255,255,.18);border-radius:4px;overflow:hidden'; const fill=document.createElement('div'); fill.style.cssText='height:100%;width:100%;background:#ffcc33;transition:width linear '+sec+'s'; bar.appendChild(fill); $('choices').appendChild(bar);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ fill.style.width='0%'; }));
  let done=false; const to=setTimeout(()=>{ if(!done&&CHOICE.active) pickChoice(def); },sec*1000);
  const r=await p; done=true; clearTimeout(to); bar.remove(); return r.i;
}
