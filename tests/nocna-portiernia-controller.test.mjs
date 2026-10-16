// Controller integration with a minimal DOM/audio/renderer double. This is NOT a browser/WebGL test.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { initialState, decide, validCheckpoint } from '../apps/hub/public/games/nocna-portiernia/logic.mjs';
import { visits, residents, PROTOTYPE_LIMIT } from '../apps/hub/public/games/nocna-portiernia/scenario.mjs';
const base=new URL('../apps/hub/public/games/nocna-portiernia/',import.meta.url);

function harness({brokenStorage=false}={}){
  const nodes=new Map(),events=new Map(),frames=[];let clock=0;
  class Element {
    constructor(id){this.id=id;this.hidden=false;this.disabled=false;this.textContent='';this.dataset={};this.html='';}
    set innerHTML(value){this.html=value;for(const m of value.matchAll(/id="([^"]+)"/g)){nodes.set(m[1],new Element(m[1]));}}
    get innerHTML(){return this.html;}
    querySelector(selector){if(selector==='.documents')return get('documents');if(selector==='#card-content')return this.id==='sheet-card'?get('card-content'):null;if(selector==='button')return get('new');return null;}
    querySelectorAll(){return [];}
    setAttribute(name,value){this[name]=value;}
    addEventListener(){}
    focus(){document.activeElement=this;}
    contains(){return false;}
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
  for(const m of readFileSync(new URL('index.html',base),'utf8').matchAll(/id="([^"]+)"/g))get(m[1]);
  get('inspection').hidden=true;get('fatal').hidden=true;
  const document={getElementById:get,querySelectorAll:()=>[get('sheet-card'),get('sheet-register')],addEventListener:(name,fn)=>events.set(name,fn),hidden:false,activeElement:null};
  const window={addEventListener:(name,fn)=>events.set(name,fn)};window.parent=window;
  const storage=new Map();
  const renderer={portraits:Object.fromEntries(residents.map(r=>[r.id,'data:image/png;base64,test'])),show(){},center(){},pause(){},depart(){},flicker(){}};
  const context=vm.createContext({document,window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(brokenStorage)throw Error('QUOTA');storage.set(k,v);}},
    createScene:()=>renderer,createAudio:()=>({pause(){},resume(){},enabled(){},cue(){}}),residents,visits,PROTOTYPE_LIMIT,initialState,decide,validCheckpoint,structuredClone,console,
    IntersectionObserver:class{observe(){}},requestAnimationFrame:fn=>frames.push(fn)});
  vm.runInContext(readFileSync(new URL('main.mjs',base),'utf8').replace(/^import .+;$/gm,''),context);
  return {get,storage,events,click(id){assert.equal(get(id).disabled,false,`${id} should be enabled`);get(id).onclick();},
    state:()=>vm.runInContext('state',context),advance(seconds){for(let i=0;i<seconds*60;i++){clock+=1000/60;const batch=frames.splice(0);for(const fn of batch)fn(clock);}}};
}
function start(h){h.click('new');h.click('begin');assert.equal(h.get('allow').disabled,true);}
function inspectBoth(h){h.click('card');h.click('close-inspection');h.click('register');h.click('close-inspection');}

test('controller: documents gate first decision, retain selected entry, pause transition, and complete slice',()=>{
  const h=harness();start(h);h.click('card');h.click('close-inspection');assert.equal(h.get('allow').disabled,true);
  h.click('register');h.get('resident-select').onchange({target:{value:'teresa'}});h.click('look');h.click('card');
  assert.match(h.get('resident-select').innerHTML,/value="teresa" selected/);h.click('close-inspection');
  h.click('allow');assert.equal(h.get('allow').disabled,true);assert.equal(h.state().nextVisitIndex,1);
  h.click('pause');h.advance(5);assert.equal(h.storage.size,1);assert.equal(h.get('overlay').hidden,false);
  h.click('resume');h.advance(4);assert.match(h.get('dialogue').innerHTML,/Siódemka/);
  h.click('deny');h.advance(4);assert.match(h.get('panel').innerHTML,/Poprawne decyzje: 2\/2/);
  assert.equal(h.state().ending,'prototype');assert.equal(h.state().mistakes,0);
  const saved=JSON.parse([...h.storage.values()][0]);assert.equal(saved.ending,'prototype');
  h.click('menu');h.click('continue');assert.match(h.get('panel').innerHTML,/Poprawne decyzje: 2\/2/);
});
test('controller: error is counted once, terminal summary reveals only played visits, restart requires confirmation',()=>{
  const h=harness();start(h);inspectBoth(h);h.click('deny');assert.equal(h.state().mistakes,1);
  h.get('deny').onclick();assert.equal(h.state().mistakes,1);h.advance(4);
  h.click('allow');h.advance(4);assert.match(h.get('panel').innerHTML,/Poprawne decyzje: 0\/2/);
  assert.doesNotMatch(h.get('panel').innerHTML,/Paweł|Marta|Roman|Irena/);
  h.click('restart');assert.equal(h.state().mistakes,2);h.click('cancel-new');assert.equal(h.state().mistakes,2);
  h.click('new');h.click('confirm-new');assert.equal(h.state().mistakes,0);assert.equal(h.state().nextVisitIndex,0);
});
test('controller: storage failure is explicit and does not prevent local gameplay; focus loss pauses',()=>{
  const h=harness({brokenStorage:true});start(h);assert.match(h.get('save-status').textContent,/Nie udało się zapisać/);
  h.events.get('blur')();assert.equal(h.get('allow').disabled,true);assert.match(h.get('panel').innerHTML,/Chwila ciszy/);
  h.click('resume');inspectBoth(h);h.click('allow');h.advance(4);assert.equal(h.state().nextVisitIndex,1);
});
