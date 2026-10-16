import { createScene } from './scene.mjs';
import { residents, visits, PROTOTYPE_LIMIT } from './scenario.mjs';
import { initialState, decide, validCheckpoint } from './logic.mjs';
import { createAudio } from './audio.mjs';
import { requestDefaultFullscreen } from './fullscreen.mjs';

const $=id=>document.getElementById(id),KEY='pp:nocna-portiernia:prototype-a:guest:v1';
const audio=createAudio();let scene;
let state=initialState(),saved=null,phase='menu',paused=false,selected='jan',seen={card:false,register:false},overlayKind='menu',transition=null;
let sound=true,flashes=false,inspectionOpen=false,panelMode='card',currentDialogue='',saveError='',saveTTL=0,hintTTL=9,fullscreenExited=false;
function fatal(message){audio.pause();scene?.pause(true);$('fatal').hidden=false;if(message)$('fatal-detail').textContent=message;}
try{scene=createScene($('scene'),inspect,()=>fatal('Utracono dostęp do grafiki 3D. Odśwież grę. Ostatni zakończony fragment pozostaje w lokalnym zapisie.'));}catch(error){fatal();console.error('Nocna portiernia: renderer unavailable',error);}

function saveNotice(message,error=false){saveError=error?message:'';saveTTL=error?0:2.7;$('save-status').textContent=message;$('save-status').hidden=false;$('save-status').classList.toggle('error',error);}
function load(){
  try{const raw=localStorage.getItem(KEY);if(!raw)return null;const data=JSON.parse(raw);if(!validCheckpoint(data,PROTOTYPE_LIMIT))throw Error('INVALID_SAVE');return data;}
  catch{saveNotice('Zapis niedostępny lub niezgodny. Możesz zacząć od nowa.',true);return null;}
}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(state));saved=structuredClone(state);saveNotice('Zapisano lokalnie');}
  catch{saveNotice('Błąd zapisu. Graj dalej, ale nie zamykaj karty.',true);}
}
saved=load();
function modal(html,kind){$('panel').innerHTML=html;$('overlay').hidden=false;overlayKind=kind;hud();requestAnimationFrame(()=>$('panel').querySelector('button')?.focus());}
function hideModal(){$('overlay').hidden=true;overlayKind=null;hud();refreshVisibility();}
function settings(){return `<div class="settings"><label><input id="sound" type="checkbox" ${sound?'checked':''}>Dźwięk</label><label><input id="flashes" type="checkbox" ${flashes?'checked':''}>Migotanie światła</label></div>`;}
function wireSettings(){
  $('sound')?.addEventListener('change',e=>{sound=e.target.checked;audio.enabled(sound);if(!paused&&phase==='playing'&&sound)audio.resume();});
  $('flashes')?.addEventListener('change',e=>{flashes=e.target.checked;});
}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else {fullscreenExited=false;const result=await requestDefaultFullscreen(document);if(['unsupported','denied'].includes(result)&&$('screen-note'))$('screen-note').textContent='Pełny ekran niedostępny. Gra działa w całym oknie.';}}catch{}}
function startFullscreen(){if(fullscreenExited)return;void requestDefaultFullscreen(document).then(result=>{if(result==='unsupported'||result==='denied')$('input-hint').textContent='Pełny ekran niedostępny · gra działa w całym oknie.';});}
function menu(){
  phase='menu';paused=false;transition=null;scene?.pause(true);audio.pause();$('controls').hidden=true;$('inspection').hidden=true;inspectionOpen=false;
  modal(`<span class="eyebrow">PARTY PIXELS · PROTOTYP A</span><h1>Nocna<br>portiernia</h1><p>03:00. Jesionowa 12.<br>Sprawdź, kto naprawdę tu mieszka.</p><div class="stack">${saved?'<button id="continue" class="primary">Kontynuuj zapis</button>':''}<button id="new" class="${saved?'secondary':'primary'}">Nowa zmiana</button><button id="fullscreen" class="secondary">Pełny ekran</button></div>${settings()}<p id="screen-note" class="tiny">Dwie pierwsze wizyty. Lokalny zapis gościa.${saveError?' '+saveError:''}</p>`, 'menu');
  $('new').onclick=()=>{if(saved)confirmNew();else {startFullscreen();intro();}};
  if($('continue'))$('continue').onclick=()=>{startFullscreen();state=structuredClone(saved);if(state.ending)summary();else beginVisit();};
  $('fullscreen').onclick=fullscreen;wireSettings();
}
function confirmNew(){modal('<span class="eyebrow">NOWA ZMIANA</span><h2>Zacząć od początku?</h2><p>Poprzedni lokalny zapis tego prototypu zostanie zastąpiony.</p><div class="stack"><button id="confirm-new" class="primary">Rozpocznij nową zmianę</button><button id="cancel-new">Zachowaj zapis</button></div>','confirm');$('confirm-new').onclick=()=>{startFullscreen();intro();};$('cancel-new').onclick=menu;}
function intro(){
  state=initialState();save();phase='intro';audio.resume();
  modal('<span class="eyebrow">WIADOMOŚĆ POPRZEDNIKA · JESIONOWA 12</span><h2>Po trzeciej<br>tylko lokatorzy.</h2><blockquote>„Porównaj nazwisko, mieszkanie i twarz. Spis jest aktualny. Zmiennik przyjdzie rano”.</blockquote><p>Karta pojawi się na biurku. Wybierz „Porównaj ze spisem”, a potem samodzielnie odszukaj lokatora. Nie musisz się spieszyć.</p><button id="begin" class="primary">Odkładam wiadomość</button>','intro');
  $('begin').onclick=beginVisit;
}
function syncScene(){scene?.pause(paused||!['playing','transition'].includes(phase));}
function setDialogue(text){currentDialogue=text;$('dialog-copy').textContent=text;measureDialogue();}
function measureDialogue(){requestAnimationFrame(()=>{$('dialog-expand').hidden=$('dialog-copy').scrollHeight<=$('dialog-copy').clientHeight+1;});}
function beginVisit(){
  if(!scene)return;phase='playing';paused=false;transition=null;seen={card:false,register:false};inspectionOpen=false;hideModal();$('controls').hidden=false;
  scene.show(visits[state.nextVisitIndex].guest);scene.center();syncScene();audio.resume();audio.cue('step');
  setDialogue(`„${visits[state.nextVisitIndex].dialog}”`);inspect('card');hud();
}
function hud(){
  $('visit').textContent=`Wizyta ${Math.min(state.nextVisitIndex+(phase==='transition'?0:1),state.limit)}/${state.limit}`;
  $('mistakes').textContent=`Błędy ${state.mistakes}/3`;$('mistakes').classList.toggle('has-errors',state.mistakes>0);
  $('mistakes').setAttribute('aria-label',`Naruszenia procedury: ${state.mistakes}/3`);
  const enabled=phase==='playing'&&!paused&&$('overlay').hidden&&(state.nextVisitIndex!==0||(seen.card&&seen.register));
  $('allow').disabled=$('deny').disabled=!enabled;
  for(const id of ['card','register','look','instructions','resident-select'])$(id).disabled=phase!=='playing'||paused;
  for(const button of $('inspection').querySelectorAll('[data-person]'))button.disabled=phase!=='playing'||paused;
  $('card').setAttribute('aria-pressed',String(inspectionOpen&&panelMode==='card'));
  $('register').setAttribute('aria-pressed',String(inspectionOpen&&panelMode==='compare'));
  const gate=phase==='playing'&&state.nextVisitIndex===0&&(!seen.card||!seen.register);
  $('tutorial').hidden=!gate;
  $('tutorial').textContent=!seen.card?'Obejrzyj dane karty, aby odblokować decyzję.':'Porównaj kartę ze spisem, aby odblokować decyzję.';
  $('allow').setAttribute('aria-describedby',gate?'tutorial':'');$('deny').setAttribute('aria-describedby',gate?'tutorial':'');
}
function personHTML(id,name,flat,source){return `<div class="person"><button class="portrait-button" data-person="${id}" aria-label="Powiększ zdjęcie: ${source}"><img class="portrait" src="${scene.portraits[id]}" alt="Zdjęcie: ${source}" width="90" height="110"></button><div class="identity"><strong>${name}</strong><div class="flat-line">Mieszkanie<span class="flat">${flat}</span></div></div></div>`;}
function portraitEvents(){for(const button of $('inspection').querySelectorAll('[data-person]'))button.onclick=()=>portrait(button.dataset.person);}
function updateResident(){const r=residents.find(r=>r.id===selected);$('resident-content').innerHTML=personHTML(r.id,r.name,r.flat,'wpis w spisie');portraitEvents();refreshVisibility();}
function inspect(kind){
  if(phase!=='playing'||paused||!$('overlay').hidden)return;
  const v=visits[state.nextVisitIndex];panelMode=kind==='register'?'compare':'card';
  $('card-content').innerHTML=personHTML(v.card,v.name,v.flat,'karta mieszkańca');
  $('resident-select').innerHTML=residents.map(r=>`<option value="${r.id}" ${selected===r.id?'selected':''}>${r.name} · ${r.flat}</option>`).join('');
  inspectionOpen=true;$('inspection').hidden=false;$('register-picker').hidden=$('resident-sheet').hidden=panelMode!=='compare';
  $('documents').classList.toggle('compare',panelMode==='compare');updateResident();syncScene();audio.cue('paper');hud();refreshVisibility();
}
function closeInspection(){inspectionOpen=false;$('inspection').hidden=true;syncScene();hud();$('card').focus();}
function portrait(id){
  if(phase!=='playing'||paused)return;
  const r=residents.find(x=>x.id===id);
  modal(`<span class="eyebrow">POWIĘKSZENIE FOTOGRAFII</span><h2>${r.name}</h2><img class="portrait-large" src="${scene.portraits[id]}" alt="Powiększony portret ${r.name}"><button id="back-photo">Wróć do dokumentów</button>`,'portrait');$('back-photo').onclick=()=>{hideModal();$('card').focus();};
}
$('resident-select').onchange=e=>{selected=e.target.value;updateResident();hud();};
// Count visible CONTENT, never the action that opened a panel. Refresh after overlays/resize.
const viewed=new IntersectionObserver(entries=>{
  if(!inspectionOpen||phase!=='playing'||paused||!$('overlay').hidden||document.hidden)return;
  for(const e of entries){const kind=e.target.id==='card-content'?'card':'register';if(e.isIntersecting&&e.intersectionRatio>=.85&&(kind==='card'||panelMode==='compare'))seen[kind]=true;}hud();
},{root:$('documents'),threshold:[.85]});
function refreshVisibility(){requestAnimationFrame(()=>{for(const id of ['card-content','resident-content']){viewed.unobserve($(id));viewed.observe($(id));}});}
$('card').onclick=()=>inspect('card');$('register').onclick=()=>inspect('register');
$('look').onclick=()=>{closeInspection();scene.center();};
$('instructions').onclick=()=>{modal('<span class="eyebrow">INSTRUKCJA</span><h2>Trzy reguły</h2><ol><li>Po 03:00 wpuszczamy tylko lokatorów.</li><li>Nazwisko i mieszkanie muszą odpowiadać temu samemu wpisowi w spisie.</li><li>Zdjęcia na karcie i w spisie muszą przedstawiać osobę przy okienku.</li></ol><p>Tab i Enter obsługują przyciski. Przeciągnij scenę palcem lub myszą. Nie ma limitu czasu.</p><button id="back-rules">Wróć do kontroli</button>','instruction');$('back-rules').onclick=hideModal;};
$('dialog-expand').onclick=()=>{modal(`<span class="eyebrow">WYPOWIEDŹ</span><p>${currentDialogue}</p><button id="back-dialog">Wróć do kontroli</button>`,'dialogue');$('back-dialog').onclick=hideModal;};
function makeDecision(allow){
  if(phase!=='playing'||paused||!$('overlay').hidden||$('allow').disabled)return;
  const index=state.nextVisitIndex,newState=decide(state,index,allow);if(newState===state)return;
  phase='transition';state=newState;hud();const correct=allow===visits[index].allow;
  audio.cue(correct?'door':'error');scene.depart();
  const line=!correct&&index===0?'„Przecież tu mieszkam”.':allow?'Drzwi na klatkę otwierają się. Kroki oddalają się.':'Gość zabiera kartę i odchodzi.';
  setDialogue(`${correct?'':`Naruszenie procedury: ${state.mistakes}/3. `}${line}`);
  transition={remaining:correct?2.7:3.1,reacted:false,index,correct};syncScene();
}
$('allow').onclick=()=>makeDecision(true);$('deny').onclick=()=>makeDecision(false);
function pause(){
  if(!['playing','transition'].includes(phase)||paused)return;
  paused=true;syncScene();audio.pause();hud();
  modal(`<span class="eyebrow">JESIONOWA 12 · ZMIANA WSTRZYMANA</span><h2>Chwila ciszy.</h2><p>${saveError||'Postęp zapisuje się lokalnie po każdej zakończonej wizycie.'}</p><div class="stack"><button id="resume" class="primary">Wznów</button><button id="menu">Ekran startowy</button><button id="fullscreen">Pełny ekran</button></div>${settings()}<p id="screen-note" class="tiny">Prototyp: dwie wizyty. Bez zapisu na koncie huba.</p>`,'pause');
  $('resume').onclick=()=>{paused=false;hideModal();syncScene();audio.resume();hud();};$('menu').onclick=menu;$('fullscreen').onclick=fullscreen;wireSettings();
}
$('pause').onclick=pause;
window.addEventListener('keydown',e=>{
  if(e.key==='Tab'){
    const root=!$('fatal').hidden?$('fatal'):!$('overlay').hidden?$('overlay'):null;
    if(root){const controls=[...root.querySelectorAll('button:not(:disabled),select,input,[tabindex="0"]')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&(document.activeElement===first||!root.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!root.contains(document.activeElement))){e.preventDefault();first?.focus();}}
  }
  if(e.key!=='Escape')return;e.preventDefault();
  if(['portrait','instruction','dialogue'].includes(overlayKind)){hideModal();return;}
  if(inspectionOpen&&!paused){closeInspection();return;}
  if(!paused)pause();
});
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement){fullscreenExited=true;pause();}});
window.addEventListener('resize',()=>{refreshVisibility();measureDialogue();});
function summary(){
  phase='summary';paused=false;inspectionOpen=false;$('inspection').hidden=true;$('controls').hidden=true;scene?.pause(true);audio.pause();
  modal(`<span class="eyebrow">KONIEC PROTOTYPU A · TO NIE KONIEC ZMIANY</span><h1>Dwie wizyty<br>za tobą.</h1><p>Poprawne decyzje: ${state.decisions.length-state.mistakes}/${state.decisions.length} · Naruszenia: ${state.mistakes}/3</p>${state.decisions.map((answer,i)=>`<article class="result"><strong>Wizyta ${i+1} · ${answer===visits[i].allow?'Poprawnie':'Pomyłka'}</strong><p>Twoja decyzja: ${answer?'Wpuść':'Odmów'}. Prawidłowa: ${visits[i].allow?'Wpuść':'Odmów'}.</p><p>${visits[i].explanation}</p></article>`).join('')}<p class="tiny">Pełny GDD obejmuje osiem wizyt i dwa zakończenia. Ten fragment sprawdza czytelność dokumentów i sterowanie.</p><div class="stack"><button id="restart" class="primary">Zagraj ponownie</button><button id="menu">Ekran startowy</button></div>`,'summary');
  $('restart').onclick=confirmNew;$('menu').onclick=menu;
}
let last=0;
function tick(now){
  const dt=Math.min((now-last)/1000||0,.05);last=now;
  if(!document.hidden){if(saveTTL>0){saveTTL=Math.max(0,saveTTL-dt);if(!saveTTL&&!saveError)$('save-status').hidden=true;}if(phase==='playing'&&!paused&&hintTTL>0){hintTTL=Math.max(0,hintTTL-dt);if(!hintTTL)$('input-hint').hidden=true;}}
  if(phase==='transition'&&!paused&&transition){
    transition.remaining-=dt;
    if(!transition.reacted&&transition.remaining<.6){transition.reacted=true;if(!transition.correct){audio.cue('door');if(state.mistakes===2)scene.rattle();setDialogue(`Naruszenie procedury: ${state.mistakes}/3. ${state.mistakes===1?'[Pojedyncze uderzenie w rurę]':'[Klamka drzwi portierni porusza się]'}`);}else if(transition.index===1){audio.cue('error');scene.flicker(flashes);setDialogue('[Krótki trzask świetlówki]');}}
    if(transition.remaining<=0){transition=null;save();if(state.ending)summary();else beginVisit();}
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
if(scene){if(window.parent!==window){fatal('Ten prototyp uruchamia się samodzielnie. Integracja z hostem Party Pixels nie jest jeszcze podłączona.');}else menu();}
