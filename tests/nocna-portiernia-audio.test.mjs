// Web Audio scheduling with node doubles, not an audible playback/device test.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const code=readFileSync(new URL('../apps/hub/public/games/nocna-portiernia/audio.mjs',import.meta.url),'utf8').replace('export function ','function ');
function audioHarness(supported=true){
  const sources=[];let context;
  const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
  class AudioContext {
    constructor(){context=this;this.state='suspended';this.currentTime=0;this.sampleRate=8000;this.destination={};}
    createGain(){return {gain:param(),connect(node){return node;},disconnect(){}};}
    source(){const node={frequency:param(),connect(n){return n;},disconnect(){},start(time){this.started=time;},stop(time){this.stopped=time??0;}};sources.push(node);return node;}
    createOscillator(){return this.source();}createBufferSource(){return this.source();}
    createBuffer(_channels,length){const data=new Float32Array(length);return {getChannelData:()=>data};}
    createBiquadFilter(){return {frequency:param(),Q:{value:0},connect(node){return node;},disconnect(){}};}
    async resume(){this.state='running';}async suspend(){this.state='suspended';}
  }
  const ctx=vm.createContext({window:supported?{AudioContext}:{}});vm.runInContext(code,ctx);
  return {audio:vm.runInContext('createAudio()',ctx),sources,get context(){return context;}};
}
test('audio: every story cue schedules finite sounds; mute, pause and cancellation remain available',async()=>{
  const h=audioHarness();await h.audio.resume();
  for(const kind of ['error','step','run','door','paper','tap','pipe','handle','crack','breath','intercom','laugh','key','creak'])h.audio.cue(kind);
  assert.ok(h.sources.length>30);for(const node of h.sources.slice(1)){assert.ok(Number.isFinite(node.started));assert.ok(Number.isFinite(node.stopped));assert.ok(node.stopped>node.started);}
  await h.audio.pause();assert.equal(h.context.state,'suspended');const count=h.sources.length;h.audio.cue('error');assert.equal(h.sources.length,count);
  h.audio.enabled(false);await h.audio.resume();h.audio.cue('door');assert.equal(h.sources.length,count);
  h.audio.enabled(true);await h.audio.resume();h.audio.stopEffects();h.audio.ambience(0);
  for(const node of h.sources.slice(1))assert.equal(node.stopped,0);
});
test('audio: unavailable AudioContext does not prevent the game or captions',async()=>{
  const h=audioHarness(false);await h.audio.resume();h.audio.cue('intercom');h.audio.enabled(false);h.audio.ambience(0);h.audio.stopEffects();h.audio.pause();assert.equal(h.sources.length,0);
});
