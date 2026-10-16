'use client';
import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {createPlatformClient,type GameId,type Session,type Receipt} from '@party-pixels/sdk';
import {getClient,avatars,type Profile} from '../lib/client';
import {profileHref} from './profile-card';
import {FavoriteButton} from './player-library';
import {recordPlayed} from '../lib/library';
type Best={game_id:GameId;value:number;unit:string;attempts:number;verification_status:string};
type Pending={sessionId:string;requestId:string;result:Record<string,unknown>};
type Rank={player_id:string;value:number;handle:string};
const titles:Record<GameId,string>={'quick-math':'Szybka piątka','two-seconds':'Złap 2 sekundy'};
export default function Arcade({profile,gameId}:{profile:Profile;gameId:GameId}) {
  const [session,setSession]=useState<Session|null>(null);
  const [pending,setPending]=useState<Pending|null>(null);
  const [bests,setBests]=useState<Best[]>([]);
  const [rankings,setRankings]=useState<Record<GameId,Rank[]>>({'quick-math':[],'two-seconds':[]});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [running,setRunning]=useState(false);
  const [receipt,setReceipt]=useState<Receipt|null>(null);
  const startTime=useRef(0);
  const active=useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  const sdk=useMemo(()=>createPlatformClient({
    player:{playerId:profile.player_id,handle:profile.handle,displayName:profile.display_name,avatar:avatars[profile.avatar_key]},
    invoke:async(operation,args)=>{
      const client=getClient();if(!client)throw Error('NETWORK_ERROR');
      const {data,error}=await client.auth.getUser();
      if(error||data.user?.id!==profile.player_id)throw Error('PLAYER_CHANGED');
      const response=operation==='start'
        ?await client.rpc('pp_start_game',{p_game_id:args.gameId})
        :await client.rpc('pp_submit_score',{p_session_id:args.sessionId,p_request_id:args.requestId,p_result:args.result});
      if(response.error)throw Error(response.error.message);
      return response.data;
    },
  }),[profile.player_id,profile.handle,profile.display_name,profile.avatar_key]);
  async function refresh() {
    const client=getClient();if(!client)return;
    const [{data,error},math,clock]=await Promise.all([
      client.from('player_bests').select('game_id,value,unit,attempts,verification_status').eq('player_id',profile.player_id).eq('ruleset_version',1),
      client.from('player_bests').select('player_id,value,profiles(handle)').eq('game_id','quick-math').eq('ruleset_version',1).order('value',{ascending:false}).order('player_id').limit(5),
      client.from('player_bests').select('player_id,value,profiles(handle)').eq('game_id','two-seconds').eq('ruleset_version',1).order('value',{ascending:true}).order('player_id').limit(5),
    ]);
    if(!active.current)return;
    if(error)setMessage('Nie udało się odczytać rekordów. Spróbuj odświeżyć stronę.');
    else setBests((data??[]) as Best[]);
    if(math.error||clock.error)setMessage('Nie udało się odczytać rankingu. Spróbuj odświeżyć stronę.');
    const rows=(data:unknown):Rank[]=>Array.isArray(data)?data.map(row=>({player_id:row.player_id,value:row.value,handle:row.profiles?.handle??'gracz'})):[];
    setRankings({'quick-math':rows(math.data),'two-seconds':rows(clock.data)});
  }
  useEffect(()=>{void refresh();},[profile.player_id]);
  function explain(error:unknown) {
    const text=error instanceof Error?error.message:'';
    if(text.includes('PLAYER_CHANGED')||text.includes('AUTH_REQUIRED'))return 'Konto lub sesja się zmieniły. Zaloguj się ponownie.';
    if(text.includes('RATE_LIMITED'))return 'Za dużo prób. Poczekaj minutę.';
    if(text.includes('SESSION_EXPIRED'))return 'Ta runda wygasła. Rozpocznij nową.';
    return 'Nie potwierdzono zapisu. Możesz ponowić tę samą próbę.';
  }
  async function begin(gameId:GameId) {
    setBusy(true);setMessage('');setReceipt(null);setRunning(false);
    try {const s=await sdk.sessions.start(gameId);if(active.current){setSession(s);setPending(null);void recordPlayed(profile.player_id,gameId).catch(()=>{});}}
    catch(error){if(active.current)setMessage(explain(error));}
    finally{if(active.current)setBusy(false);}
  }
  async function submit(item:Pending) {
    setPending(item);setBusy(true);setMessage('');
    try {
      const result=await sdk.scores.submit(item.sessionId,item.requestId,item.result);
      if(!active.current)return;
      setReceipt(result);setPending(null);setSession(null);setMessage('Wynik zapisany na Twoim profilu.');
      await refresh();
    }catch(error){if(active.current)setMessage(explain(error));}
    finally{if(active.current)setBusy(false);}
  }
  function answer(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!session)return;
    const data=new FormData(event.currentTarget);
    const answers=Array.from({length:5},(_,i)=>Number(data.get('answer'+i)));
    void submit({sessionId:session.sessionId,requestId:crypto.randomUUID(),result:{answers}});
  }
  function clock() {
    if(!session)return;
    if(!running){startTime.current=performance.now();setRunning(true);return;}
    const value=Math.abs(Math.round(performance.now()-startTime.current)-2000);
    setRunning(false);
    if(value>10000){setSession(null);setMessage('Za długa przerwa. Rozpocznij kolejną rundę.');return;}
    void submit({sessionId:session.sessionId,requestId:crypto.randomUUID(),result:{value}});
  }
  useEffect(()=>{
    const hidden=()=>{if(document.hidden&&running){setRunning(false);setSession(null);setMessage('Runda przerwana po opuszczeniu gry. Zacznij nową próbę.');}};
    document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);
  },[running]);
  return <section className="arcade native-arcade" aria-label={'Gra '+titles[gameId]}>
    <div className="arcade-title"><div><p className="eyebrow">TWOJA ROZGRYWKA</p><h1>{titles[gameId]}</h1></div><span className="dev-label">{sdk.player.get().avatar} @{profile.handle}</span></div>

    <div className="game-grid">{([gameId] as GameId[]).map(id=>{const best=bests.find(b=>b.game_id===id);return <article id={'arcade-'+id} key={id} className="game-card"><span className="game-symbol" aria-hidden="true">{id==='quick-math'?'＋':'◷'}</span><h3>{titles[id]}</h3><FavoriteButton owner={profile.player_id} game={id} title={titles[id]}/><p>{id==='quick-math'?'Pięć działań. Ile rozwiążesz poprawnie?':'Uruchom stoper i zatrzymaj go po dwóch sekundach. Bez podglądania.'}</p><p className="best">{best?`Rekord: ${best.value}${id==='quick-math'?' / 5 pkt':' ms błędu'} · prób: ${best.attempts}`:'Jeszcze bez rekordu'}</p><small>{id==='quick-math'?'Odpowiedzi sprawdza serwer.':'Czas deklaruje przeglądarka — wynik niezweryfikowany.'}</small><button className="primary" onClick={()=>void begin(id)} disabled={busy||!!session||!!pending}>Rozpocznij rundę <span>→</span></button></article>;})}</div>
    {session&&<div className="round"><h3>{titles[session.gameId]}</h3><p className="muted">Gracz: @{sdk.player.get().handle}</p>
      {session.gameId==='quick-math'&&Array.isArray(session.challenge)?<form onSubmit={answer}><fieldset disabled={busy||!!pending}>{session.challenge.map((q,i)=><div className="math-row" key={i}><label htmlFor={'answer'+i}>{q.a} + {q.b} =</label><input id={'answer'+i} name={'answer'+i} type="number" inputMode="numeric" min="0" max="999" step="1" required/></div>)}<button className="primary" type="submit">{busy?'Zapisuję…':'Sprawdź odpowiedzi'}</button></fieldset></form>:<button className="clock-button" onClick={clock} disabled={busy||!!pending}>{running?'STOP':'START'}</button>}
      {!pending&&<button className="text-button" disabled={busy} onClick={()=>{setSession(null);setRunning(false);}}>Opuść rundę</button>}
    </div>}
    <div className="game-grid">{([gameId] as GameId[]).map(id=><section className="game-card" key={id} aria-label={'Ranking '+titles[id]}><h3>{titles[id]} — top 5</h3>{rankings[id].length?<ol>{rankings[id].map((row,i,all)=>{const first=all.findIndex(r=>r.value===row.value)+1;return <li key={row.player_id} value={first}><a href={profileHref(row.handle)}>@{row.handle}</a> · {row.value}{id==='quick-math'?' pkt':' ms błędu'}</li>;})}</ol>:<p>Jeszcze bez wyników.</p>}<small>{id==='quick-math'?'Więcej punktów = lepszy wynik.':'Mniejszy błąd = lepszy wynik. Ranking niezweryfikowany.'}</small></section>)}</div>
    {receipt&&<p className="score-receipt">{receipt.gameId==='quick-math'?`${receipt.value} / 5 poprawnych odpowiedzi`:`${receipt.value} ms od celu`} · {receipt.verificationStatus==='validated'?'odpowiedzi sprawdzone':'czas niezweryfikowany'}</p>}
    {message&&<p className="notice" role="status">{message}</p>}
    {pending&&<><button className="primary" disabled={busy} onClick={()=>void submit(pending)}>{busy?'Zapisuję…':'Ponów zapis tego wyniku'}</button><button className="text-button" disabled={busy} onClick={()=>{setPending(null);setSession(null);setMessage('Opuściłeś próbę. Wynik bez potwierdzenia nie jest oznaczony jako zapisany.');}}>Opuść próbę</button></>}
    <small>Wynik zapisujemy na Twoim koncie po zakończeniu rundy. Niezapisana próba nie przetrwa zamknięcia strony.</small>
  </section>;
}
