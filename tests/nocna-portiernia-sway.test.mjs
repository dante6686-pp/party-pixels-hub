import test from 'node:test';
import assert from 'node:assert/strict';
import {createCameraSway} from '../apps/hub/public/games/nocna-portiernia/camera-sway.mjs';
const max={yaw:.25*Math.PI/180,pitch:.20*Math.PI/180,roll:.06*Math.PI/180};
function advance(sway,seconds){let pose;for(let i=0;i<seconds*60;i++)pose=sway.update(1/60);return pose;}
test('sway is bounded and deterministic over long sessions, with no random frame jitter or accumulated drift',()=>{
  const a=createCameraSway(),b=createCameraSway();let previous=a.update(0);
  for(let i=0;i<60*60;i++){
    const p=a.update(1/60);assert.deepEqual(p,b.update(1/60));
    for(const key of Object.keys(max)){assert.ok(Math.abs(p[key])<=max[key]);assert.ok(Math.abs(p[key]-previous[key])<.0001);}
    previous=p;
  }
});
test('pause freezes phase and envelope; resume continues without a jump',()=>{
  const a=createCameraSway(),b=createCameraSway();advance(a,2);advance(b,2);
  const frozen=a.update(0);for(let i=0;i<300;i++)assert.deepEqual(a.update(1/60,true),frozen);
  assert.deepEqual(a.update(1/60),b.update(1/60));
});
test('documents smoothly reduce sway, modal fades to zero, and effect can be switched off and restored',()=>{
  const a=createCameraSway(),ref=createCameraSway();advance(a,3);advance(ref,3);
  a.setReading('documents');advance(a,4);advance(ref,4);const doc=a.update(1/60),full=ref.update(1/60);
  for(const key of Object.keys(max))assert.ok(Math.abs(doc[key])<=max[key]*.151);
  a.setReading('modal');assert.notDeepEqual(a.update(1/60),{yaw:0,pitch:0,roll:0});assert.deepEqual(advance(a,4),{yaw:0,pitch:0,roll:0});
  a.setReading(false);a.setEnabled(false);assert.deepEqual(advance(a,1),{yaw:0,pitch:0,roll:0});
  a.setEnabled(true);assert.notDeepEqual(advance(a,2),{yaw:0,pitch:0,roll:0});
});
