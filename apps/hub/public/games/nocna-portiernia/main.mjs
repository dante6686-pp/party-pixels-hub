import { createScene } from './scene.mjs';
import { residents, visits, PROTOTYPE_LIMIT } from './scenario.mjs';
import { initialState, decide, validCheckpoint } from './logic.mjs';
import { createAudio } from './audio.mjs';
import { requestDefaultFullscreen } from './fullscreen.mjs';

const $=id=>document.getElementById(id),KEY='pp:nocna-portiernia:prototype-a:guest:v1';
const audio=createAudio();let scene;
let state=initialState(),saved=null,phase='menu',paused=false,selected='jan',seen={card:false,register:false},overlayKind='menu',transition=null;
let sound=true,flashes=false,inspectionOpen=false,lookMode=false;
function fatal(message){audio.pause();scene?.pause(true);$('fatal').hidden=false;if(message)$('fatal-detail').textContent=message;}
try{scene=createScene($('scene'),inspect,()=>fatal('Utracono dostęp do grafiki 3D. Odśwież grę. Ostatni zakończony fragment pozostaje w lokalnym zapisie.'));}catch(error){fatal();console.error('Nocna portiernia: renderer unavailable',error);}

function load(){
  try{const raw=localStorage.getItem(KEY);if(!raw)return null;const data=JSON.parse(raw);if(!validCheckpoint(data,PROTOTYPE_LIMIT))throw Error('INVALID_SAVE');return data;}
  catch{$('save-status').textContent='Zapis niedostępny lub niezgodny. Możesz zacząć nową zmianę.';return null;}
}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(state));saved=structuredClone(state);$('save-status').textContent='Zapis lokalny · gość';}
  catch{$('save-status').textContent='Nie udało się zapisać. Gra działa dalej; nie zamykaj tej karty.';}
}
saved=load();
function modal(html,kind){$('panel').innerHTML=html;$('overlay').hidden=false;overlayKind=kind;requestAnimationFrame(()=>$('panel').querySelector('button')?.focus());}
function hideModal(){$('overlay').hidden=true;overlayKind=null;}
function settings(){return `<div class="settings"><label><input id="sound" type="checkbox" ${sound?'checked':''}>Dźwięk</label><label><input id="flashes" type="checkbox" ${flashes?'checked':''}>Migotanie światła</label></div>`;}
function wireSettings(){
  $('sound')?.addEventListener('change',e=>{sound=e.target.checked;audio.enabled(sound);if(!paused&&phase==='playing'&&sound)audio.resume();});
  $('flashes')?.addEventListener('change',e=>{flashes=e.target.checked;});
}
async function fullscreen(){try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else if(document.fullscreenElement)await document.exitFullscreen();else $('screen-note').textContent='Pełny ekran nie jest dostępny. Możesz grać w obecnym widoku.';}catch{if($('screen-note'))$('screen-note').textContent='Przeglądarka nie włączyła pełnego ekranu. Możesz grać dalej.';}}
function startFullscreen(){void requestDefaultFullscreen(document).then(result=>{if(result==='unsupported'||result==='denied')$('input-hint').textContent='Pełny ekran niedostępny · gra działa w całym oknie.';});}
function menu(){
  phase='menu';paused=false;scene?.pause(true);audio.pause();$('controls').hidden=true;$('inspection').hidden=true;inspectionOpen=false;lookMode=false;
  modal(`<span class="eyebrow">PARTY PIXELS · PROTOTYP A</span><h1>Nocna<br>portiernia</h1><p>03:00. Jesionowa 12.<br>Sprawdź, kto naprawdę tu mieszka.</p><div class="stack">${saved?'<button id="continue" class="primary">Kontynuuj zapis</button>':''}<button id="new" class="${saved?'secondary':'primary'}">Nowa zmiana</button><button id="fullscreen" class="secondary">Pełny ekran</button></div>${settings()}<p id="screen-note" class="tiny">Dwie pierwsze wizyty. Lokalny zapis gościa. Bez integracji z kontem.</p>`, 'menu');
  $('new').onclick=()=>{if(saved)confirmNew();else {startFullscreen();intro();}};
  if($('continue'))$('continue').onclick=()=>{startFullscreen();state=structuredClone(saved);if(state.ending)summary();else beginVisit();};
  $('fullscreen').onclick=fullscreen;wireSettings();
}
function confirmNew(){modal('<span class="eyebrow">NOWA ZMIANA</span><h2>Zacząć od początku?</h2><p>Poprzedni lokalny zapis tego prototypu zostanie zastąpiony.</p><div class="stack"><button id="confirm-new" class="primary">Rozpocznij nową zmianę</button><button id="cancel-new">Zachowaj zapis</button></div>','confirm');$('confirm-new').onclick=()=>{startFullscreen();intro();};$('cancel-new').onclick=menu;}
function intro(){
  state=initialState();save();phase='intro';audio.resume();
  modal('<span class="eyebrow">WIADOMOŚĆ POPRZEDNIKA</span><h2>Po trzeciej<br>tylko lokatorzy.</h2><blockquote>„Porównaj nazwisko, mieszkanie i twarz. Spis jest aktualny. Zmiennik przyjdzie rano”.</blockquote><p>Obejrzyj kartę mieszkańca i wybierz lokatora w spisie. Porównaj także zdjęcia z osobą przy szybie. Nie musisz się spieszyć.</p><p class="tiny">Telefon: dotknij dokumentów, przeciągnij scenę.<br>PC: klikaj dokumenty, przeciągaj myszą; Escape zamyka zbliżenie lub otwiera pauzę.</p><button id="begin" class="primary">Odkładam wiadomość</button>','intro');
  $('begin').onclick=beginVisit;
}
function syncScene(){scene?.pause(paused||inspectionOpen||!['playing','transition'].includes(phase));}
function beginVisit(){
  if(!scene)return;phase='playing';paused=false;transition=null;seen={card:false,register:false};inspectionOpen=false;lookMode=false;hideModal();$('inspection').hidden=true;$('controls').hidden=false;
  scene.show(visits[state.nextVisitIndex].guest);scene.center();syncScene();audio.resume();audio.cue('step');hud();
  $('dialogue').innerHTML=`<span class="eyebrow">OSOBA PRZY OKIENKU</span><p>„${visits[state.nextVisitIndex].dialog}”</p>`;
}
function hud(){
  $('visit').textContent=`WIZYTA ${Math.min(state.nextVisitIndex+(phase==='transition'?0:1),state.limit)} / ${state.limit} · PROTOTYP`;
  $('mistakes').textContent=Array.from({length:3},(_,i)=>i<state.mistakes?'🔴':'○').join(' ');
  $('mistakes').setAttribute('aria-label',`Naruszenia procedury: ${state.mistakes}/3`);
  const enabled=phase==='playing'&&!paused&&(state.nextVisitIndex!==0||(seen.card&&seen.register));
  $('allow').disabled=$('deny').disabled=!enabled;
  $('card').disabled=$('register').disabled=phase!=='playing'||paused;
  $('tutorial').textContent=state.nextVisitIndex===0&&(!seen.card||!seen.register)?`Obejrzyj ${!seen.card?'kartę mieszkańca':''}${!seen.card&&!seen.register?' i ':''}${!seen.register?'spis lokatorów':''}, zanim zdecydujesz.`:'Nazwisko · mieszkanie · twarz. Bez limitu czasu.';
}
function personHTML(id,name,flat){return `<div class="person"><img class="portrait" src="${scene.portraits[id]}" alt="Portret: ${residents.find(r=>r.id===id).name}" tabindex="0" role="button" data-person="${id}" aria-label="Powiększ portret"><div><strong>${name}</strong><small>MIESZKANIE</small><span class="flat">${flat}</span></div></div>`;}
function portraitEvents(){for(const img of $('inspection').querySelectorAll('[data-person]')){const open=()=>portrait(img.dataset.person);img.onclick=open;img.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};}}
function updateResident(){const r=residents.find(r=>r.id===selected);$('resident-content').innerHTML=personHTML(r.id,r.name,r.flat);portraitEvents();}
function inspect(kind){
  if(phase!=='playing'||paused)return;lookMode=false;seen[kind]=true;
  const v=visits[state.nextVisitIndex];$('card-content').innerHTML=personHTML(v.card,v.name,v.flat);
  $('resident-select').innerHTML=residents.map(r=>`<option value="${r.id}" ${selected===r.id?'selected':''}>${r.name} · ${r.flat}</option>`).join('');
  updateResident();inspectionOpen=true;$('inspection').hidden=false;syncScene();audio.cue('paper');hud();$('close-inspection').focus();
}
function closeInspection(){inspectionOpen=false;$('inspection').hidden=true;syncScene();hud();$('card').focus();}
function portrait(id){
  const r=residents.find(x=>x.id===id);
  modal(`<span class="eyebrow">POWIĘKSZENIE FOTOGRAFII</span><h2>${r.name}</h2><img class="portrait-large" src="${scene.portraits[id]}" alt="Powiększony portret ${r.name}"><button id="back-photo">Wróć do dokumentów</button>`,'portrait');$('back-photo').onclick=hideModal;
}
$('resident-select').onchange=e=>{selected=e.target.value;seen.register=true;updateResident();hud();};
// Each sheet counts as viewed only once a substantial part actually enters the scroll viewport.
const viewed=new IntersectionObserver(entries=>{if(!inspectionOpen)return;for(const e of entries)if(e.isIntersecting&&e.intersectionRatio>=.45){seen[e.target.querySelector('#card-content')?'card':'register']=true;}hud();},{root:$('inspection').querySelector('.documents'),threshold:[.45]});
for(const sheet of document.querySelectorAll('.paper'))viewed.observe(sheet);
$('card').onclick=()=>{if(lookMode){lookMode=false;inspect('card');}else inspect('card');};
$('register').onclick=()=>inspect('register');$('close-inspection').onclick=closeInspection;
$('look').onclick=()=>{lookMode=true;closeInspection();scene.center();$('input-hint').textContent='Reguły są stałe. Wróć do dokumentów, zachowując wybrany wpis.';};
function makeDecision(allow){
  if(phase!=='playing'||paused||inspectionOpen||$('allow').disabled)return;
  const index=state.nextVisitIndex,newState=decide(state,index,allow);if(newState===state)return;
  phase='transition';state=newState;hud();const correct=allow===visits[index].allow;
  audio.cue(correct?'door':'error');scene.depart();
  const line=!correct&&index===0?'„Przecież tu mieszkam”.':allow?'Drzwi na klatkę otwierają się. Kroki oddalają się.':'Gość zabiera kartę i odchodzi.';
  $('dialogue').innerHTML=`<span class="eyebrow">${correct?'DECYZJA PRZYJĘTA':`NARUSZENIE PROCEDURY: ${state.mistakes}/3`}</span><p>${line}</p>`;
  // Commit only after departure/reaction. Leaving early replays the current visit from its last checkpoint.
  transition={remaining:correct?2.7:3.1,reacted:false,index,correct};syncScene();
}
$('allow').onclick=()=>makeDecision(true);$('deny').onclick=()=>makeDecision(false);
function pause(){
  if(!['playing','transition'].includes(phase)||paused)return;
  paused=true;syncScene();audio.pause();hud();
  modal(`<span class="eyebrow">ZMIANA WSTRZYMANA</span><h2>Chwila ciszy.</h2><p>Rozgrywka i dźwięk są zatrzymane. Nie naliczamy błędu.</p><div class="stack"><button id="resume" class="primary">Wznów</button><button id="menu">Ekran startowy</button><button id="fullscreen">Pełny ekran</button></div>${settings()}<p id="screen-note" class="tiny">Prototyp działa osobno. Powrót do huba zapewni jego programista przy integracji.</p>`,'pause');
  $('resume').onclick=()=>{paused=false;hideModal();syncScene();audio.resume();hud();};$('menu').onclick=menu;$('fullscreen').onclick=fullscreen;wireSettings();
}
$('pause').onclick=pause;
window.addEventListener('keydown',e=>{
  if(e.key==='Tab'){
    const root=!$('fatal').hidden?$('fatal'):!$('overlay').hidden?$('overlay'):inspectionOpen?$('inspection'):null;
    if(root){const controls=[...root.querySelectorAll('button:not(:disabled),select,input,[tabindex="0"]')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&(document.activeElement===first||!root.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!root.contains(document.activeElement))){e.preventDefault();first?.focus();}}
  }
  if(e.key!=='Escape')return;e.preventDefault();
  if(overlayKind==='portrait'){hideModal();return;}
  if(inspectionOpen&&!paused){closeInspection();return;}
  if(!paused)pause();
});
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)pause();});
function summary(){
  phase='summary';paused=false;inspectionOpen=false;$('inspection').hidden=true;$('controls').hidden=true;scene?.pause(true);audio.pause();
  modal(`<span class="eyebrow">KONIEC PROTOTYPU A · TO NIE KONIEC ZMIANY</span><h1>Dwie wizyty<br>za tobą.</h1><p>Poprawne decyzje: ${state.decisions.length-state.mistakes}/${state.decisions.length} · Naruszenia: ${state.mistakes}/3</p>${state.decisions.map((answer,i)=>`<article class="result"><strong>Wizyta ${i+1} · ${answer===visits[i].allow?'Poprawnie':'Pomyłka'}</strong><p>Twoja decyzja: ${answer?'Wpuść':'Odmów'}. Prawidłowa: ${visits[i].allow?'Wpuść':'Odmów'}.</p><p>${visits[i].explanation}</p></article>`).join('')}<p class="tiny">Pełny GDD obejmuje osiem wizyt i dwa zakończenia. Ten fragment sprawdza czytelność dokumentów i sterowanie.</p><div class="stack"><button id="restart" class="primary">Zagraj ponownie</button><button id="menu">Ekran startowy</button></div>`,'summary');
  $('restart').onclick=confirmNew;$('menu').onclick=menu;
}
let last=0;
function tick(now){
  const dt=Math.min((now-last)/1000||0,.05);last=now;
  if(phase==='transition'&&!paused&&transition){
    transition.remaining-=dt;
    if(!transition.reacted&&transition.remaining<.6){transition.reacted=true;if(!transition.correct){audio.cue('door');if(state.mistakes===2)scene.rattle();$('dialogue').innerHTML=`<span class="eyebrow">NARUSZENIE PROCEDURY: ${state.mistakes}/3</span><p>${state.mistakes===1?'[Pojedyncze uderzenie w rurę]':'[Klamka drzwi portierni porusza się]'}</p>`;}else if(transition.index===1){audio.cue('error');scene.flicker(flashes);$('dialogue').innerHTML='<span class="eyebrow">PRZEDSIONEK</span><p>[Krótki trzask świetlówki]</p>';}}
    if(transition.remaining<=0){transition=null;save();if(state.ending)summary();else beginVisit();}
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.addEventListener('pointerdown',e=>{$('input-hint').textContent=e.pointerType==='touch'?'Przeciągnij scenę. Dotknij dokumentów, aby je obejrzeć.':'Przeciągaj myszą. Klikaj dokumenty. Escape: zbliżenie / pauza.';},{passive:true});
window.addEventListener('keydown',e=>{if(e.key==='Tab')$('input-hint').textContent='Tab: wybór przycisku · Enter: zatwierdź · Escape: zbliżenie / pauza.';});
if(scene){if(window.parent!==window){fatal('Ten prototyp uruchamia się samodzielnie. Integracja z hostem Party Pixels nie jest jeszcze podłączona.');}else menu();}
