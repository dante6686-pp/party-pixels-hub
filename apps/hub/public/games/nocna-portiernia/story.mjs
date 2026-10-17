// Presentation only. Correct decisions and checkpoint validation live in logic.mjs.
import { visits } from './scenario.mjs';
const event=(at,type,value)=>({at,type,value});
export function createTimeline(events,emit){
  const queue=events.map((e,i)=>({...e,order:i})).sort((a,b)=>a.at-b.at||a.order-b.order);
  let elapsed=0,next=0;
  return {advance(dt){elapsed+=Math.max(0,dt);while(next<queue.length&&queue[next].at<=elapsed+1e-8)emit(queue[next++]);},get elapsed(){return elapsed;}};
}
export function arrivalEvents(index){
  if(index===4)return [event(.85,'cue','tap'),event(1.15,'cue','tap')];
  if(index===5)return [event(.6,'gesture','look-entry')];
  if(index===6)return [event(0,'gesture','smile')];
  if(index===7)return [event(.2,'early-dialogue',`[Głos z ciemności] „${visits[7].dialog}”`),event(1.1,'gesture','reveal')];
  return [];
}
export function waitingEvents(index){
  if(index===2)return [event(1.8,'atmosphere','[Z klatki: trzy powolne kroki]'),event(1.8,'cue','step'),event(2.6,'cue','step'),event(3.4,'cue','step')];
  if(index===3)return [event(.1,'gesture','look-door')];
  if(index===5)return [event(2,'cue','handle'),event(2,'gesture','rattle'),event(2,'atmosphere','[Ktoś cicho naciska klamkę drzwi portierni]')];
  return [];
}
export function decisionSequence(index,allow,mistakes){
  const correct=allow===visits[index].allow;
  if(!correct)return {duration:3.4,events:[
    event(0,'dialogue',`Naruszenie procedury: ${mistakes}/3. ${index===0?'„Przecież tu mieszkam”.':allow?'Gość przechodzi na klatkę.':'Gość zabiera informacje i odchodzi.'}`),
    event(0,'cue','error'),event(0,'depart',allow),
    ...(mistakes===1?[event(2.5,'cue','pipe'),event(2.5,'atmosphere','[Pojedyncze uderzenie w rurę]')]:mistakes===2?[event(2.5,'cue','handle'),event(2.5,'gesture','rattle'),event(2.5,'atmosphere','[Klamka drzwi portierni porusza się]')]:[])
  ]};
  switch(index){
    case 0:return {duration:3.2,events:[event(0,'dialogue','Jan kiwa głową i przechodzi na klatkę.'),event(0,'gesture','nod'),event(.4,'depart',true),event(.5,'cue','door'),event(1.2,'cue','step'),event(1.9,'cue','step')]};
    case 1:return {duration:3.4,events:[event(0,'dialogue','Ogląda podane informacje. Wychodzi bez słowa.'),event(.3,'depart',false),event(2.7,'cue','crack'),event(2.7,'flicker',true),event(2.7,'atmosphere','[Pierwszy krótki trzask świetlówki]')]};
    case 2:return {duration:5,events:[event(0,'dialogue','„Proszę sprawdzić jeszcze raz”.'),event(2,'gesture','take-card'),event(2.2,'depart',false),event(3,'cue','step')]};
    case 3:return {duration:5,events:[event(0,'dialogue','Marta przechodzi na klatkę.'),event(.2,'depart',true),event(.3,'cue','door'),event(2.6,'cue','laugh'),event(2.6,'atmosphere','[Zza ściany: cichy śmiech]'),event(3.5,'cue','step'),event(4.1,'cue','step')]};
    case 4:return {duration:5.8,events:[event(0,'dialogue','Patrzy na przedstawione zdjęcie. „Stare”.'),event(.8,'gesture','hold-hand'),event(1.8,'gesture','take-card'),event(2.2,'depart',false),event(4.1,'cue','breath'),event(4.1,'atmosphere','[Domofon szumi. Słychać oddech]')]};
    case 5:return {duration:4.2,events:[event(0,'dialogue','„Dziękuję”.'),event(.2,'depart',true),event(.4,'cue','door'),event(1.8,'cue','step'),event(2.5,'cue','step'),event(3.1,'atmosphere','[Kroki urywają się po dwóch stopniach]')]};
    case 6:return {duration:5.2,events:[event(0,'gesture','still'),event(0,'dialogue','Przestaje się uśmiechać. „To gdzie mam teraz iść?”'),event(1.6,'depart',false),event(3.5,'cue','run'),event(3.5,'atmosphere','[Z klatki: szybki bieg w dół]')]};
    case 7:return {duration:6.6,events:[event(0,'gesture','still'),event(0,'dialogue','Stoi nieruchomo.'),event(3,'gesture','take-card'),event(3.4,'dialogue','[Własnym głosem] „Pan też tu nie mieszka”.'),event(4.2,'depart',false),event(5.8,'mood','vestibule-dark'),event(5.8,'atmosphere','[Światło przedsionka gaśnie]')]};
    default:throw Error('INVALID_VISIT');
  }
}
export function endingSequence(kind,lastDialog){
  if(kind==='survived')return {duration:6.4,events:[event(0,'dialogue','Cisza. Noc ustępuje porankowi.'),event(2,'clock','06:00'),event(2.2,'cue','key'),event(3.6,'dialogue','[Zmiennik] „Dobra, jestem. Możesz iść”.')]};
  if(kind==='failed')return {duration:7.2,events:[event(0,'dialogue','Naruszenie procedury: 3/3. Klamka opada.'),event(.3,'cue','handle'),event(.3,'gesture','rattle'),event(1.2,'atmosphere','[Światło gaśnie]'),event(2.2,'cue','intercom'),event(2.2,'dialogue',`[Szum domofonu. Powraca fragment ostatniej wypowiedzi] „${lastDialog.split(/[.!?]/)[0]}”`),event(4,'cue','creak'),event(4,'atmosphere','[Drzwi uchylają się. W szczelinie zarys twarzy]'),event(6.6,'blackout',true)]};
  throw Error('INVALID_ENDING');
}
