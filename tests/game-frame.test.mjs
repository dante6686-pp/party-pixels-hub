import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectPlatform} from '../apps/hub/public/games/magazyn-auto/platform.mjs';

test('a sandbox frame rejects foreign init and reports graphics failure even before connection',()=>{
  const listeners=new Map(),sent=[],received=[];
  globalThis.parent={postMessage:(...message)=>sent.push(message)};
  globalThis.document={referrer:'https://hub.example/play/magazyn-auto'};
  globalThis.window={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
  const bridge=connectPlatform({init:data=>received.push(data),input:()=>{},pause:()=>{},resume:()=>{},start:()=>{},saved:()=>{}});
  bridge.error();bridge.ready();
  assert.equal(sent[0][1],'https://hub.example');
  const messages=[],port={postMessage:data=>messages.push(data),start:()=>{}};
  const event={source:parent,origin:'https://hub.example',data:{type:'pp:init',protocol:1,build:'magazyn-auto-pp-1',mode:'keyboard'},ports:[port]};
  const init=listeners.get('message');
  init({...event,origin:'https://other.example'});
  init({...event,source:{}});
  init({...event,data:{...event.data,protocol:2}});
  assert.equal(received.length,0);
  init(event);
  assert.equal(received.length,1);
  assert.deepEqual(messages,[{type:'error'}]);
  assert.equal(listeners.has('message'),false);
});
