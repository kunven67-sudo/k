/* ================================================================
   DEBUG — ?debug=<name> jumps straight to a scene (used for testing)
   ================================================================ */
defineLevel('studio',{
  title:'Studio',
  env:{fx:{exposure:1.1},music:null,reverb:.1},
  async build(scene,lv){
    lv.envMap=makeEnv({top:0x8899bb,horizon:0xdddddd,bottom:0x333333,lights:[{x:5,y:8,z:6,w:6,h:6,k:6},{x:-6,y:4,z:3,w:4,h:6,c:0xffd0a0,k:3}]});
    scene.background=col(0x1a1c22);
    const rig=makeRig(scene,{sun:2.4,hemi:.35,dir:V3(.6,1,.8),span:4});
    const fl=mesh(new THREE.CircleGeometry(12,48),mat(0x3a3d44,{roughness:.6}),0,0,0); fl.rotation.x=-Math.PI/2; scene.add(fl);
    lv.jim=makeJim(); lv.jim.position.set(-.45,0,0); scene.add(lv.jim);
    lv.steve=makeSteve(); lv.steve.position.set(.45,0,-.2); scene.add(lv.steve);
    lv.alien=makeAlien(); lv.alien.position.set(1.3,0,-.4); scene.add(lv.alien);
    lv.robot=makeRobot(); lv.robot.position.set(-1.4,0,-.4); scene.add(lv.robot);
    lv.you=makeYou(); lv.you.position.set(2.2,0,-.6); scene.add(lv.you);
  }
});
const DEBUG={
  async run(name){
    $('splash').classList.add('hide'); G.mode='play'; try{ initAudio(); loadSfxFiles(); loadMusicFiles(); }catch(e){}
    if(name==='studio'||name==='face'){
      await enterLevel('studio',{pos:V3(0,0,3),yaw:0});
      PLAYER.lock();
      if(name==='face') camShot(V3(-.42,1.72,.45),V3(-.45,1.7,0),{fov:35});
      else camShot(V3(0,1.3,3.2),V3(0,1.05,0),{fov:50});
    } else if(name.startsWith('cp')){ await buildLevel('intro'); startFromCheckpoint(name.slice(2)); }
    else if(DEBUG[name]) await DEBUG[name]();
  }
};
DEBUG.ant=async function(){
  await buildLevel('intro'); await enterLevel('intro',{pos:V3(0,0,6)});
  const lv=LEVELS.intro; for(const c of lv.chunks) c.visible=false;
  lv.ant.position.set(0,0,0); lv.ant.rotation.y=Math.PI/2; FX.dof=0; lv.autoFocus=false; PLAYER.lock();
  camShot(V3(1.2,1.1,2.4),V3(0,.18,0),{fov:30});
};

