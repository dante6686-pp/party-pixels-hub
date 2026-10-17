import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, decide, validCheckpoint } from '../apps/hub/public/games/nocna-portiernia/logic.mjs';
import { visits, residents } from '../apps/hub/public/games/nocna-portiernia/scenario.mjs';

test('GDD: exactly one discrepancy category in each invalid visit; valid residents match all fields',()=>{
  assert.deepEqual(visits.map(v=>v.allow),[true,false,false,true,false,true,false,false]);
  for(const v of visits){
    const owner=residents.find(r=>r.id===v.card);
    // Name/flat checks anchor the actual card identity; #5 uses Roman's name with Jan's image.
    const record=residents.find(r=>r.id===v.guest);
    const errors=[v.name!==record.name,v.flat!==record.flat,v.card!==v.guest];
    if(v===visits[7]){assert.equal(v.name,owner.name);assert.equal(v.flat,owner.flat);assert.notEqual(v.guest,v.card);}
    else assert.equal(errors.filter(Boolean).length,v.allow?0:1);
  }
});
test('eight correct decisions survive; prototype ends distinctly after two visits',()=>{
  let full=initialState(8);for(let i=0;i<8;i++)full=decide(full,i,visits[i].allow);
  assert.equal(full.ending,'survived');assert.equal(full.mistakes,0);assert.ok(validCheckpoint(full));
  let slice=initialState();slice=decide(decide(slice,0,true),1,false);
  assert.equal(slice.ending,'prototype');assert.equal(slice.nextVisitIndex,2);assert.ok(validCheckpoint(slice,2));
});
test('third mistake immediately terminates, including the eighth visitor',()=>{
  for(const errors of [[0,1,2],[0,6,7]]){
    let state=initialState(8);
    for(let i=0;i<8&&!state.ending;i++)state=decide(state,i,errors.includes(i)?!visits[i].allow:visits[i].allow);
    assert.equal(state.ending,'failed');assert.equal(state.mistakes,3);
    assert.equal(state.nextVisitIndex,errors[2]+1);
    assert.equal(decide(state,state.nextVisitIndex,true),state);
  }
});
test('at most two errors survives all eight visits; duplicate and stale decisions do nothing',()=>{
  let state=initialState(8);state=decide(state,0,false);
  assert.equal(decide(state,0,false),state);assert.equal(decide(state,1,'yes'),state);
  for(let i=1;i<8;i++)state=decide(state,i,i===7?!visits[i].allow:visits[i].allow);
  assert.equal(state.ending,'survived');assert.equal(state.mistakes,2);
});
test('checkpoint rejects tampering, obsolete version and continuation after third error',()=>{
  const initial=initialState();assert.ok(validCheckpoint(initial,2));
  for(const data of [null,[],{}, {...initial,scenarioVersion:'old'},{...initial,mistakes:1},{...initial,nextVisitIndex:1},{...initial,ending:'survived'},{...initial,token:'extra'},{...initial,decisions:[1]}])assert.equal(validCheckpoint(data,2),false);
  let state=initialState(8);for(let i=0;i<3;i++)state=decide(state,i,!visits[i].allow);
  assert.equal(validCheckpoint({...state,decisions:[...state.decisions,true],nextVisitIndex:4}),false);
  assert.equal(validCheckpoint(initialState(8),2),false);
});
test('restored checkpoints produce same next visit and terminal result; initial state is not shared',()=>{
  const a=decide(initialState(),0,true),b=JSON.parse(JSON.stringify(a));
  assert.ok(validCheckpoint(b,2));assert.deepEqual(decide(a,1,false),decide(b,1,false));
  assert.equal(initialState().decisions.length,0);
});
