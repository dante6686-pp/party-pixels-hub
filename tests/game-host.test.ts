import {test} from 'node:test';
import assert from 'node:assert/strict';
import {acceptsHandshake,GAME,checkpoint,frameMessage,saveKey} from '../apps/hub/lib/game-protocol.ts';

test('only the selected sandbox frame and approved protocol/build get a capability port',()=>{
  const selected={},other={};
  const event={source:selected,origin:'null',data:{type:'pp:ready',protocol:1,build:GAME.build}};
  assert.equal(acceptsHandshake(event,selected),true);
  assert.equal(acceptsHandshake({...event,source:other},selected),false);
  assert.equal(acceptsHandshake({...event,origin:'https://evil.example'},selected),false);
  assert.equal(acceptsHandshake({...event,origin:'https://party-pixels-hub-v2-dev.vercel.app'},selected),false);
  assert.equal(acceptsHandshake({...event,data:{...event.data,protocol:2}},selected),false);
  assert.equal(acceptsHandshake({...event,data:{...event.data,build:'unknown'}},selected),false);
  assert.equal(acceptsHandshake({...event,source:null},null),false);
});
test('the frame cannot select another account, key, score or arbitrary checkpoint content',()=>{
  assert.deepEqual(frameMessage({type:'save',requestId:1,checkpoint:{mission:2,cash:1300}}),{type:'save',requestId:1,checkpoint:{mission:2,cash:1300}});
  for(const value of [null,[],{}, {mission:4,cash:0},{mission:1.5,cash:0},{mission:1,cash:-1},{mission:1,cash:Infinity},{mission:1,cash:1e12},{mission:1,cash:0,playerId:'other'}])assert.equal(checkpoint(value),null);
  assert.equal(frameMessage({type:'scores.submit',playerId:'other',value:999}),null);
  assert.equal(frameMessage({type:'save',requestId:'1',checkpoint:{mission:1,cash:500}}),null);
  assert.equal(frameMessage({type:'state',state:'<script>'}),null);
  assert.notEqual(saveKey('account-a'),saveKey('account-b'));
  assert.notEqual(saveKey('account-a'),saveKey(null));
});
