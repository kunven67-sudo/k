// Narrative size ladder for the first playable (lab → rooftop). Scale is the
// spider's visual three.js scale; label/asBig are the story size shown in HUD.
export const STAGES=[
  {scale:0.12, label:'2 mm',    as:'a lab spider'},
  {scale:0.22, label:'1 cm',    as:'a coin'},
  {scale:0.4,  label:'4 cm',    as:'a mouse'},
  {scale:0.7,  label:'12 cm',   as:'a hand'},
  {scale:1.1,  label:'30 cm',   as:'a cat'},
  {scale:1.7,  label:'1 m',     as:'a big dog'},
  {scale:2.6,  label:'2 m',     as:'a person'},        // can burst the window
  {scale:3.6,  label:'4 m',     as:'a car'},
  {scale:5.0,  label:'10 m',    as:'a bus'},
  {scale:7.0,  label:'25 m',    as:'a house'},
];
export function stageFor(scale){
  let i=0; for(let k=0;k<STAGES.length;k++) if(scale>=STAGES[k].scale) i=k;
  return i;
}
