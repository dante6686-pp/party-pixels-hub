// Scene logic/projection with a renderer double. This does NOT exercise a GPU or WebGL.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as THREE from '../apps/hub/public/games/magazyn-auto/vendor/three.module.js';
import { residents } from '../apps/hub/public/games/nocna-portiernia/scenario.mjs';
import { createCameraSway } from '../apps/hub/public/games/nocna-portiernia/camera-sway.mjs';
function sceneHarness(){
  const frames=[],events=new Map();let renderer,clock=0;
  class Renderer {
    constructor(){renderer=this;this.domElement={toDataURL:()=> 'data:image/png;base64,test',addEventListener(){}};}
    setPixelRatio(){}setSize(){}dispose(){}
    render(scene,camera){this.scene=scene;this.camera=camera;}
  }
  const container={clientWidth:390,clientHeight:230,append(){},getBoundingClientRect:()=>({width:390,height:230,left:0,top:0}),addEventListener:(kind,fn)=>events.set(kind,fn),setPointerCapture(){}};
  const ctx=vm.createContext({THREE:{...THREE,WebGLRenderer:Renderer},residents,createCameraSway,window:{innerWidth:390,innerHeight:844},devicePixelRatio:2,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>frames.push(fn)});
  vm.runInContext(readFileSync(new URL('../apps/hub/public/games/nocna-portiernia/scene.mjs',import.meta.url),'utf8').replace(/^import .+;$/gm,'').replaceAll('export function ','function '),ctx);
  const scene=vm.runInContext('createScene',ctx)(container,()=>{},()=>{});
  return {scene,events,get renderer(){return renderer;},step(){clock+=16.67;const batch=frames.splice(0);batch.forEach(fn=>fn(clock));}};
}
test('scene: models are reused, final face and morning light can be reset for a new shift',()=>{
  const h=sceneHarness();h.scene.show('roman');h.scene.pause(false);h.step();const world=h.renderer.scene;
  const visitor=world.children.find(n=>n.type==='Group'&&n.children.some(c=>c.userData.smile));const model=visitor.children[0];
  h.scene.show('jan');h.scene.show('roman');assert.equal(visitor.children[0],model);
  h.scene.cinematic('failed',5.4);h.step();assert.ok(h.renderer.camera.position.x>.9);assert.equal(visitor.visible,false);
  assert.ok(world.children.some(n=>n.userData.smile&&n.visible));
  h.scene.show('jan');h.step();assert.equal(visitor.visible,true);assert.equal(h.renderer.camera.position.x,0);
  assert.ok(!world.children.some(n=>n.userData.smile&&n.visible));
  h.scene.cinematic('survived',4);h.step();const ambient=world.children.find(n=>n.isHemisphereLight);assert.ok(ambient.intensity>1.5);
  h.scene.show('pawel');h.scene.gesture('smile');h.step();assert.equal(visitor.children[0].userData.smile.visible,true);
  h.scene.gesture('still');assert.equal(visitor.children[0].userData.smile.visible,false);assert.equal(ambient.intensity,.95);
});
test('scene: no-flashes keeps the lamp steady; cinematic camera cannot be dragged',()=>{
  const h=sceneHarness();h.scene.show('jan');h.scene.pause(false);h.scene.flicker(false);h.step();
  const lamp=h.renderer.scene.children.find(n=>n.isPointLight&&n.position.y===2.6);assert.equal(lamp.intensity,7);
  h.scene.cinematic('failed',5);h.events.get('pointerdown')({pointerId:1,clientX:50,clientY:50});h.step();
  assert.ok(Number.isFinite(h.renderer.camera.rotation.y));h.scene.pause(true);h.step();const rotation=h.renderer.camera.rotation.y;h.step();assert.equal(h.renderer.camera.rotation.y,rotation);
});
