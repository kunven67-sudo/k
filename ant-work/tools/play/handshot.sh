#!/bin/bash
# handshot.sh out.png : cinematic close-up of Jay 2's right hand (game's own camShot)
curl -s --get localhost:7777/eval --data-urlencode "js=(()=>{ const J=LEVELS.mash.jay2; J.userData.A.gestT=999; J.userData.A.gest=null; const h=J.userData.hands.R.H.grp; h.updateMatrixWorld(true); const c=new THREE.Box3().setFromObject(h).getCenter(V3()); const fw=V3(Math.sin(J.rotation.y),0,Math.cos(J.rotation.y)); const side=V3(fw.z,0,-fw.x); const eye=c.clone().addScaledVector(fw,.32).addScaledVector(side,-.12).add(V3(0,.06,0)); camShot(eye,c,{dur:0,fov:40}); return 1 })()" >/dev/null
curl -s "localhost:7777/wait?ms=2000" >/dev/null; cp view.png $1
