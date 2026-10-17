// Controller integration with DOM/audio/renderer doubles, NOT browser/WebGL/touch tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { initialState, decide, validCheckpoint, upgradePrototypeCheckpoint } from '../apps/hub/public/games/nocna-portiernia/logic.mjs';
import { visits, residents, PROTOTYPE_LIMIT, GAME_LIMIT } from '../apps/hub/public/games/nocna-portiernia/scenario.mjs';
import { createTimeline, arrivalEvents, waitingEvents, decisionSequence, endingSequence } from '../apps/hub/public/games/nocna-portiernia/story.mjs';
import { requestDefaultFullscreen } from '../apps/hub/public/games/nocna-portiernia/fullscreen.mjs';
const base=new URL('../apps/hub/public/games/nocna-portiernia/',import.meta.url);

function harness({brokenStorage=false,reducedMotion=false,checkpoint=null,legacy=null}={}){
  const nodes=new Map(),events=new Map(),frames=[];let clock=0;const intersections=[];let cardStep=280,centers=0;
  class Element {
    constructor(id){this.id=id;this.hidden=false;this.disabled=false;this.textContent='';this.dataset={};this.html='';this.scrollLeft=0;this.clientWidth=300;this.scrollWidth=1800;this.scrollHeight=20;this.clientHeight=20;this.classList={toggle(){}};this.listeners=new Map();}
    set innerHTML(value){this.html=value;for(const m of value.matchAll(/id="([^"]+)"/g))nodes.set(m[1],new Element(m[1]));}
    get innerHTML(){return this.html;}
    querySelector(selector){if(selector==='button')return get('new');return null;}
    querySelectorAll(){return [];}
    setAttribute(name,value){this[name]=value;}
    addEventListener(name,fn){this.listeners.set(name,fn);}
    focus(){document.activeElement=this;}
    contains(){return false;}
    scrollTo({left}){this.scrollLeft=left;}
    setPointerCapture(){}
    get offsetLeft(){const i=residents.findIndex(r=>this.id==='resident-'+r.id);return Math.max(0,i)*cardStep;}
  }
  const get=id=>nodes.get(id)??null;
  for(const m of readFileSync(new URL('index.html',base),'utf8').matchAll(/id="([^"]+)"/g))nodes.set(m[1],new Element(m[1]));
  get('inspection').hidden=true;get('fatal').hidden=true;
  const document={getElementById:get,querySelectorAll:()=>[],addEventListener:(name,fn)=>events.set(name,fn),hidden:false,activeElement:null};
  const window={addEventListener:(name,fn)=>events.set(name,fn),matchMedia:()=>({matches:reducedMotion,addEventListener:(name,fn)=>events.set('motion-preference',fn)})};window.parent=window;
  const storage=new Map();if(checkpoint)storage.set('pp:nocna-portiernia:guest:v1',JSON.stringify(checkpoint));if(legacy)storage.set('pp:nocna-portiernia:prototype-a:guest:v1',JSON.stringify(legacy));const pauses=[],swaySettings=[],reading=[],cues=[],poses=[],cinematics=[];
  const renderer={portraits:Object.fromEntries(residents.map(r=>[r.id,'data:image/png;base64,test'])),setSwayEnabled(value){swaySettings.push(value);},setReading(value){reading.push(value);},show(){},center(){centers++;},pause(value){pauses.push(value);},depart(){},flicker(){},rattle(){},violations(){},gesture(value){poses.push(value);},mood(){},cinematic(kind,time){cinematics.push({kind,time});}};
  const context=vm.createContext({document,window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(brokenStorage)throw Error('QUOTA');storage.set(k,v);}},
    createScene:()=>renderer,createAudio:()=>({pause(){},resume(){},enabled(){},stopEffects(){},ambience(){},cue(kind){cues.push(kind);}}),residents,visits,PROTOTYPE_LIMIT,GAME_LIMIT,initialState,decide,validCheckpoint,upgradePrototypeCheckpoint,createTimeline,arrivalEvents,waitingEvents,decisionSequence,endingSequence,requestDefaultFullscreen,structuredClone,console,
    IntersectionObserver:class{constructor(fn){intersections.push(fn);}observe(){}unobserve(){}},requestAnimationFrame:fn=>frames.push(fn)});
  vm.runInContext(readFileSync(new URL('main.mjs',base),'utf8').replace(/^import .+;$/gm,''),context);
  return {get,storage,events,pauses,swaySettings,reading,cues,poses,cinematics,phase:()=>vm.runInContext('phase',context),click(id){assert.equal(get(id).disabled,false,`${id} should be enabled`);get(id).onclick();},
    visible(kind,ratio=1){intersections[kind==='card'?0:1]([{target:get(kind==='card'?'card-content':'resident-jan'),isIntersecting:ratio>0,intersectionRatio:ratio}]);},
    centers:()=>centers,resizeCards(step){cardStep=step;events.get('resize')();},state:()=>vm.runInContext('state',context),
    advance(seconds){for(let i=0;i<seconds*60;i++){clock+=1000/60;const batch=frames.splice(0);for(const fn of batch)fn(clock);}}};
}
function start(h){h.click('new');h.click('begin');h.advance(3.6);assert.equal(h.get('allow').disabled,true);assert.equal(h.get('inspection').hidden,false);}
function inspectBoth(h){h.visible('card');h.visible('register');}

test('controller: errors count once, summary contains only played visits, restart requires confirmation',()=>{
  const h=harness();start(h);inspectBoth(h);h.click('deny');h.get('deny').onclick();assert.equal(h.state().mistakes,1);h.advance(7);
  h.click('allow');h.advance(7);h.click('allow');h.advance(12);assert.match(h.get('panel').innerHTML,/Poprawne decyzje: 0\/3/);assert.doesNotMatch(h.get('panel').innerHTML,/Marta|Roman|Irena/);
  h.click('restart');assert.equal(h.state().mistakes,3);h.click('cancel-new');h.click('new');h.click('confirm-new');assert.equal(h.state().mistakes,0);
});
test('controller: successful save notice expires; errors persist in HUD and pause; focus loss pauses',()=>{
  const ok=harness();start(ok);ok.advance(3);assert.equal(ok.get('save-status').hidden,true);
  const h=harness({brokenStorage:true});start(h);h.advance(5);assert.equal(h.get('save-status').hidden,false);assert.match(h.get('save-status').textContent,/Błąd zapisu/);
  h.events.get('blur')();assert.match(h.get('panel').innerHTML,/Błąd zapisu/);h.click('resume');inspectBoth(h);h.click('allow');h.advance(7);assert.equal(h.state().nextVisitIndex,1);
});

test('controller: reduced motion disables sway by default; reading dampens it and manual settings prevail',()=>{
  const h=harness({reducedMotion:true});assert.equal(h.swaySettings.at(-1),false);
  h.get('sway').listeners.get('change')({target:{checked:true}});assert.equal(h.swaySettings.at(-1),true);
  h.events.get('motion-preference')({matches:true});assert.equal(h.swaySettings.at(-1),true);
  start(h);assert.equal(h.reading.at(-1),'documents');
  h.click('instructions');assert.equal(h.reading.at(-1),'modal');h.click('back-rules');h.click('pause');
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
  h.visible('register');assert.equal(h.get('allow').disabled,true);
  h.visible('card');assert.equal(h.get('allow').disabled,false);
});
test('controller: UI stays between guests, reveal timers freeze on pause, and leaving cancels pending presentation',()=>{
  const h=harness();start(h);inspectBoth(h);h.click('allow');h.advance(3.4);
  assert.equal(h.get('game').dataset.uiVisible,'true');assert.equal(h.get('game').dataset.dialogueVisible,'false');assert.equal(h.get('card-content').innerHTML,'');
  h.events.get('blur')();h.advance(10);assert.equal(h.get('game').dataset.infoVisible,'false');
  h.click('resume');h.advance(3.6);assert.match(h.get('dialog-copy').textContent,/Siódemka/);assert.equal(h.get('game').dataset.infoVisible,'true');
  h.click('pause');h.click('menu');h.click('continue');h.advance(.2);h.events.get('blur')();h.click('menu');h.advance(10);
  assert.equal(h.get('game').dataset.uiVisible,'false');assert.equal(h.get('game').dataset.infoVisible,'false');
});

test('controller: six cards need no selection; first decision requires visible information and a card',()=>{
  const h=harness();start(h);
  for(const r of residents)assert.match(h.get('resident-carousel').innerHTML,new RegExp(r.name));
  assert.equal((h.get('resident-carousel').innerHTML.match(/class="paper resident-card"/g)||[]).length,6);
  h.visible('card');h.visible('register',.4);assert.equal(h.get('allow').disabled,true);
  h.visible('register');assert.equal(h.get('allow').disabled,false);
  h.get('resident-carousel').scrollLeft=450;
  h.click('allow');h.get('allow').onclick();assert.equal(h.state().nextVisitIndex,1);
  h.click('pause');h.advance(5);h.click('resume');h.advance(7);
  assert.equal(h.get('resident-carousel').scrollLeft,450);
  assert.match(h.get('card-content').innerHTML,/Teresa Mazur/);assert.match(h.get('card-content').innerHTML,/>17</);
  assert.match(h.get('resident-carousel').innerHTML,/Mieszkanie <span class="flat">7</);
  h.click('deny');h.advance(7);for(let i=2;i<8;i++){h.click(visits[i].allow?'allow':'deny');h.advance(14);}assert.match(h.get('panel').innerHTML,/Poprawne decyzje: 8\/8/);
  assert.equal(JSON.parse([...h.storage.values()][0]).ending,'survived');h.click('menu');h.click('continue');assert.match(h.get('panel').innerHTML,/Poprawne decyzje: 8\/8/);
});
test('controller: mouse and keyboard scroll; touch is native; modal blocks decisions; pause retains position',()=>{
  const h=harness();start(h);inspectBoth(h);const c=h.get('resident-carousel'),emit=(name,e)=>c.listeners.get(name)({stopPropagation(){},...e});
  emit('pointerdown',{pointerType:'touch',button:0,pointerId:1,clientX:250});emit('pointermove',{pointerId:1,clientX:20});assert.equal(c.scrollLeft,0);
  emit('pointerdown',{pointerType:'mouse',button:0,pointerId:2,clientX:250});emit('pointermove',{pointerId:2,clientX:50});assert.equal(c.scrollLeft,200);emit('pointerup',{});
  emit('pointermove',{pointerId:2,clientX:0});assert.equal(c.scrollLeft,280);
  emit('keydown',{key:'ArrowRight',preventDefault(){}});assert.equal(c.scrollLeft,560);
  h.click('instructions');assert.equal(h.get('allow').disabled,true);h.get('allow').onclick();assert.equal(h.state().nextVisitIndex,0);
  h.click('back-rules');h.events.get('resize')();h.advance(.1);assert.equal(c.scrollLeft,560);
  h.events.get('keydown')({key:'Escape',preventDefault(){}});assert.match(h.get('panel').innerHTML,/Chwila ciszy/);h.click('resume');assert.equal(c.scrollLeft,560);
});
test('controller: viewing a card behind a modal cannot unlock the first decision',()=>{
  const h=harness();start(h);h.visible('card');h.click('instructions');h.visible('register');h.click('back-rules');assert.equal(h.get('allow').disabled,true);
  h.visible('register');assert.equal(h.get('allow').disabled,false);
});


test('controller: counter follows manual swipe and resize retains the same resident; centering is independent',()=>{
  const h=harness();start(h);const c=h.get('resident-carousel'),baseline=h.centers();
  c.scrollLeft=840;c.listeners.get('scroll')();assert.equal(h.get('carousel-position').textContent,'4 / 6');
  h.resizeCards(350);h.advance(.1);assert.equal(c.scrollLeft,1050);assert.equal(h.get('carousel-position').textContent,'4 / 6');
  assert.equal(h.centers(),baseline);h.click('center-view');assert.equal(h.centers(),baseline+1);
  assert.equal(c.scrollLeft,1050);assert.equal(h.state().nextVisitIndex,0);
  h.click('pause');h.click('resume');assert.equal(c.scrollLeft,1050);
});

test('controller: keyboard ends at the first/last full card and cannot leave the deck',()=>{
  const h=harness();start(h);const c=h.get('resident-carousel');
  const key=k=>c.listeners.get('keydown')({key:k,preventDefault(){},stopPropagation(){}});
  key('End');assert.equal(c.scrollLeft,1400);assert.equal(h.get('carousel-position').textContent,'6 / 6');
  key('ArrowRight');assert.equal(c.scrollLeft,1400);key('Home');key('ArrowLeft');assert.equal(c.scrollLeft,0);
  assert.equal(h.get('carousel-position').textContent,'1 / 6');assert.equal(h.state().nextVisitIndex,0);
});


test('full game: failure cinematic pauses, cannot double-count and terminal continue opens the result',()=>{
  const h=harness();start(h);inspectBoth(h);
  for(let i=0;i<2;i++){h.click(visits[i].allow?'deny':'allow');h.advance(8);}
  h.click('allow');h.get('allow').onclick();assert.equal(h.state().mistakes,3);h.advance(3.8);
  assert.equal(h.phase(),'cinematic');const count=h.cues.length,last=h.cinematics.at(-1).time;
  h.events.get('blur')();h.advance(20);assert.equal(h.phase(),'cinematic');assert.equal(h.cues.length,count);assert.equal(h.cinematics.at(-1).time,last);
  h.click('resume');h.advance(8);assert.equal(h.phase(),'summary');assert.match(h.get('panel').innerHTML,/Zmiana przerwana/);
  assert.match(h.get('panel').innerHTML,/0\/3/);assert.doesNotMatch(h.get('panel').innerHTML,/Wizyta 4|Marta Kurek|Irena Wilk/);
  h.click('menu');const before=h.cinematics.length;h.click('continue');assert.equal(h.phase(),'summary');assert.equal(h.cinematics.length,before);
});

test('full game: zero, one or two mistakes finish at 06:00; a third mistake on visit eight fails',()=>{
  for(const errors of [[],[0],[0,6],[0,6,7]]){
    const h=harness();start(h);inspectBoth(h);
    for(let i=0;i<8;i++){h.click((errors.includes(i)?!visits[i].allow:visits[i].allow)?'allow':'deny');h.advance(14);}
    assert.equal(h.phase(),'summary');assert.equal(h.state().mistakes,errors.length);
    assert.equal(h.state().ending,errors.length===3?'failed':'survived');
    assert.match(h.get('panel').innerHTML,errors.length===3?/Zmiana przerwana/:/Koniec zmiany/);
    assert.equal(h.get('clock').textContent,errors.length===3?'03:00':'06:00');
    assert.equal(h.get('panel').innerHTML.includes('Bez naruszeń'),errors.length===0);
  }
});

test('full game: migrating demo retains decisions, resumes visit three and leaves the original slot untouched',()=>{
  const legacy=decide(decide(initialState(2),0,true),1,false),h=harness({legacy});
  assert.match(h.get('panel').innerHTML,/Zapis dema/);h.click('continue');h.advance(3.6);
  assert.equal(h.state().limit,8);assert.equal(h.state().nextVisitIndex,2);assert.equal(h.get('visit').textContent,'Wizyta 3/8');
  assert.match(h.get('card-content').innerHTML,/Paweł Lipiński/);assert.equal(h.get('allow').disabled,false);
  assert.deepEqual(JSON.parse(h.storage.get('pp:nocna-portiernia:prototype-a:guest:v1')),legacy);
  assert.equal(JSON.parse(h.storage.get('pp:nocna-portiernia:guest:v1')).ending,null);
});

test('full game: visit eight speaks before appearance; pause freezes its three-second refusal',()=>{
  let checkpoint=initialState(8);for(let i=0;i<7;i++)checkpoint=decide(checkpoint,i,visits[i].allow);
  const h=harness({checkpoint});h.click('continue');h.advance(.4);assert.match(h.get('dialog-copy').textContent,/Głos z ciemności/);assert.ok(!h.poses.includes('reveal'));
  h.advance(3.2);assert.ok(h.poses.includes('reveal'));h.click('deny');h.advance(2);assert.equal(h.get('dialog-copy').textContent,'Stoi nieruchomo.');
  h.click('pause');h.advance(10);h.click('resume');h.advance(1.6);assert.match(h.get('dialog-copy').textContent,/Pan też tu nie mieszka/);
  h.advance(10);assert.equal(h.state().ending,'survived');assert.equal(h.phase(),'summary');
});
