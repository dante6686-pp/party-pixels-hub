import * as THREE from '../magazyn-auto/vendor/three.module.js';
import { residents } from './scenario.mjs';

// Deliberately procedural: no network, model downloads or AI calls at runtime.
const materials = new Map();
function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:1}));return materials.get(color);}
function box(parent,w,h,d,x,y,z,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);parent.add(m);return m;}
function ball(parent,x,y,z,sx,sy,sz,color,detail=1){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,detail),mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
function ring(parent,x,y,z,r,color){const m=new THREE.Mesh(new THREE.TorusGeometry(r,.011,5,20),mat(color));m.position.set(x,y,z);parent.add(m);return m;}
export function makePerson(id){
  const p=new THREE.Group(),skin=id==='roman'?'#bb9578':'#c5aa8c';
  const hair=['jan','irena'].includes(id)?'#aab0a2':'#352f28';
  const broad=id==='roman',long=id==='irena';
  box(p,broad?.64:.53,.64,.29,0,.91,0,id==='teresa'?'#645647':id==='jan'?'#3a4d46':'#454b40');
  ball(p,0,1.27,0,.12,.17,.11,skin);
  ball(p,0,1.57,0,broad?.25:.205,long?.32:.275,.19,skin,2);
  ball(p,-.217,1.56,0,.045,.075,.045,skin);ball(p,.217,1.56,0,.045,.075,.045,skin);
  ball(p,0,1.55,.19,.045,.07,.065,skin);
  for(const x of [-.084,.084]){
    ball(p,x,1.63,.172,.04,.025,.025,'#e0dbc5');ball(p,x,1.631,.195,.015,.018,.01,'#242a25');
    box(p,.075,.018,.018,x,1.685,.166,hair);
  }
  box(p,.085,.014,.014,0,1.435,.169,'#755f50');
  if(id==='jan'){
    ball(p,-.06,1.48,.192,.077,.033,.032,hair);ball(p,.06,1.48,.192,.077,.033,.032,hair);
    for(const x of [-.18,.18])ball(p,x,1.7,-.035,.05,.13,.13,hair);
  }else if(id==='teresa'){
    for(let i=0;i<13;i++){const a=i/12*Math.PI;ball(p,Math.cos(a)*.2,1.68+Math.sin(a)*.18,-.015,.078,.075,.095,hair);}
    for(const x of [-.09,.09])ring(p,x,1.626,.214,.073,'#373d31');
    box(p,.05,.012,.016,0,1.636,.219,'#373d31');
  }else if(id==='roman'){
    ball(p,0,1.42,.08,.235,.17,.15,hair);box(p,.41,.08,.3,0,1.81,-.015,hair);
  }else if(id==='marta'){
    box(p,.44,.36,.25,0,1.69,-.1,hair);box(p,.36,.09,.1,0,1.77,.13,hair);
    ball(p,.13,1.52,.17,.012,.012,.01,'#352f28');
  }else if(id==='irena'){
    ball(p,0,1.78,-.055,.21,.15,.18,hair);ball(p,0,1.81,-.23,.12,.12,.11,hair);
  }else{
    ball(p,0,1.8,-.035,.206,.09,.18,hair);box(p,.022,.023,.025,-.09,1.685,.17,skin);
  }
  // Arms and trouser legs keep the silhouette readable during approach/departure.
  for(const x of [-.32,.32]){box(p,.14,.58,.19,x,.88,0,'#414b40');ball(p,x,.55,.05,.065,.09,.07,skin);}
  for(const x of [-.14,.14])box(p,.21,.55,.24,x,.32,0,'#272f29');
  return p;
}

export function cameraFrame(width,height,portrait){
  const z=portrait?.95:1.6,y=portrait?1.64:1.7,distance=z+1.1;
  const worldHeight=Math.max(portrait?1.25:1.75,.72/(width/height));
  return {z,y,pitch:portrait?-.035:-.055,fov:THREE.MathUtils.radToDeg(2*Math.atan(worldHeight/(2*distance)))};
}

export function createScene(container,onInspect,onContextLost){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#131e19');scene.fog=new THREE.Fog('#131e19',5,13);
  const camera=new THREE.PerspectiveCamera(53,1,.08,25);camera.position.set(0,1.55,2.75);
  scene.add(new THREE.HemisphereLight('#d9ded8','#29312c',.95));
  const fluorescent=new THREE.PointLight('#d6e1c8',7,10,2);fluorescent.position.set(0,2.6,.1);scene.add(fluorescent);
  const visitorLight=new THREE.PointLight('#f5eee6',3.5,5,2);visitorLight.position.set(0,1.95,-.1);scene.add(visitorLight);
  box(scene,8,.1,12,0,-.1,-2,'#3a4036');box(scene,8,.2,10,0,2.9,-2,'#394438');
  for(const x of [-3,3]){box(scene,.2,3,10,x,1.35,-2,'#5f6b55');box(scene,.22,1.12,10,x,.47,-2,'#3a4e43');}
  box(scene,8,3,.15,0,1.35,-5,'#53624d');
  // Tile joints, worn patches and a distant block entrance.
  for(let i=-5;i<5;i++)box(scene,6,.004,.014,0,-.044,i,'#242f28');
  for(let i=-3;i<=3;i++)box(scene,.014,.004,10,i,-.043,-1,'#283329');
  box(scene,1.25,2.25,.18,1.5,1.08,-4.85,'#1f3029');box(scene,.85,1.2,.05,1.5,1.5,-4.73,'#101e19');
  box(scene,.12,.035,.07,1.95,1.1,-4.62,'#a9b39a');
  for(let i=0;i<14;i++)box(scene,.2+((i*7)%5)/10,.07,.018,-2.7+(i*.39)%5,1.4+(i%4)*.22,-4.9,'#65705a');
  // Booth wall with genuinely open inspection window.
  box(scene,6,.88,.16,0,.38,0,'#465749');box(scene,6,.5,.16,0,2.65,0,'#52614f');
  for(const x of [-1.18,1.18])box(scene,.12,1.6,.2,x,1.56,0,'#253c32');
  for(const x of [-2,2])box(scene,1.55,1.6,.15,x,1.56,0,'#4c5b4b');
  box(scene,2.48,.09,.24,0,.86,.08,'#84907a');box(scene,2.48,.075,.2,0,2.35,.04,'#84907a');
  box(scene,2.75,.1,1.22,0,.72,1.05,'#706448');box(scene,2.7,.6,.1,0,.36,1.55,'#3f4938');
  box(scene,.9,.05,.22,0,2.74,.5,'#dce7be');
  const door=new THREE.Group();door.position.set(2,0,1.15);scene.add(door);
  box(door,.12,2.3,1,0,1.1,0,'#303f33');const handle=box(door,.06,.035,.2,-.11,1.03,.24,'#a6ad8f');
  // Desk objects are raycast targets, also available as explicit UI buttons.
  const register=box(scene,.48,.025,.55,-.78,.79,1.16,'#b8baa0');register.rotation.y=.13;register.userData.inspect='register';
  for(let i=0;i<6;i++)box(scene,.3,.003,.012,-.78,.806,.99+i*.055,'#7c846d');
  const card=box(scene,.33,.022,.22,.22,.79,1.15,'#ddd5b7');card.rotation.y=-.09;card.userData.inspect='card';
  box(scene,.22,.005,.04,.22,.805,1.12,'#6b7c61');
  box(scene,.26,.12,.37,.87,.82,.88,'#323d32');for(let i=0;i<5;i++)box(scene,.16,.005,.014,.87,.887,.77+i*.035,'#141e17');
  const portraits={};const portraitScene=new THREE.Scene();portraitScene.background=new THREE.Color('#69715e');
  portraitScene.add(new THREE.HemisphereLight('#fff2d0','#3f4a39',2.5));
  const portraitLight=new THREE.DirectionalLight('#fff7df',2);portraitLight.position.set(1,2,3);portraitScene.add(portraitLight);
  const portraitCamera=new THREE.PerspectiveCamera(30,240/300,.1,10);portraitCamera.position.set(0,1.57,1.65);portraitCamera.lookAt(0,1.54,0);
  renderer.setSize(240,300,false);
  for(const resident of residents){const model=makePerson(resident.id);portraitScene.add(model);renderer.render(portraitScene,portraitCamera);portraits[resident.id]=renderer.domElement.toDataURL('image/png');portraitScene.remove(model);}
  container.append(renderer.domElement);
  const visitor=new THREE.Group();visitor.position.set(0,0,-1.1);scene.add(visitor);
  let yaw=0,pitch=0,basePitch=0,gesture=null,dragged=false,time=0,last=0,paused=true,departing=false,approach=0,flash=0,allowFlash=false,dirty=true;
  const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
  function resize(){gesture=null;dirty=true;const r=container.getBoundingClientRect();if(!r.width||!r.height)return;const frame=cameraFrame(r.width,r.height,window.innerWidth<window.innerHeight);camera.aspect=r.width/r.height;camera.fov=frame.fov;camera.position.set(0,frame.y,frame.z);basePitch=frame.pitch;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);}
  resize();const observer=new ResizeObserver(resize);observer.observe(container);
  container.addEventListener('pointerdown',e=>{if(paused||gesture)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY};dragged=false;container.setPointerCapture(e.pointerId);});
  container.addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.id)return;const dx=e.clientX-gesture.lastX,dy=e.clientY-gesture.lastY;if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>7)dragged=true;if(dragged){yaw=THREE.MathUtils.clamp(yaw-dx*.003,-.62,.62);pitch=THREE.MathUtils.clamp(pitch-dy*.002,-.28,.25);}gesture.lastX=e.clientX;gesture.lastY=e.clientY;});
  container.addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;const click=!dragged;gesture=null;if(!click||paused)return;const r=container.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);const hit=ray.intersectObjects([card,register])[0];if(hit)onInspect(hit.object.userData.inspect);});
  for(const type of ['pointercancel','lostpointercapture'])container.addEventListener(type,()=>{gesture=null;});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;onContextLost();});
  function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-last)/1000||0,.05);last=now;if(paused&&!dirty)return;if(!paused){time+=dt;approach=Math.min(1,approach+dt*.85);visitor.position.z=departing?-1.1-time*1.2:-1.1-(1-approach)*2.8;visitor.position.x=departing?time*.65:0;visitor.rotation.y=departing?.7:Math.sin(time*.55)*.035;if(flash>0)flash=Math.max(0,flash-dt);}fluorescent.intensity=flash>0&&allowFlash?(Math.sin(flash*28)>0?3:7):7;camera.rotation.order='YXZ';camera.rotation.set(basePitch+pitch,yaw,0);renderer.render(scene,camera);dirty=false;}
  requestAnimationFrame(animate);
  return {portraits,show(id){visitor.clear();visitor.add(makePerson(id));time=0;approach=0;departing=false;yaw=0;pitch=0;dirty=true;},depart(){departing=true;time=0;},pause(value){paused=value;gesture=null;dirty=true;},center(){yaw=0;pitch=0;dirty=true;},flicker(enabled){allowFlash=enabled;flash=.35;},rattle(){handle.rotation.x=-.35;dirty=true;},dispose(){observer.disconnect();renderer.dispose();}};
}
