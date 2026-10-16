import test from 'node:test';
import assert from 'node:assert/strict';
import { requestDefaultFullscreen } from '../apps/hub/public/games/nocna-portiernia/fullscreen.mjs';
test('default fullscreen is requested immediately in the activating handler; existing fullscreen is retained',async()=>{
  let calls=0;
  const doc={documentElement:{requestFullscreen(){calls++;return Promise.resolve();}}};
  const result=requestDefaultFullscreen(doc);assert.equal(calls,1);assert.equal(await result,'requested');
  doc.fullscreenElement={};assert.equal(await requestDefaultFullscreen(doc),'active');assert.equal(calls,1);
});
test('unsupported and denied fullscreen return a fallback instead of rejecting the game start',async()=>{
  assert.equal(await requestDefaultFullscreen({}),'unsupported');
  assert.equal(await requestDefaultFullscreen({documentElement:{requestFullscreen(){throw Error('denied');}}}),'denied');
  assert.equal(await requestDefaultFullscreen({documentElement:{requestFullscreen(){return Promise.reject(Error('denied'));}}}),'denied');
});
