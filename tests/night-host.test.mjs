import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectNightHost,NIGHT_BUILD} from '../apps/hub/public/games/nocna-portiernia/host-bridge.mjs';
import {initialState,validCheckpoint} from '../apps/hub/public/games/nocna-portiernia/logic.mjs';
test('night demo bridge accepts only its parent, version and a single capability port',async()=>{
 const listeners=new Map(),sent=[],win={parent:{postMessage:m=>sent.push(m)},addEventListener:(t,f)=>listeners.set(t,f),removeEventListener:t=>listeners.delete(t)};
 const connection=connectNightHost(win),receive=listeners.get('message'),port={};
 const event={source:win.parent,data:{type:'PP_NIGHT_INIT',build:NIGHT_BUILD,checkpoint:initialState(2)},ports:[port]};
 receive({...event,source:{}});receive({...event,data:{...event.data,build:'foreign'}});receive({...event,ports:[]});
 assert.equal(listeners.has('message'),true);assert.deepEqual(sent,[{type:'PP_NIGHT_READY',build:NIGHT_BUILD}]);
 receive(event);const result=await connection;assert.equal(result.port,port);assert.equal(listeners.has('message'),false);assert.equal(validCheckpoint(result.checkpoint,2),true);
});
test('demo checkpoint cannot smuggle credentials, expand to eight visits or invent progress',()=>{
 const state=initialState(2);assert.equal(validCheckpoint({...state,accessToken:'x'},2),false);
 assert.equal(validCheckpoint(initialState(8),2),false);assert.equal(validCheckpoint({...state,nextVisitIndex:1},2),false);
});
