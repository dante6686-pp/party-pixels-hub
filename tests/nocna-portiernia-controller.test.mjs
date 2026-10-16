// Controller integration with DOM/audio/renderer doubles, NOT browser/WebGL/touch tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { initialState, decide, validCheckpoint } from '../apps/hub/public/games/nocna-portiernia/logic.mjs';
import { visits, residents, PROTOTYPE_LIMIT } from '../apps/hub/public/games/nocna-portiernia/scenario.mjs';
import { requestDefaultFullscreen } from '../apps/hub/public/games/nocna-portiernia/fullscreen.mjs';
const base=new URL('../apps/hub/public/games/nocna-portiernia/',import.meta.url);

function harness({brokenStorage=false,reducedMotion=false}={}){
  const nodes=new Map(),events=new Map(),frames=[];let clock=0,intersection;
  class Element {
    constructor(id){this.id=id;this.hidden=false;this.disabled=false;this.textContent='';this.dataset={};this.html='';this.scrollHeight=20;this.clientHeight=20;this.classList={toggle(){}};this.listeners=new Map();}
    set innerHTML(value){this.html=value;for(const m of value.matchAll(/id="([^"]+)"/g))nodes.set(m[1],new Element(m[1]));}
    get innerHTML(){return this.html;}
    querySelector(selector){if(selector==='button')return get('new');return null;}
    querySelectorAll(){return [];}
    setAttribute(name,value){this[name]=value;}
    addEventListener(name,fn){this.listeners.set(name,fn);}
    focus(){document.activeElement=this;}
    contains(){return false;}
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
  for(const m of readFileSync(new URL('index.html',base),'utf8').matchAll(/id="([^"]+)"/g))get(m[1]);
  get('inspection').hidden=true;get('fatal').hidden=true;
  const document={getElementById:get,querySelectorAll:()=>[],addEventListener:(name,fn)=>events.set(name,fn),hidden:false,activeElement:null};
  const window={addEventListener:(name,fn)=>events.set(name,fn),matchMedia:()=>({matches:reducedMotion,addEventListener:(name,fn)=>events.set('motion-preference',fn)})};window.parent=window;
  const storage=new Map();const pauses=[],swaySettings=[],reading=[];
  const renderer={portraits:Object.fromEntries(residents.map(r=>[r.id,'data:image/png;base64,test'])),setSwayEnabled(value){swaySettings.push(value);},setReading(value){reading.push(value);},show(){},center(){},pause(value){pauses.push(value);},depart(){},flicker(){},rattle(){}};
  const context=vm.createContext({document,window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(brokenStorage)throw Error('QUOTA');storage.set(k,v);}},
    createScene:()=>renderer,createAudio:()=>({pause(){},resume(){},enabled(){},cue(){}}),residents,visits,PROTOTYPE_LIMIT,initialState,decide,validCheckpoint,requestDefaultFullscreen,structuredClone,console,
    IntersectionObserver:class{constructor(fn){intersection=fn;}observe(){}unobserve(){}},requestAnimationFrame:fn=>frames.push(fn)});
  vm.runInContext(readFileSync(new URL('main.mjs',base),'utf8').replace(/^import .+;$/gm,''),context);
  return {get,storage,events,pauses,swaySettings,reading,click(id){assert.equal(get(id).disabled,false,`${id} should be enabled`);get(id).onclick();},
    visible(kind,ratio=1){intersection([{target:get(`${kind==='card'?'card':'resident'}-content`),isIntersecting:ratio>0,intersectionRatio:ratio}]);},
    photo(){vm.runInContext('portrait("jan")',context);},state:()=>vm.runInContext('state',context),
    advance(seconds){for(let i=0;i<seconds*60;i++){clock+=1000/60;const batch=frames.splice(0);for(const fn of batch)fn(clock);}}};
}
function start(h){h.click('new');h.click('begin');h.advance(3.6);assert.equal(h.get('allow').disabled,true);assert.equal(h.get('inspection').hidden,false);}
function inspectBoth(h){h.visible('card');h.click('register');h.get('resident-select').onchange({target:{value:'jan'}});h.visible('register');}

test('controller: opening hidden register does not count as viewing; actual comparison permits decisions without closing',()=>{
  const h=harness();start(h);h.visible('card');h.click('register');assert.equal(h.get('allow').disabled,true);
  h.visible('register');assert.equal(h.get('allow').disabled,true);
  assert.match(h.get('resident-content').innerHTML,/Nie wybrano lokatora/);assert.doesNotMatch(h.get('resident-content').innerHTML,/Jan|img/);
  h.get('resident-select').onchange({target:{value:'jan'}});h.visible('register',.4);assert.equal(h.get('allow').disabled,true);h.visible('register');assert.equal(h.get('allow').disabled,false);
  assert.equal(h.get('inspection').hidden,false);assert.equal(h.pauses.at(-1),false);
  h.click('allow');assert.equal(h.state().nextVisitIndex,1);h.get('allow').onclick();assert.equal(h.state().nextVisitIndex,1);
  h.click('pause');h.advance(5);assert.equal(h.get('overlay').hidden,false);
  h.click('resume');h.advance(7);assert.match(h.get('dialog-copy').textContent,/Siódemka/);assert.match(h.get('resident-content').innerHTML,/Nie wybrano lokatora/);assert.match(h.get('resident-select').innerHTML,/value="" selected/);
  h.click('deny');h.advance(7);assert.match(h.get('panel').innerHTML,/Poprawne decyzje: 2\/2/);
  assert.equal(JSON.parse([...h.storage.values()][0]).ending,'prototype');h.click('menu');h.click('continue');h.advance(3.6);assert.match(h.get('panel').innerHTML,/Poprawne decyzje: 2\/2/);
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
  const h=harness();start(h);inspectBoth(h);h.click('deny');h.get('deny').onclick();assert.equal(h.state().mistakes,1);h.advance(7);
  h.click('allow');h.advance(7);assert.match(h.get('panel').innerHTML,/Poprawne decyzje: 0\/2/);assert.doesNotMatch(h.get('panel').innerHTML,/Paweł|Marta|Roman|Irena/);
  h.click('restart');assert.equal(h.state().mistakes,2);h.click('cancel-new');h.click('new');h.click('confirm-new');assert.equal(h.state().mistakes,0);
});
test('controller: successful save notice expires; errors persist in HUD and pause; focus loss pauses',()=>{
  const ok=harness();start(ok);ok.advance(3);assert.equal(ok.get('save-status').hidden,true);
  const h=harness({brokenStorage:true});start(h);h.advance(5);assert.equal(h.get('save-status').hidden,false);assert.match(h.get('save-status').textContent,/Błąd zapisu/);
  h.events.get('blur')();assert.match(h.get('panel').innerHTML,/Błąd zapisu/);h.click('resume');inspectBoth(h);h.click('allow');h.advance(7);assert.equal(h.state().nextVisitIndex,1);
});

test('controller: selection resets on checkpoint resume and new shift; modals cannot count empty or hidden register',()=>{
  const h=harness();start(h);inspectBoth(h);h.click('allow');h.advance(7);
  h.click('register');h.get('resident-select').onchange({target:{value:'teresa'}});h.click('pause');h.click('menu');h.click('continue');h.advance(3.6);
  assert.match(h.get('resident-content').innerHTML,/Nie wybrano lokatora/);assert.match(h.get('resident-select').innerHTML,/value="" selected/);
  assert.equal(h.get('allow').disabled,false); // No additional selection gate after the tutorial.
  h.click('pause');h.click('menu');h.click('new');h.click('confirm-new');h.click('begin');h.advance(3.6);h.visible('card');h.click('register');
  h.get('resident-select').onchange({target:{value:'jan'}});h.photo();h.visible('register');h.click('back-photo');assert.equal(h.get('allow').disabled,true);
  h.visible('register');assert.equal(h.get('allow').disabled,false);
});
test('controller: reduced motion disables sway by default; reading dampens it and manual settings prevail',()=>{
  const h=harness({reducedMotion:true});assert.equal(h.swaySettings.at(-1),false);
  h.get('sway').listeners.get('change')({target:{checked:true}});assert.equal(h.swaySettings.at(-1),true);
  h.events.get('motion-preference')({matches:true});assert.equal(h.swaySettings.at(-1),true);
  start(h);assert.equal(h.reading.at(-1),'documents');h.click('look');assert.equal(h.reading.at(-1),false);
  h.photo();assert.equal(h.reading.at(-1),'modal');h.click('back-photo');h.click('pause');
  h.get('sway').listeners.get('change')({target:{checked:false}});assert.equal(h.swaySettings.at(-1),false);
});

test('controller: first guest reveals UI and dialogue only after approach, then information after a separate delay and fade',()=>{
  const h=harness();h.click('new');h.click('begin');
  assert.equal(h.get('game').dataset.uiVisible,'false');assert.equal(h.get('dialog-copy').textContent,'');assert.equal(h.get('card-content').innerHTML,'');
  h.advance(1);assert.equal(h.get('game').dataset.uiVisible,'false');h.advance(.5);
  assert.equal(h.get('game').dataset.uiVisible,'true');assert.equal(h.get('game').dataset.dialogueVisible,'true');assert.match(h.get('dialog-copy').textContent,/Wrona/);
  assert.equal(h.get('game').dataset.infoVisible,'false');assert.equal(h.get('allow').disabled,true);
  h.advance(.7);assert.equal(h.get('game').dataset.infoVisible,'false');h.advance(.2);
  assert.equal(h.get('game').dataset.infoVisible,'true');assert.match(h.get('card-content').innerHTML,/Jan Wrona/);
  h.visible('card');assert.equal(h.get('allow').disabled,true);h.advance(1.2);
  h.click('register');h.get('resident-select').onchange({target:{value:'jan'}});h.visible('register');assert.equal(h.get('allow').disabled,true);
  h.visible('card');assert.equal(h.get('allow').disabled,false);
});
test('controller: UI stays between guests, reveal timers freeze on pause, and leaving cancels pending presentation',()=>{
  const h=harness();start(h);inspectBoth(h);h.click('allow');h.advance(2.9);
  assert.equal(h.get('game').dataset.uiVisible,'true');assert.equal(h.get('game').dataset.dialogueVisible,'false');assert.equal(h.get('card-content').innerHTML,'');
  h.events.get('blur')();h.advance(10);assert.equal(h.get('game').dataset.infoVisible,'false');
  h.click('resume');h.advance(3.6);assert.match(h.get('dialog-copy').textContent,/Siódemka/);assert.equal(h.get('game').dataset.infoVisible,'true');
  h.click('pause');h.click('menu');h.click('continue');h.advance(.2);h.events.get('blur')();h.click('menu');h.advance(10);
  assert.equal(h.get('game').dataset.uiVisible,'false');assert.equal(h.get('game').dataset.infoVisible,'false');
});
