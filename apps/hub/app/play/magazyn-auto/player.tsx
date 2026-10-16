'use client';

import {useEffect,useRef,useState} from 'react';
import {recordPlayed} from '../../../lib/library';
import Link from 'next/link';
import {getClient,avatars} from '../../../lib/client';
import {GAME,PROTOCOL,frameMessage,acceptsHandshake,campaignTitle,type Checkpoint,type GamePlayer,type InputMode} from '../../../lib/game-protocol';
import {CheckpointSync,type SyncStatus} from '../../../lib/checkpoint-sync';

function useIdentity() {
  const [userId,setUserId]=useState<string|null|undefined>(undefined);
  const [player,setPlayer]=useState<GamePlayer|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  useEffect(()=>{
    const client=getClient();
    if(!client){setUserId(null);return;}
    let active=true,revision=0;
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{
      revision++;if(active){setUserId(session?.user.id??null);setError(false);}
    });
    const initial=revision;
    void client.auth.getUser().then(({data,error})=>{
      if(active&&revision===initial){
        // AuthSessionMissing is the normal guest case; transport errors aren't.
        if(error&&error.name!=='AuthSessionMissingError'){setError(true);setLoading(false);}
        else setUserId(data.user?.id??null);
      }
    }).catch(()=>{if(active){setError(true);setLoading(false);}});
    return()=>{active=false;subscription.unsubscribe();};
  },[]);
  useEffect(()=>{
    let active=true;setPlayer(null);
    if(userId===undefined)return;
    if(userId===null){setLoading(false);return;}
    setLoading(true);
    const client=getClient();if(!client)return;
    void client.from('profiles').select('display_name,avatar_key').eq('player_id',userId).maybeSingle().then(({data,error})=>{
      if(!active)return;
      if(error)setError(true);
      else setPlayer({playerId:userId,displayName:data?.display_name??'Gracz',avatar:avatars[data?.avatar_key as keyof typeof avatars]??'👾'});
      setLoading(false);
    });
    return()=>{active=false;};
  },[userId]);
  return {player,loading,error};
}

type Choice='auto'|InputMode;
type State='menu'|'playing'|'paused'|'complete'|'busted';
export default function GameHost() {
  const {player,loading:identityLoading,error:identityError}=useIdentity();
  const shell=useRef<HTMLDivElement>(null),iframe=useRef<HTMLIFrameElement>(null),port=useRef<MessagePort|null>(null);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const [started,setStarted]=useState(false),[state,setState]=useState<State>('menu');
  const [choice,setChoice]=useState<Choice>('auto'),[detected,setDetected]=useState<InputMode>('keyboard');
  const [full,setFull]=useState(false),[canFullscreen,setCanFullscreen]=useState(false);
  const [hasSave,setHasSave]=useState(false),[notice,setNotice]=useState('');
  const [saveLoaded,setSaveLoaded]=useState(false),[syncStatus,setSyncStatus]=useState<SyncStatus>('loading');
  const [mission,setMission]=useState(0),[syncBusy,setSyncBusy]=useState(false);
  const saves=useRef<CheckpointSync|null>(null),initialSave=useRef<Checkpoint|null>(null);
  const mode=choice==='auto'?detected:choice;
  const modeRef=useRef(mode);modeRef.current=mode;
  const accountKey=player?.playerId??'guest';
  function send(data:Record<string,unknown>){port.current?.postMessage(data);}

  useEffect(()=>{
    const coarse=matchMedia('(pointer: coarse)');
    const update=()=>{setDetected(coarse.matches?'touch':'keyboard');};update();
    const point=(event:PointerEvent)=>{if(event.pointerType==='touch')setDetected('touch');else if(event.pointerType==='mouse')setDetected('keyboard');};
    const key=(event:KeyboardEvent)=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))setDetected('keyboard');};
    coarse.addEventListener('change',update);
    window.addEventListener('pointerdown',point);window.addEventListener('keydown',key);
    return()=>{coarse.removeEventListener('change',update);window.removeEventListener('pointerdown',point);window.removeEventListener('keydown',key);};
  },[]);
  useEffect(()=>{
    const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    setCanFullscreen(Boolean(document.fullscreenEnabled&&shell.current?.requestFullscreen));
    const changed=()=>{
      setFull(Boolean(document.fullscreenElement));
      if(!document.fullscreenElement){port.current?.postMessage({type:'pause'});}
    };
    const hidden=()=>{if(document.hidden)port.current?.postMessage({type:'pause'});};
    document.addEventListener('fullscreenchange',changed);document.addEventListener('visibilitychange',hidden);
    return()=>{
      document.body.style.overflow=oldOverflow;document.removeEventListener('fullscreenchange',changed);document.removeEventListener('visibilitychange',hidden);
      if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});
      
    };
  },[]);
  useEffect(()=>{send({type:'input',mode});},[mode]);

  useEffect(()=>{
    setSaveLoaded(false);setReady(false);setStarted(false);setError('');
    if(identityLoading||identityError)return;
    let alive=true;
    const client=getClient(),owner=player?.playerId??null;
    async function invoke(name:'pp_load_checkpoint'|'pp_store_checkpoint',args:Record<string,unknown>={}) {
      if(!client||!owner)throw Error('CLOUD_UNAVAILABLE');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
      try{
        // Server checks expected owner against auth.uid(), including during an account switch.
        const {data,error}=await client.rpc(name,{p_expected_player:owner,...args}).abortSignal(controller.signal);
        if(error)throw Error(error.message);return data;
      }finally{clearTimeout(timer);}
    }
    const manager=new CheckpointSync(owner,{getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)},owner?{
      load:()=>invoke('pp_load_checkpoint'),
      save:job=>invoke('pp_store_checkpoint',{p_expected_revision:job.expectedRevision,p_request_id:job.requestId,p_checkpoint:job.checkpoint}),
    }:null,(status,snapshot)=>{
      if(!alive)return;
      setSyncStatus(status);setHasSave(Boolean(snapshot.checkpoint));initialSave.current=snapshot.checkpoint;
      setMission(snapshot.checkpoint?.mission??0);
      port.current?.postMessage({type:'sync',status});
      if(status==='conflict'){port.current?.postMessage({type:'pause'});}
    });
    saves.current=manager;
    void manager.load().then(snapshot=>{
      if(!alive)return;initialSave.current=snapshot.checkpoint;setMission(snapshot.checkpoint?.mission??0);setSaveLoaded(true);
    }).catch(()=>{if(alive)setError('Nie udało się wczytać zapisu konta. Sprawdź połączenie i ponów próbę. Lokalny postęp pozostaje zachowany.');});
    const online=()=>{void manager.flush();};window.addEventListener('online',online);
    return()=>{alive=false;manager.dispose();if(saves.current===manager)saves.current=null;window.removeEventListener('online',online);};
  },[identityLoading,identityError,player?.playerId,attempt]);

  useEffect(()=>{
    if(identityLoading||identityError||!saveLoaded)return;
    setReady(false);setStarted(false);setState('menu');setError('');setNotice('');
    let alive=true,connected=false;
    const timeout=setTimeout(()=>{if(alive&&!connected)setError('Gra nie odpowiedziała. Sprawdź połączenie i spróbuj ponownie.');},15000);
    const receive=(event:MessageEvent)=>{
      // No allow-same-origin: sandbox frames deliberately have the opaque "null" origin.
      if(!acceptsHandshake(event,iframe.current?.contentWindow)||connected)return;
      connected=true;clearTimeout(timeout);
      const channel=new MessageChannel();port.current=channel.port1;
      channel.port1.onmessage=(message)=>{
        if(!alive)return;
        const data=frameMessage(message.data);if(!data)return;
        if(data.type==='state')setState(data.state);
        else if(data.type==='progress')setMission(data.mission);
        else if(data.type==='input-detected')setDetected(data.mode);
        else if(data.type==='error')setError('Nie udało się uruchomić grafiki 3D. Odśwież grę lub otwórz ją w aktualnej przeglądarce z WebGL 2.');
        else if(data.type==='save'){
          let ok=false;
          try{if(!saves.current)throw Error('SAVE_NOT_READY');saves.current.enqueue(data.checkpoint);ok=true;}catch{}
          channel.port1.postMessage({type:'saved',requestId:data.requestId,ok,status:saves.current?.getStatus()??'error'});
          if(!ok){channel.port1.postMessage({type:'pause'});setNotice('Nie potwierdzono zapisu. Nie zamykaj gry; sprawdź stan zapisu w górnym pasku.');}
        }
      };
      channel.port1.start();
      // An opaque target cannot be expressed as targetOrigin. Only the selected frame receives this port.
      iframe.current?.contentWindow?.postMessage({type:'pp:init',protocol:PROTOCOL,build:GAME.build,player:player?{displayName:player.displayName,avatar:player.avatar}:null,checkpoint:initialSave.current,mode:modeRef.current,syncStatus:initialSave.current?saves.current?.getStatus():'ready'},'*',[channel.port2]);
      setReady(true);
    };
    window.addEventListener('message',receive);
    return()=>{alive=false;clearTimeout(timeout);window.removeEventListener('message',receive);port.current?.close();port.current=null;};
  },[identityLoading,identityError,saveLoaded,player?.playerId,attempt]);

  async function fullscreen() {
    if(document.fullscreenElement){await document.exitFullscreen().catch(()=>{});return;}
    if(!shell.current?.requestFullscreen||!document.fullscreenEnabled)return;
    try{
      await shell.current.requestFullscreen();
    }catch{setNotice('Gra wypełnia okno. Pełny ekran systemowy jest niedostępny w tej przeglądarce.');}
  }
  function launch(continued:boolean){
    if(!ready)return;
    if(player)void recordPlayed(player.playerId,'magazyn-auto').catch(()=>{});
    if(!document.fullscreenElement)void fullscreen();setStarted(true);send({type:'start',continued});iframe.current?.focus();
  }
  function togglePause(){send({type:state==='paused'?'resume':'pause'});if(state==='paused')iframe.current?.focus();}
  function retry(){setError('');setAttempt(value=>value+1);}
  async function useCloud(){setSyncBusy(true);try{await saves.current?.useCloud();setAttempt(value=>value+1);}catch{setNotice('Nie udało się wczytać zapisu konta. Spróbuj ponownie.');}finally{setSyncBusy(false);}}
  const blocked=Boolean(error||identityError);
  const conflict=syncStatus==='conflict';
  const syncLabel={loading:'Wczytuję zapis…',cloud:hasSave?'✓ Zapis na koncie':'Konto gotowe do zapisu',device:'Zapis gościa · to urządzenie',pending:'Zapis lokalny · czeka na synchronizację',conflict:'Nowszy zapis na innym urządzeniu',error:'Nie potwierdzono zapisu'}[syncStatus];
  return <div className="game-shell" ref={shell} data-input={mode}>
    <div className="player-toolbar">
      <Link href="/#games" className="player-back" aria-label="Wróć do huba">← <span>Hub</span></Link>
      <div className="player-title"><strong>{GAME.title}</strong><span>{player?`${player.avatar} ${player.displayName}`:'👾 Gość'}</span><small className="player-save" role="status">{syncLabel}</small></div>
      <div className="player-tools"><label className="input-choice"><span>Sterowanie</span><select aria-label="Sterowanie" value={choice} onChange={event=>{setChoice(event.target.value as Choice);send({type:'pause'});}}><option value="auto">Auto</option><option value="touch">Dotyk</option><option value="keyboard">Klawiatura</option></select></label>
        {syncStatus==='pending'&&<button className="player-retry" onClick={()=>void saves.current?.flush()}>Ponów zapis</button>}
        {started&&<button className="player-action" onClick={togglePause} disabled={!ready||blocked||conflict||!['playing','paused'].includes(state)} aria-label={state==='paused'?'Wznów grę':'Pauza'}>{state==='paused'?'▶':'Ⅱ'}</button>}
        {canFullscreen&&<button className="player-action fullscreen-action" onClick={()=>void fullscreen()} aria-label={full?'Wyjdź z pełnego ekranu':'Pełny ekran'}>{full?'↙':'⛶'}</button>}
      </div>
    </div>
    <div className="game-stage">
      {!identityLoading&&!identityError&&saveLoaded&&<iframe key={`${accountKey}:${attempt}`} ref={iframe} src={GAME.url} title={`${GAME.title}: ${GAME.subtitle}`} inert={!started||blocked||conflict} aria-hidden={!started||blocked||conflict} sandbox="allow-scripts allow-pointer-lock" allow="autoplay; fullscreen" allowFullScreen referrerPolicy="origin" onError={()=>setError('Nie udało się pobrać gry. Spróbuj ponownie.')}/>}
      {(!started||blocked||conflict)&&<div className="player-gate"><div className="player-gate-copy"><p className="eyebrow">PARTY PIXELS / 3D</p><h1>MAGAZYN<br/><span>AUTO</span></h1><p className="gate-subtitle">Wielka Szychta</p>
        {blocked?<><p role="alert">{identityError?'Nie udało się sprawdzić profilu. Odśwież stronę, żeby bezpiecznie wczytać swój zapis.':error}</p><button className="primary" onClick={()=>identityError?window.location.reload():retry()}>Spróbuj ponownie <span>↻</span></button></>:conflict?<><p role="alert">Na innym urządzeniu zapisano nowszy postęp. Wczytaj zapis konta, aby kontynuować. Twoją lokalną próbę zachowamy jako kopię na tym urządzeniu.</p><button className="primary" disabled={syncBusy} onClick={()=>void useCloud()}>{syncBusy?'Wczytuję…':'Wczytaj zapis konta'}</button></>:!ready?<p role="status">{identityLoading?'Sprawdzam profil…':!saveLoaded?'Wczytuję postęp…':'Otwieramy magazyn…'}</p>:<><p>Jedna hala. Siedem wózków. Żadnego paragonu.</p><p className="campaign-stage">{campaignTitle(mission)}</p><p className="campaign-outline">1. Złota paleta → 2. Terminale z grafikiem → 3. Worek i Brama 03</p>{mission>=3&&<p>Teraz dostawy palet powtarzają się bez końca. Możesz też rozpocząć trzy misje od początku.</p>}<p className="gate-controls">{mode==='touch'?'Lewy kciuk: joystick. Prawy: wsiadanie, akcja i nitro.':'WASD / strzałki: ruch · E: wsiadanie · Spacja: akcja · Shift: nitro · P: pauza'}</p>
          <button className="primary" onClick={()=>launch(hasSave)}>{hasSave?(mission>=3?'Kontynuuj wolną jazdę':`Kontynuuj misję ${mission+1}/3`):'Graj — misja 1/3'} <span>→</span></button>{hasSave&&<button className="text-button" onClick={()=>launch(false)}>Rozpocznij kampanię od nowa</button>}
          <p className="local-save-note">{player?`Postęp dla ${player.displayName} zapisujemy na koncie. Sprawdzaj potwierdzenie w górnym pasku.`:'Gość: zapis tylko na tym urządzeniu. Zaloguj się w hubie, aby mieć zapis na koncie.'}<br/>Checkpoint po misji. Bez wspólnego rankingu.</p>
        </>}
      </div></div>}
    </div>
    {notice&&<div className="player-notice" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Zamknij komunikat">×</button></div>}
  </div>;
}
