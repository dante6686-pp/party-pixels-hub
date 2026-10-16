'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {getClient,avatars} from '../../../lib/client';
import {GAME,PROTOCOL,checkpoint,frameMessage,acceptsHandshake,saveKey,type GamePlayer,type InputMode} from '../../../lib/game-protocol';

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
type Orientation=ScreenOrientation&{lock?:(orientation:string)=>Promise<void>};
export default function GameHost() {
  const {player,loading:identityLoading,error:identityError}=useIdentity();
  const shell=useRef<HTMLDivElement>(null),iframe=useRef<HTMLIFrameElement>(null),port=useRef<MessagePort|null>(null);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const [started,setStarted]=useState(false),[state,setState]=useState<State>('menu');
  const [choice,setChoice]=useState<Choice>('auto'),[detected,setDetected]=useState<InputMode>('keyboard');
  const [full,setFull]=useState(false),[canFullscreen,setCanFullscreen]=useState(false);
  const [hasSave,setHasSave]=useState(false),[notice,setNotice]=useState(''),[portrait,setPortrait]=useState(false);
  const [rotateHint,setRotateHint]=useState(true);
  const mode=choice==='auto'?detected:choice;
  const modeRef=useRef(mode);modeRef.current=mode;
  const accountKey=player?.playerId??'guest';
  function send(data:Record<string,unknown>){port.current?.postMessage(data);}

  useEffect(()=>{
    const coarse=matchMedia('(pointer: coarse)'),orientation=matchMedia('(orientation: portrait)');
    const update=()=>{setDetected(coarse.matches?'touch':'keyboard');setPortrait(orientation.matches);};update();
    const point=(event:PointerEvent)=>{if(event.pointerType==='touch')setDetected('touch');else if(event.pointerType==='mouse')setDetected('keyboard');};
    const key=(event:KeyboardEvent)=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))setDetected('keyboard');};
    coarse.addEventListener('change',update);orientation.addEventListener('change',update);
    window.addEventListener('pointerdown',point);window.addEventListener('keydown',key);
    return()=>{coarse.removeEventListener('change',update);orientation.removeEventListener('change',update);window.removeEventListener('pointerdown',point);window.removeEventListener('keydown',key);};
  },[]);
  useEffect(()=>{
    const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    setCanFullscreen(Boolean(document.fullscreenEnabled&&shell.current?.requestFullscreen));
    const changed=()=>{
      setFull(Boolean(document.fullscreenElement));
      if(!document.fullscreenElement){port.current?.postMessage({type:'pause'});(screen.orientation as Orientation)?.unlock?.();}
    };
    const hidden=()=>{if(document.hidden)port.current?.postMessage({type:'pause'});};
    document.addEventListener('fullscreenchange',changed);document.addEventListener('visibilitychange',hidden);
    return()=>{
      document.body.style.overflow=oldOverflow;document.removeEventListener('fullscreenchange',changed);document.removeEventListener('visibilitychange',hidden);
      if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});
      (screen.orientation as Orientation)?.unlock?.();
    };
  },[]);
  useEffect(()=>{send({type:'input',mode});},[mode]);

  useEffect(()=>{
    if(identityLoading||identityError)return;
    setReady(false);setStarted(false);setState('menu');setError('');setNotice('');
    let alive=true,connected=false;
    const ownerKey=saveKey(player?.playerId??null);
    let saved:ReturnType<typeof checkpoint>=null;
    try{saved=checkpoint(JSON.parse(localStorage.getItem(ownerKey)??'null'));}catch{}
    setHasSave(Boolean(saved&&saved.mission>0));
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
        else if(data.type==='input-detected')setDetected(data.mode);
        else if(data.type==='error')setError('Nie udało się uruchomić grafiki 3D. Odśwież grę lub otwórz ją w aktualnej przeglądarce z WebGL 2.');
        else if(data.type==='save'){
          let ok=false;
          try{localStorage.setItem(ownerKey,JSON.stringify(data.checkpoint));ok=true;setHasSave(data.checkpoint.mission>0);}catch{}
          channel.port1.postMessage({type:'saved',requestId:data.requestId,ok});
          if(!ok)setNotice('Przeglądarka nie pozwala zapisać postępu. Ta zmiana pozostanie tylko w pamięci gry.');
        }
      };
      channel.port1.start();
      // An opaque target cannot be expressed as targetOrigin. Only the selected frame receives this port.
      iframe.current?.contentWindow?.postMessage({type:'pp:init',protocol:PROTOCOL,build:GAME.build,player:player?{displayName:player.displayName,avatar:player.avatar}:null,checkpoint:saved,mode:modeRef.current},'*',[channel.port2]);
      setReady(true);
    };
    window.addEventListener('message',receive);
    return()=>{alive=false;clearTimeout(timeout);window.removeEventListener('message',receive);port.current?.close();port.current=null;};
  },[identityLoading,identityError,player?.playerId,player?.displayName,player?.avatar,attempt]);

  async function fullscreen() {
    if(document.fullscreenElement){await document.exitFullscreen().catch(()=>{});return;}
    if(!shell.current?.requestFullscreen||!document.fullscreenEnabled)return;
    try{
      await shell.current.requestFullscreen();
      if(modeRef.current==='touch')await (screen.orientation as Orientation).lock?.('landscape').catch(()=>{});
    }catch{setNotice('Gra wypełnia okno. Pełny ekran systemowy jest niedostępny w tej przeglądarce.');}
  }
  function launch(continued:boolean){
    if(!ready)return;
    void fullscreen();setStarted(true);send({type:'start',continued});iframe.current?.focus();
  }
  function togglePause(){send({type:state==='paused'?'resume':'pause'});if(state==='paused')iframe.current?.focus();}
  function retry(){setError('');setAttempt(value=>value+1);}
  const blocked=Boolean(error||identityError);
  return <div className="game-shell" ref={shell} data-input={mode}>
    <div className="player-toolbar">
      <Link href="/#games" className="player-back" aria-label="Wróć do huba">← <span>Hub</span></Link>
      <div className="player-title"><strong>{GAME.title}</strong><span>{player?`${player.avatar} ${player.displayName}`:'👾 Gość'}</span></div>
      <div className="player-tools"><label className="input-choice"><span>Sterowanie</span><select aria-label="Sterowanie" value={choice} onChange={event=>{setChoice(event.target.value as Choice);send({type:'pause'});}}><option value="auto">Auto</option><option value="touch">Dotyk</option><option value="keyboard">Klawiatura</option></select></label>
        {started&&<button className="player-action" onClick={togglePause} disabled={!ready||blocked||!['playing','paused'].includes(state)} aria-label={state==='paused'?'Wznów grę':'Pauza'}>{state==='paused'?'▶':'Ⅱ'}</button>}
        {canFullscreen&&<button className="player-action fullscreen-action" onClick={()=>void fullscreen()} aria-label={full?'Wyjdź z pełnego ekranu':'Pełny ekran'}>{full?'↙':'⛶'}</button>}
      </div>
    </div>
    <div className="game-stage">
      {!identityLoading&&!identityError&&<iframe key={`${accountKey}:${attempt}`} ref={iframe} src={GAME.url} title={`${GAME.title}: ${GAME.subtitle}`} inert={!started||blocked} aria-hidden={!started||blocked} sandbox="allow-scripts allow-pointer-lock allow-orientation-lock" allow="autoplay; fullscreen" allowFullScreen referrerPolicy="origin" onError={()=>setError('Nie udało się pobrać gry. Spróbuj ponownie.')}/>}
      {(!started||blocked)&&<div className="player-gate"><div className="player-gate-copy"><p className="eyebrow">PARTY PIXELS / 3D</p><h1>MAGAZYN<br/><span>AUTO</span></h1><p className="gate-subtitle">Wielka Szychta</p>
        {blocked?<><p role="alert">{identityError?'Nie udało się sprawdzić profilu. Odśwież stronę, żeby bezpiecznie wczytać swój zapis.':error}</p><button className="primary" onClick={()=>identityError?window.location.reload():retry()}>Spróbuj ponownie <span>↻</span></button></>:!ready?<p role="status">{identityLoading?'Sprawdzam profil…':'Otwieramy magazyn…'}</p>:<><p>Jedna hala. Siedem wózków. Żadnego paragonu.</p><p className="gate-controls">{mode==='touch'?'Lewy kciuk: joystick. Prawy: wsiadanie, akcja i nitro.':'WASD / strzałki: ruch · E: wsiadanie · Spacja: akcja · Shift: nitro · P: pauza'}</p>{mode==='touch'&&portrait&&<p className="rotate-copy">↻ Obróć telefon poziomo — zobaczysz więcej hali.</p>}
          <button className="primary" onClick={()=>launch(hasSave)}>{hasSave?'Kontynuuj zmianę':'Graj'} <span>→</span></button>{hasSave&&<button className="text-button" onClick={()=>launch(false)}>Nowa zmiana</button>}
          <p className="local-save-note">{player?`Zapis dla ${player.displayName}`:'Zapis gościa'} · tylko na tym urządzeniu.<br/>Checkpoint po ukończeniu misji. Bez wspólnego rankingu.</p>
        </>}
      </div></div>}
      {started&&mode==='touch'&&portrait&&rotateHint&&!blocked&&<button className="rotate-hint" onClick={()=>setRotateHint(false)}>↻ Wygodniej grać poziomo <span>×</span></button>}
    </div>
    {notice&&<div className="player-notice" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Zamknij komunikat">×</button></div>}
  </div>;
}
