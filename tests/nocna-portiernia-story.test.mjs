import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimeline, arrivalEvents, waitingEvents, decisionSequence, endingSequence } from '../apps/hub/public/games/nocna-portiernia/story.mjs';
import { visits } from '../apps/hub/public/games/nocna-portiernia/scenario.mjs';

test('timeline emits simultaneous events in order exactly once, without wall-clock timers',()=>{
  const fired=[],t=createTimeline([{at:2,type:'last'},{at:0,type:'first'},{at:1,type:'a'},{at:1,type:'b'}],e=>fired.push(e.type));
  t.advance(0);assert.deepEqual(fired,['first']);t.advance(.9);assert.equal(fired.length,1);
  t.advance(.2);assert.deepEqual(fired,['first','a','b']);t.advance(10);t.advance(10);assert.deepEqual(fired,['first','a','b','last']);
});
test('each correct visit has its GDD consequence; wrong decisions override conflicting story reactions',()=>{
  const required=['Jan kiwa','bez słowa','sprawdzić jeszcze raz','Marta przechodzi','Stare','Dziękuję','gdzie mam','Pan też'];
  for(let i=0;i<8;i++){
    const right=decisionSequence(i,visits[i].allow,0);assert.ok(right.events.every(e=>e.at<right.duration));
    assert.ok(right.events.some(e=>e.type==='dialogue'&&e.value.includes(required[i])));
    for(let mistakes=1;mistakes<=3;mistakes++){
      const wrong=decisionSequence(i,!visits[i].allow,mistakes);
      assert.ok(wrong.events.some(e=>e.type==='dialogue'&&e.value.includes(`${mistakes}/3`)));
      assert.ok(!wrong.events.some(e=>['mood','flicker'].includes(e.type)));
      assert.ok(!wrong.events.some(e=>e.type==='dialogue'&&e.value.includes('Pan też')));
      assert.equal(wrong.events.filter(e=>e.type==='cue'&&e.value==='pipe').length,mistakes===1?1:0);
      assert.equal(wrong.events.filter(e=>e.type==='gesture'&&e.value==='rattle').length,mistakes===2?1:0);
    }
  }
});
test('the final refusal waits three seconds, Roman keeps a hand on the desk for one, and identity never changes',()=>{
  const last=decisionSequence(7,false,0);
  assert.equal(last.events.find(e=>e.value==='take-card').at,3);
  assert.ok(last.events.find(e=>e.type==='dialogue'&&e.value.includes('Pan też')).at>=3);
  const roman=decisionSequence(4,false,0);assert.equal(roman.events.find(e=>e.value==='take-card').at-roman.events.find(e=>e.value==='hold-hand').at,1);
  assert.equal(visits[7].guest,'roman');assert.equal(visits[7].card,'jan');
});
test('entrance and waiting cues do not invent new decision rules; failure is 6–8 seconds with caption fallback',()=>{
  assert.equal(arrivalEvents(4).filter(e=>e.type==='cue'&&e.value==='tap').length,2);
  assert.ok(arrivalEvents(7).find(e=>e.type==='early-dialogue').at<arrivalEvents(7).find(e=>e.value==='reveal').at);
  assert.equal(waitingEvents(2).filter(e=>e.type==='cue'&&e.value==='step').length,3);
  const failure=endingSequence('failed','Poprawiłem. Teraz się zgadza.');assert.ok(failure.duration>=6&&failure.duration<=8);
  assert.ok(failure.events.some(e=>e.type==='cue'&&e.value==='intercom'));
  assert.ok(failure.events.some(e=>e.type==='dialogue'&&e.value.includes('Poprawiłem')));
  const survival=endingSequence('survived','');assert.ok(survival.events.some(e=>e.type==='clock'&&e.value==='06:00'));
  assert.ok(survival.events.some(e=>e.type==='dialogue'&&e.value.includes('Możesz iść')));
});
