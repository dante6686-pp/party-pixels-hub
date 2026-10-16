// Controller integration with DOM/audio/renderer doubles, NOT browser/WebGL/touch tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { initialState, decide, validCheckpoint } from '../apps/hub/public/games/nocna-portiernia/logic.mjs';
import { visits, residents, PROTOTYPE_LIMIT } from '../apps/hub/public/games/nocna-portiernia/scenario.mjs';
import { requestDefaultFullscreen } from '../apps/hub/public/games/nocna-portiernia/fullscreen.mjs';
const base=new URL('../apps/hub/public/games/nocna-portiernia/',import.meta.url);

function harness({brokenStorage=false}={}){
  const nodes=new Map(),events=new Map(),frames=[];let clock=0,intersection;
  class Element {
    constructor(id){this.id=id;this.hidden=false;this.disabled=false;this.textContent='';this.dataset={};this.html='';this.scrollHeight=20;this.clientHeight=20;this.classList={toggle(){}};}
    set innerHTML(value){this.html=value;for(const m of value.matchAll(/id="([^"]+)"/g))nodes.set(m[1],new Element(m[1]));}
    get innerHTML(){return this.html;}
    querySelector(selector){if(selector==='button')return get('new');return null;}
    querySelectorAll(){return [];}
    setAttribute(name,value){this[name]=value;}
    addEventListener(){}
    focus(){document.activeElement=this;}
    contains(){return false;}
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
  for(const m of readFileSync(new URL('index.html',base),'utf8').matchAll(/id="([^"]+)"/g))get(m[1]);
  get('inspection').hidden=true;get('fatal').hidden=true;
  const document={getElementById:get,querySelectorAll:()=>[],addEventListener:(name,fn)=>events.set(name,fn),hidden:false,activeElement:null};
  const window={addEventListener:(name,fn)=>events.set(name,fn)};window.parent=window;
  const storage=new Map();const pauses=[];
  const renderer={portraits:Object.fromEntries(residents.map(r=>[r.id,'data:image/png;base64,test'])),show(){},center(){},pause(value){pauses.push(value);},depart(){},flicker(){},rattle(){}};
  const context=vm.createContext({document,window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(brokenStorage)throw Error('QUOTA');storage.set(k,v);}},
    createScene:()=>renderer,createAudio:()=>({pause(){},resume(){},enabled(){},cue(){}}),residents,visits,PROTOTYPE_LIMIT,initialState,decide,validCheckpoint,requestDefaultFullscreen,structuredClone,console,
    IntersectionObserver:class{constructor(fn){intersection=fn;}observe(){}unobserve(){}},requestAnimationFrame:fn=>frames.push(fn)});
  vm.runInContext(readFileSync(new URL('main.mjs',base),'utf8').replace(/^import .+;$/gm,''),context);
  return {get,storage,events,pauses,click(id){assert.equal(get(id).disabled,false,`${id} should be enabled`);get(id).onclick();},
    visible(kind,ratio=1){intersection([{target:get(`${kind==='card'?'card':'resident'}-content`),isIntersecting:ratio>0,intersectionRatio:ratio}]);},
    photo(){vm.runInContext('portrait("jan")',context);},state:()=>vm.runInContext('state',context),
    advance(seconds){for(let i=0;i<seconds*60;i++){clock+=1000/60;const batch=frames.splice(0);for(const fn of batch)fn(clock);}}};
}
function start(h){h.click('new');h.click('begin');assert.equal(h.get('allow').disabled,true);assert.equal(h.get('inspection').hidden,false);}
function inspectBoth(h){h.visible('card');h.click('register');h.visible('register');}

test('controller: opening hidden register does not count as viewing; actual comparison permits decisions without closing',()=>{
  const h=harness();start(h);h.visible('card');h.click('register');assert.equal(h.get('allow').disabled,true);
  h.visible('register',.4);assert.equal(h.get('allow').disabled,true);h.visible('register');assert.equal(h.get('allow').disabled,false);
  assert.equal(h.get('inspection').hidden,false);assert.equal(h.pauses.at(-1),false);
  h.click('allow');assert.equal(h.state().nextVisitIndex,1);h.get('allow').onclick();assert.equal(h.state().nextVisitIndex,1);
  h.click('pause');h.advance(5);assert.equal(h.get('overlay').hidden,false);
  h.click('resume');h.advance(4);assert.match(h.get('dialog-copy').textContent,/Siódemka/);
  h.click('deny');h.advance(4);assert.match(h.get('panel').innerHTML,/Poprawne decyzje: 2\/2/);
  assert.equal(JSON.parse([...h.storage.values()][0]).ending,'prototype');h.click('menu');h.click('continue');assert.match(h.get('panel').innerHTML,/Poprawne decyzje: 2\/2/);
});
test('controller: selected resident survives tabs, guest view, photograph, resize and pause; modal blocks decisions',()=>{
  const h=harness();start(h);inspectBoth(h);h.get('resident-select').onchange({target:{value:'teresa'}});
  h.click('look');h.click('card');h.click('register');assert.match(h.get('resident-select').innerHTML,/value="teresa" selected/);
  h.photo();assert.equal(h.get('allow').disabled,true);h.get('allow').onclick();assert.equal(h.state().nextVisitIndex,0);
  h.click('back-photo');assert.equal(h.get('allow').disabled,false);assert.equal(h.get('inspection').hidden,false);
  h.events.get('resize')();h.advance(.1);assert.match(h.get('resident-select').innerHTML,/value="teresa" selected/);
  h.click('pause');h.click('resume');assert.match(h.get('resident-select').innerHTML,/value="teresa" selected/);
  h.events.get('keydown')({key:'Escape',preventDefault(){}});assert.equal(h.get('inspection').hidden,true);
  h.events.get('keydown')({key:'Escape',preventDefault(){}});assert.match(h.get('panel').innerHTML,/Chwila ciszy/);
});
test('controller: errors count once, summary contains only played visits, restart requires confirmation',()=>{
  const h=harness();start(h);inspectBoth(h);h.click('deny');h.get('deny').onclick();assert.equal(h.state().mistakes,1);h.advance(4);
  h.click('allow');h.advance(4);assert.match(h.get('panel').innerHTML,/Poprawne decyzje: 0\/2/);assert.doesNotMatch(h.get('panel').innerHTML,/Paweł|Marta|Roman|Irena/);
  h.click('restart');assert.equal(h.state().mistakes,2);h.click('cancel-new');h.click('new');h.click('confirm-new');assert.equal(h.state().mistakes,0);
});
test('controller: successful save notice expires; errors persist in HUD and pause; focus loss pauses',()=>{
  const ok=harness();start(ok);ok.advance(3);assert.equal(ok.get('save-status').hidden,true);
  const h=harness({brokenStorage:true});start(h);h.advance(5);assert.equal(h.get('save-status').hidden,false);assert.match(h.get('save-status').textContent,/Błąd zapisu/);
  h.events.get('blur')();assert.match(h.get('panel').innerHTML,/Błąd zapisu/);h.click('resume');inspectBoth(h);h.click('allow');h.advance(4);assert.equal(h.state().nextVisitIndex,1);
});
