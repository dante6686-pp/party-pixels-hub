import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/hub/public/games/magazyn-auto/vendor/three.module.js';
import { cameraFrame,makePerson } from '../apps/hub/public/games/nocna-portiernia/scene.mjs';
import { residents } from '../apps/hub/public/games/nocna-portiernia/scenario.mjs';
// Projection geometry only: these scene regions approximate the responsive page, not browser screenshots.
const frames=[[360,180,true],[390,300,true],[412,340,true],[480,230,false],[847,650,false]];
test('default camera keeps all six heads and hairstyles inside the scene at mobile/desktop region sizes',()=>{
  for(const [w,h,portrait] of frames){
    const f=cameraFrame(w,h,portrait),camera=new THREE.PerspectiveCamera(f.fov,w/h,.08,25);
    camera.position.set(0,f.y,f.z);camera.rotation.set(f.pitch,0,0);camera.updateMatrixWorld();
    for(const r of residents){
      const model=makePerson(r.id),head=new THREE.Box3();
      for(const mesh of model.children)if(mesh.position.y>1.3)head.union(new THREE.Box3().setFromObject(mesh));
      for(const sign of [-1,0,1]){
      camera.rotation.set(f.pitch+sign*.20*Math.PI/180,sign*.25*Math.PI/180,sign*.06*Math.PI/180);camera.updateMatrixWorld();
      for(const x of [head.min.x,head.max.x])for(const y of [head.min.y,head.max.y])for(const z of [head.min.z,head.max.z]){
        const p=new THREE.Vector3(x,y,z-1.1).project(camera);
        assert.ok(Math.abs(p.x)<.92&&Math.abs(p.y)<.92,`${r.id} cropped at ${w}×${h}: ${p.x}, ${p.y}`);
      }
      }
    }
  }
});
