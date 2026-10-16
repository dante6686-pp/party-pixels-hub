import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CheckpointSync,cloudSnapshot} from '../apps/hub/lib/checkpoint-sync.ts';
import {campaignTitle,saveKey} from '../apps/hub/lib/game-protocol.ts';
const memory=()=>{const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};};
const backend=()=>{
 let state={revision:0,checkpoint:null as null|{mission:number;cash:number}},last='',lastExpected=-1;
 let loseReply=false,offline=false;
 return {
  get state(){return structuredClone(state);},set loseReply(value:boolean){loseReply=value;},set offline(value:boolean){offline=value;},
  load:async()=>{if(offline)throw Error('NETWORK_ERROR');return structuredClone(state);},
  save:async(job:{expectedRevision:number;requestId:string;checkpoint:{mission:number;cash:number}})=>{
   if(offline)throw Error('NETWORK_ERROR');
   if(last===job.requestId&&lastExpected===job.expectedRevision&&JSON.stringify(state.checkpoint)===JSON.stringify(job.checkpoint))return structuredClone(state);
   if(state.revision!==job.expectedRevision)throw Error('SAVE_CONFLICT');
   state={revision:state.revision+1,checkpoint:job.checkpoint};last=job.requestId;lastExpected=job.expectedRevision;
   if(loseReply){loseReply=false;throw Error('NETWORK_ERROR');}return structuredClone(state);
  },
 };
};
test('a second device loads the saved mission and cash for the same account',async()=>{
 const api=backend(),a=new CheckpointSync('a',memory(),api,()=>{}),b=new CheckpointSync('a',memory(),api,()=>{});
 await a.load();a.enqueue({mission:1,cash:500});await a.flush();
 assert.deepEqual(await b.load(),{revision:1,checkpoint:{mission:1,cash:500}});assert.equal(a.getStatus(),'cloud');
});
test('lost reply survives a reload and retry does not create a second revision',async()=>{
 const api=backend(),disk=memory(),a=new CheckpointSync('a',disk,api,()=>{});await a.load();api.loseReply=true;
 a.enqueue({mission:2,cash:1300});await a.flush();assert.equal(a.getStatus(),'pending');a.dispose();
 const afterReload=new CheckpointSync('a',disk,api,()=>{});await afterReload.load();
 assert.equal(afterReload.getStatus(),'cloud');assert.equal(api.state.revision,1);assert.equal(afterReload.snapshot().checkpoint?.mission,2);
});
test('concurrent progress from another device is not silently overwritten',async()=>{
 const api=backend(),disk=memory(),a=new CheckpointSync('a',memory(),api,()=>{}),b=new CheckpointSync('a',disk,api,()=>{});
 await a.load();await b.load();a.enqueue({mission:2,cash:1300});await a.flush();
 b.enqueue({mission:1,cash:500});await b.flush();assert.equal(b.getStatus(),'conflict');assert.equal(api.state.checkpoint?.mission,2);
 assert.throws(()=>b.enqueue({mission:0,cash:0}),/SAVE_CONFLICT/);
 await b.useCloud();assert.equal(b.snapshot().checkpoint?.mission,2);assert.ok(disk.getItem(b.key+':conflict-backup'));
});
test('offline checkpoints are ordered and sent once after connectivity returns',async()=>{
 const api=backend(),a=new CheckpointSync('a',memory(),api,()=>{});await a.load();api.offline=true;
 a.enqueue({mission:1,cash:500});a.enqueue({mission:2,cash:1300});await a.flush();assert.equal(a.getStatus(),'pending');
 api.offline=false;await a.flush();assert.equal(api.state.revision,2);assert.equal(api.state.checkpoint?.mission,2);assert.equal(a.getStatus(),'cloud');
});
test('guest and another account are never imported into a signed-in empty slot',async()=>{
 const disk=memory(),api=backend();disk.setItem(saveKey(null),JSON.stringify({mission:3,cash:2800}));disk.setItem(saveKey('other'),JSON.stringify({mission:2,cash:1300}));
 const a=new CheckpointSync('a',disk,api,()=>{});await a.load();assert.equal(a.snapshot().checkpoint,null);assert.equal(api.state.revision,0);
 const guest=new CheckpointSync(null,disk,null,()=>{});assert.equal((await guest.load()).checkpoint?.mission,3);
});
test('the existing account-local checkpoint imports once and cloud wins thereafter',async()=>{
 const api=backend(),disk=memory();disk.setItem(saveKey('a'),JSON.stringify({mission:2,cash:1300}));
 const a=new CheckpointSync('a',disk,api,()=>{});await a.load();assert.equal(api.state.revision,1);
 disk.setItem(saveKey('a'),JSON.stringify({mission:3,cash:9999}));const b=new CheckpointSync('a',disk,api,()=>{});await b.load();assert.equal(b.snapshot().checkpoint?.mission,2);
});
test('malformed server replies and local write failures are not acknowledged as cloud saves',async()=>{
 assert.throws(()=>cloudSnapshot({revision:1,checkpoint:{mission:20,cash:0}}));assert.throws(()=>cloudSnapshot({revision:0,checkpoint:{mission:0,cash:0}}));
 const api=backend(),disk={getItem:()=>null,setItem:()=>{throw Error('quota');}},a=new CheckpointSync('a',disk,api,()=>{});
 await a.load();assert.throws(()=>a.enqueue({mission:1,cash:500}),/LOCAL_SAVE_FAILED/);assert.equal(api.state.revision,0);
});
test('completed campaign is visibly differentiated from mission one',()=>{
 assert.match(campaignTitle(0),/Misja 1\/3/);assert.match(campaignTitle(1),/Misja 2\/3/);assert.match(campaignTitle(2),/Misja 3\/3/);assert.match(campaignTitle(3),/Wolna jazda/);
});
