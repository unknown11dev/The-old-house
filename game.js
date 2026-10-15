(() => {
'use strict';
const $ = id => document.getElementById(id);
const menu=$('menu'), hud=$('hud'), pauseScreen=$('pause'), ending=$('ending');
let scene,camera,renderer,clock,player,monster,raycaster;
let active=false, ended=false, paused=false, pointerLocked=false;
let yaw=0,pitch=0,moveX=0,moveZ=0, keys={}, crouching=false, running=false;
let items=new Set(), objects=[], colliders=[], hideSpots=[], doors=[], puzzleSolved=false, keyTaken=false;
let monsterState='patrol', monsterTarget=null, lastNoise=0, alertTimer=0, toastTimer=null, messageTimer=null;
let doorMesh, keyMesh, puzzleMesh, wardrobeMesh, exitMesh;
const WORLD={minX:-13,maxX:13,minZ:-13,maxZ:13};
const raycasterReusable = new THREE.Raycaster();
const mat=(color,roughness=1,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const M={
  floor:mat(0x3a3027), wall:mat(0x4a3a2c), darkWall:mat(0x28221e), wood:mat(0x38271e),
  trim:mat(0x1d1714), metal:mat(0x55504a,.35,.75), glass:mat(0x101820,.2,.1),
  rug:mat(0x4b2021), skin:mat(0x8e7661), cloth:mat(0x282624), red:mat(0x762226),
  key:mat(0xd5ad4e,.3,.8), glow: new THREE.MeshBasicMaterial({color:0xffd36b})
};
function box(w,h,d,material,x,y,z, opts={}) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true;
  if(opts.name) mesh.name=opts.name;
  scene.add(mesh); if(opts.collide) colliders.push({x,z,hw:w/2,hd:d/2,mesh});
  if(opts.interact) objects.push(mesh);
  return mesh;
}
function addWall(w,h,d,x,y,z,material=M.wall){return box(w,h,d,material,x,y,z,{collide:true})}
function makeRoom(){
  // Main shell and corridors: room floors are one continuous walkable plane.
  box(28,.5,28,M.floor,0,-.28,0);
  // outer walls with gaps at the front entrance and side passages
  addWall(28,4,.45,0,1.8,-14); addWall(28,4,.45,0,1.8,14);
  addWall(.45,4,28,-14,1.8,0); addWall(.45,4,28,14,1.8,0);
  // Internal walls form a readable small house maze.
  addWall(9,3.6,.35,-6,1.6,-6); addWall(5,3.6,.35,4.5,1.6,-6);
  addWall(.35,3.6,7,-1.2,1.6,-9.5); addWall(8,3.6,.35,7.5,1.6,-1.5);
  addWall(.35,3.6,7,3,1.6,2.2); addWall(7,3.6,.35,-8.5,1.6,1);
  addWall(.35,3.6,7,-5,1.6,4.5); addWall(7,3.6,.35,7.5,1.6,7);
  addWall(8,3.6,.35,-7.5,1.6,9); addWall(.35,3.6,7,9,1.6,10.5);
  // basement access area and exit
  addWall(5,3.6,.35,-2,1.6,7); addWall(.35,3.6,5,-4.5,1.6,10.5);
  // door frame and exit door
  box(.25,3,.3,M.trim,11.4,1.5,12.9); box(.25,3,.3,M.trim,13.4,1.5,12.9);
  doorMesh=box(1.8,2.8,.18,M.wood,12.4,1.4,12.9,{name:'exitDoor',interact:true});
  exitMesh=doorMesh; doorMesh.userData={kind:'exit'};
  // trims / beams / floorboards for visual detail
  for(let z=-12;z<=12;z+=2.1) box(27.5,.035,.045,M.trim,0,-.005,z);
  for(const [x,z,w,d] of [[-9,-10,3,2],[-9,5,2,4],[6,4,3,2],[7,-9,3,2],[0,11,3,1]]){
    box(w,.035,d,M.rug,x,.01,z);
  }
  // furniture
  box(2.8,1.1,.9,M.wood,-9,0.55,-9); box(2.9,.1,1,M.trim,-9,1.12,-9);
  box(.15,1.5,.15,M.trim,-10.2,.75,-9); box(.15,1.5,.15,M.trim,-7.8,.75,-9);
  box(1.5,.9,.8,M.wood,7,0.45,-9); box(1.7,.12,.9,M.trim,7,.92,-9);
  // old dining table
  box(2.6,.18,1.6,M.wood,-8,.9,5); for(const x of [-9,-7])for(const z of [4.5,5.5])box(.12,.9,.12,M.trim,x,.45,z);
  box(1.5,1.8,.8,M.darkWall,10, .9,4); // cabinet
  // Wardrobe hiding spot
  wardrobeMesh=box(1.4,2.6,.9,M.wood,-11,1.3,2,{name:'wardrobe',interact:true});
  wardrobeMesh.userData={kind:'hide'};
  box(1.45,.12,.95,M.trim,-11,2.58,2); box(.06,2.45,.04,M.trim,-11,1.3,2.47);
  hideSpots.push({x:-11,z:2,mesh:wardrobeMesh});
  // shelving and crates
  for(let i=0;i<4;i++)box(1.2,.1,.3,M.trim,5,0.6+i*.48,5.4);
  for(const [x,z] of [[-2,-11],[0,-11],[5,10],[-10,11]]) {
    box(.8,.8,.8,M.wood,x,.4,z); box(.84,.08,.84,M.trim,x,.82,z);
  }
  // locked basement puzzle door
  puzzleMesh=box(1.65,2.7,.18,M.darkWall,-2,1.35,7,{name:'puzzleDoor',interact:true});
  puzzleMesh.userData={kind:'puzzle'};
  // decorative symbol panel on door
  box(.9,.8,.05,M.wood,-2,1.7,6.88);
  for(let i=0;i<3;i++){
    const s=box(.18,.18,.06,[M.key,mat(0xb9b3a2),mat(0x8b4934)][i],-2+(i-1)*.27,1.7,6.82);
    s.userData={kind:'symbol',index:i}; objects.push(s);
  }
  // key on a table in the east room
  box(1.1,.12,.8,M.wood,7,1.0,1); 
  keyMesh=new THREE.Mesh(new THREE.TorusGeometry(.12,.035,8,18),M.key);
  keyMesh.rotation.x=Math.PI/2;keyMesh.position.set(7,1.18,1);keyMesh.castShadow=true;keyMesh.userData={kind:'key',label:'Basement key'};
  scene.add(keyMesh);objects.push(keyMesh);
  // a note clue
  const note=box(.38,.03,.28,mat(0xc7bda4),-8,1.23,5,{name:'note',interact:true});
  note.userData={kind:'note'};
  // lights
  const ambient=new THREE.HemisphereLight(0x8c9aab,0x24160e,.42);scene.add(ambient);
  const lamp1=new THREE.PointLight(0xffc78a,1.2,11);lamp1.position.set(-8,3.1,-8);scene.add(lamp1);
  const lamp2=new THREE.PointLight(0xb7c9e8,.65,9);lamp2.position.set(7,3,-9);scene.add(lamp2);
  const lamp3=new THREE.PointLight(0xffa95e,.75,8);lamp3.position.set(-8,2.8,5);scene.add(lamp3);
  const lamp4=new THREE.PointLight(0xffd6a1,.5,7);lamp4.position.set(7,2.8,5);scene.add(lamp4);
  // light fixtures
  for(const [x,z] of [[-8,-8],[7,-9],[-8,5],[7,5]]){
    box(.16,.08,.16,M.trim,x,3.75,z); const bulb=new THREE.Mesh(new THREE.SphereGeometry(.08,8,8),new THREE.MeshBasicMaterial({color:0xffd8a0}));bulb.position.set(x,3.6,z);scene.add(bulb);
  }
}
function makeMonster(){
  monster=new THREE.Group();monster.position.set(5,0,-10);scene.add(monster);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.38,.42,1.25,10),M.cloth);body.position.y=1.05;body.castShadow=true;monster.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.29,12,10),M.skin);head.position.y=1.85;head.castShadow=true;monster.add(head);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.3,12,8,0,Math.PI*2,0,Math.PI*.55),M.trim);hair.position.set(0,2.0,0);monster.add(hair);
  const eyeMat=new THREE.MeshBasicMaterial({color:0xd83a32});
  for(const x of [-.11,.11]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.035,8,8),eyeMat);eye.position.set(x,1.88,-.25);monster.add(eye);}
  const armGeo=new THREE.CylinderGeometry(.11,.13,.82,8);
  for(const x of [-.48,.48]){const arm=new THREE.Mesh(armGeo,M.cloth);arm.position.set(x,1.05,0);arm.rotation.z=x<0?-.12:.12;monster.add(arm);}
  const legGeo=new THREE.CylinderGeometry(.14,.16,.72,8);
  for(const x of [-.19,.19]){const leg=new THREE.Mesh(legGeo,M.trim);leg.position.set(x,.38,0);monster.add(leg);}
  // simple carried club
  const club=box(.09,.9,.09,M.wood,0,0,0);club.position.set(.58,.78,-.08);club.rotation.z=-.3;monster.add(club);
}
function init(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x080b11);scene.fog=new THREE.FogExp2(0x080b11,.035);
  camera=new THREE.PerspectiveCamera(76,innerWidth/innerHeight,.1,90);
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  $('game').appendChild(renderer.domElement);
  clock=new THREE.Clock();player={x:0,z:11.7,y:1.62,speed:3.2,hidden:false};
  raycaster=new THREE.Raycaster();makeRoom();makeMonster();
  window.addEventListener('resize',resize);
  renderer.domElement.addEventListener('click',()=>{if(active&&!paused&&!ended&&!isTouch())requestPointerLock();});
  document.addEventListener('pointerlockchange',()=>{pointerLocked=document.pointerLockElement===renderer.domElement;});
  document.addEventListener('mousemove',e=>{if(pointerLocked&&active&&!paused){yaw-=e.movementX*.0022;pitch-=e.movementY*.0022;pitch=Math.max(-1.2,Math.min(1.2,pitch));}});
  document.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Escape'&&active&&!ended){if(paused)resume();else pause();}if(e.code==='KeyE')interact();if(e.code==='ControlLeft'||e.code==='ControlRight')crouching=true;if(e.code==='ShiftLeft'||e.code==='ShiftRight')running=true;});
  document.addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='ControlLeft'||e.code==='ControlRight')crouching=false;if(e.code==='ShiftLeft'||e.code==='ShiftRight')running=false;});
  setupTouch();animate();
}
function resize(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));}
function isTouch(){return matchMedia('(pointer:coarse)').matches||innerWidth<800;}
function requestPointerLock(){const fn=renderer.domElement.requestPointerLock;if(fn)fn.call(renderer.domElement);}
function setupTouch(){
  let zone=$('stickZone'),stick=$('stick'),touchId=null,start={x:0,y:0};
  const updateStick=e=>{const rect=zone.getBoundingClientRect(),dx=e.clientX-(rect.left+rect.width/2),dy=e.clientY-(rect.top+rect.height/2),max=39;const x=Math.max(-max,Math.min(max,dx)),y=Math.max(-max,Math.min(max,dy));stick.style.left=(rect.width/2-26+x)+'px';stick.style.top=(rect.height/2-26+y)+'px';moveX=x/max;moveZ=y/max;};
  zone.addEventListener('pointerdown',e=>{touchId=e.pointerId;zone.setPointerCapture(touchId);updateStick(e);});
  zone.addEventListener('pointermove',e=>{if(e.pointerId===touchId)updateStick(e);});
  const reset=()=>{touchId=null;moveX=moveZ=0;stick.style.left='36px';stick.style.top='36px';};
  zone.addEventListener('pointerup',reset);zone.addEventListener('pointercancel',reset);
  // drag on right half of screen to look around
  let lookId=null,last={x:0,y:0};
  renderer.domElement.addEventListener('pointerdown',e=>{if(isTouch()&&e.clientX>innerWidth*.42){lookId=e.pointerId;last={x:e.clientX,y:e.clientY};}});
  renderer.domElement.addEventListener('pointermove',e=>{if(lookId===e.pointerId&&active&&!paused){yaw-=(e.clientX-last.x)*.006;pitch-=(e.clientY-last.y)*.006;pitch=Math.max(-1.2,Math.min(1.2,pitch));last={x:e.clientX,y:e.clientY};}});
  renderer.domElement.addEventListener('pointerup',e=>{if(e.pointerId===lookId)lookId=null;});
  $('interactBtn').addEventListener('pointerdown',e=>{e.preventDefault();interact();});
  $('crouchBtn').addEventListener('pointerdown',e=>{e.preventDefault();crouching=!crouching;$('crouchBtn').classList.toggle('active',crouching);});
  $('runBtn').addEventListener('pointerdown',e=>{e.preventDefault();running=true;});
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>$('runBtn').addEventListener(ev,()=>running=false));
  $('lookHint').addEventListener('pointerdown',()=>{toast('Drag the right side of the screen to look around.');});
}
function startGame(){
  resetGame();active=true;paused=false;ended=false;menu.classList.add('hidden');pauseScreen.classList.add('hidden');ending.classList.add('hidden');hud.classList.remove('hidden');
  if(!isTouch())requestPointerLock();clock.getDelta();showMessage('Find a way out. Stay quiet.',2400);updateHud();
}
function resetGame(){
  player.x=0;player.z=11.7;player.hidden=false;yaw=Math.PI;pitch=0;items=new Set();keyTaken=false;puzzleSolved=false;monsterState='patrol';monster.position.set(5,0,-10);monsterTarget=null;alertTimer=0;lastNoise=0;
  keyMesh.visible=true;puzzleMesh.material=M.darkWall;doorMesh.visible=true;doorMesh.material=M.wood;
  active=false;paused=false;ended=false;crouching=false;running=false;moveX=moveZ=0;
}
function pause(){paused=true;pauseScreen.classList.remove('hidden');if(document.exitPointerLock)document.exitPointerLock();}
function resume(){paused=false;pauseScreen.classList.add('hidden');if(!isTouch())requestPointerLock();clock.getDelta();}
function toMenu(){active=false;paused=false;ended=false;hud.classList.add('hidden');pauseScreen.classList.add('hidden');ending.classList.add('hidden');menu.classList.remove('hidden');if(document.exitPointerLock)document.exitPointerLock();}
function finish(won){
  ended=true;active=false;paused=false;if(document.exitPointerLock)document.exitPointerLock();ending.classList.remove('hidden');
  $('endingEyebrow').textContent=won?'YOU MADE IT':'THE HOUSE CLAIMED YOU';
  $('endingTitle').textContent=won?'YOU ESCAPED':'CAUGHT';
  $('endingText').textContent=won?'You found the exit. Behind you, the house falls silent.':'The caretaker found you in the dark. The night starts again.';
  $('againBtn').textContent=won?'PLAY AGAIN':'TRY AGAIN';
}
function showMessage(text,duration=1700){const el=$('message');el.textContent=text;el.style.opacity='1';clearTimeout(messageTimer);messageTimer=setTimeout(()=>el.style.opacity='0',duration);}
function toast(text){const el=$('toast');el.textContent=text;el.style.opacity='1';clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.style.opacity='0',1800);}
function updateHud(){
  $('objectiveText').textContent=!keyTaken?'Find the basement key.':!puzzleSolved?'Unlock the basement door and solve the symbol lock.':'Get to the exit door and escape.';
  $('items').textContent=items.size?[...items].join(', '):'Empty';
  const status=$('status');status.textContent=monsterState==='chase'?'SHE HEARS YOU':monsterState==='search'?'SEARCHING':'QUIET';status.classList.toggle('alert',monsterState==='chase'||monsterState==='search');
}
function playerDirection(){return new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));}
function isBlocked(x,z){
  const r=.34;
  if(x<WORLD.minX+r||x>WORLD.maxX-r||z<WORLD.minZ+r||z>WORLD.maxZ-r)return true;
  for(const c of colliders){
    if(c.mesh.visible && Math.abs(x-c.x)<c.hw+r && Math.abs(z-c.z)<c.hd+r)return true;
  }
  // door blocks movement until solved; collision remains on door panel
  if(!puzzleSolved && Math.abs(x+2)<1.1 && Math.abs(z-7)<.55)return true;
  return false;
}
function movePlayer(dt){
  if(player.hidden)return;
  let f=0,s=0;
  if(keys.KeyW||keys.ArrowUp)f+=1;if(keys.KeyS||keys.ArrowDown)f-=1;
  if(keys.KeyA||keys.ArrowLeft)s-=1;if(keys.KeyD||keys.ArrowRight)s+=1;
  f+=-moveZ;s+=moveX;
  const len=Math.hypot(f,s);if(len>1){f/=len;s/=len;}
  const forward=playerDirection(),right=new THREE.Vector3(-forward.z,0,forward.x);
  const speed=crouching?1.45:(running?5.0:3.0);
  const dx=(forward.x*f+right.x*s)*speed*dt,dz=(forward.z*f+right.z*s)*speed*dt;
  if(!isBlocked(player.x+dx,player.z))player.x+=dx;
  if(!isBlocked(player.x,player.z+dz))player.z+=dz;
  if((running&&len>.1)||len>.65&&!crouching){if(Math.random()<dt*2)makeNoise();}
}
function makeNoise(){lastNoise=performance.now();if(monsterState!=='chase')monsterState='search';monsterTarget=new THREE.Vector3(player.x,0,player.z);alertTimer=Math.max(alertTimer,3.5);}
function updateCamera(){
  camera.position.set(player.x,player.hidden?1.2:(crouching?1.05:1.62),player.z);
  camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;
}
function nearestInteractable(){
  raycasterReusable.setFromCamera(new THREE.Vector2(0,0),camera);
  const candidates=objects.filter(o=>o.visible&&o.userData.kind!=='symbol');
  const hits=raycasterReusable.intersectObjects(candidates,false);
  if(hits.length&&hits[0].distance<2.4)return hits[0].object;
  return null;
}
function interact(){
  if(!active||paused||ended)return;
  if(player.hidden){player.hidden=false;showMessage('You slip out of the wardrobe.');return;}
  const obj=nearestInteractable();
  if(!obj){toast('Nothing close enough to use.');return;}
  const kind=obj.userData.kind;
  if(kind==='key'){
    if(!keyTaken){keyTaken=true;keyMesh.visible=false;items.add('Basement key');showMessage('You found the basement key.');makeNoise();updateHud();}
  }else if(kind==='puzzle'){
    if(!items.has('Basement key')){showMessage('Locked. You need the basement key.');return;}
    if(!puzzleSolved){
      // Simple symbol sequence puzzle: interact three times to align symbols.
      const n=Number(obj.userData.turns||0)+1;obj.userData.turns=n;
      const symbols=['STAR','MOON','TRIANGLE'];
      showMessage('Symbol lock: '+symbols[(n-1)%3]+' • Press E to test the lock',1400);
      if(n>=3){puzzleSolved=true;obj.visible=false;items.add('Basement unlocked');showMessage('The lock clicks open. The basement is clear!');updateHud();}
    }else{showMessage('The passage is open.');}
  }else if(kind==='exit'){
    if(!puzzleSolved){showMessage('The exit mechanism is jammed. Open the basement lock first.');return;}
    if(!items.has('Basement key')){showMessage('The exit needs the basement key.');return;}
    finish(true);
  }else if(kind==='hide'){
    player.hidden=true;showMessage('You hide in the wardrobe. Stay still.');if(monsterState==='chase')monsterState='search';
  }else if(kind==='note'){
    showMessage('A note: “STAR • MOON • TRIANGLE. The old lock remembers.”',2600);
  }
}
function updateMonster(dt){
  if(!active||player.hidden)return;
  const dist=Math.hypot(monster.position.x-player.x,monster.position.z-player.z);
  const now=performance.now();
  if(dist<7.5&&!crouching){monsterState='chase';monsterTarget=new THREE.Vector3(player.x,0,player.z);alertTimer=3.5;}
  else if(lastNoise&&now-lastNoise<4000&&dist<11){monsterState='search';monsterTarget=new THREE.Vector3(player.x,0,player.z);alertTimer=Math.max(alertTimer,2.5);}
  if(monsterState==='patrol'){
    if(!monsterTarget||Math.hypot(monster.position.x-monsterTarget.x,monster.position.z-monsterTarget.z)<.8){
      const patrol=[[-9,-10],[7,-9],[8,4],[-8,5],[0,-2],[5,10]];
      const p=patrol[Math.floor(Math.random()*patrol.length)];monsterTarget=new THREE.Vector3(p[0],0,p[1]);
    }
  }else if(monsterState==='search'){
    alertTimer-=dt;if(alertTimer<=0)monsterState='patrol';
  }else if(monsterState==='chase'){
    alertTimer-=dt;if(alertTimer<=0&&dist>8)monsterState='search';
  }
  if(monsterTarget){
    const dx=monsterTarget.x-monster.position.x,dz=monsterTarget.z-monster.position.z,len=Math.hypot(dx,dz);
    if(len>.15){
      const speed=monsterState==='chase'?2.45:monsterState==='search'?1.55:0.8;
      const nx=monster.position.x+dx/len*speed*dt,nz=monster.position.z+dz/len*speed*dt;
      // avoid wall collisions by trying axes separately
      if(!isBlocked(nx,monster.position.z))monster.position.x=nx;
      if(!isBlocked(monster.position.x,nz))monster.position.z=nz;
      monster.rotation.y=Math.atan2(-dx,-dz);
    }
  }
  if(dist<.9&&!player.hidden)finish(false);
}
function updatePrompt(){
  if(!active||paused||player.hidden){$('prompt').textContent=player.hidden?'Press E to leave hiding place':'';return;}
  const obj=nearestInteractable();let txt='';
  if(obj){const k=obj.userData.kind;txt=k==='key'?'[E] Pick up basement key':k==='puzzle'?'[E] Use symbol lock':k==='exit'?'[E] Try the exit':k==='hide'?'[E] Hide in wardrobe':k==='note'?'[E] Read note':'';}
  $('prompt').textContent=txt;
}
function animate(){
  requestAnimationFrame(animate);if(!renderer)return;
  const dt=Math.min(clock.getDelta(),.05);
  if(active&&!paused&&!ended){movePlayer(dt);updateCamera();updateMonster(dt);updatePrompt();updateHud();
    if(monsterState==='chase'&&Math.random()<dt*.8)showMessage('She heard you...',650);
  }else if(camera){updateCamera();}
  if(monster){monster.children.forEach((part,i)=>{if(i===1)part.position.y=1.85+Math.sin(performance.now()*.004)*.025;});}
  renderer.render(scene,camera);
}
const splash = $('splash');
function dismissSplash(){
  if(!splash || splash.classList.contains('leaving')) return;
  splash.classList.add('leaving');
  setTimeout(()=>{ splash.remove(); }, 700);
}
splash.addEventListener('click', dismissSplash);
splash.addEventListener('keydown', e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();dismissSplash();}});
$('playBtn').addEventListener('click',startGame);
$('howBtn').addEventListener('click',()=> $('howText').classList.toggle('hidden'));
$('resumeBtn').addEventListener('click',resume);
$('restartBtn').addEventListener('click',startGame);
$('mainBtn').addEventListener('click',toMenu);
$('againBtn').addEventListener('click',startGame);
$('endingMenuBtn').addEventListener('click',toMenu);
init();
})();
