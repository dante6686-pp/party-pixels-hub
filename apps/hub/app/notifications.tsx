'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {getClient,avatars,type Profile} from '../lib/client';
import {duelApi,type DuelInvite} from '../lib/duel';
type Reply={id:string;parent_id:string;game_id:string;handle:string;display_name:string};
type Invite=Profile&{relation:string};
type Conversation=Profile&{unread:boolean};
export default function Notifications({owner,invites,unread}:{owner:string;invites:number;unread:number}){
 const [duels,setDuels]=useState<DuelInvite[]>([]);
 const [open,setOpen]=useState(false),[data,setData]=useState<{invites:Invite[];messages:Conversation[]}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [replies,setReplies]=useState<{rows:Reply[];unread:number}>({rows:[],unread:0});
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),revision=useRef(0);
 const load=useCallback(async()=>{
  const client=getClient();if(!client)return;const version=++revision.current;setLoading(true);
  const [friends,inbox]=await Promise.all([client.rpc('pp_friends',{p_owner:owner,p_action:'list'}).abortSignal(AbortSignal.timeout(12000)),client.rpc('pp_messages',{p_owner:owner,p_action:'inbox'}).abortSignal(AbortSignal.timeout(12000))]);
  if(version!==revision.current)return;setLoading(false);
  if(friends.error||inbox.error){setError('Nie udało się odświeżyć powiadomień.');return;}
  setError('');setData({invites:(friends.data as Invite[]).filter(p=>p.relation==='incoming'),messages:(inbox.data as Conversation[]).filter(p=>p.unread)});
 },[owner]);
 useEffect(()=>{
  if(!open)return;
  void load();const tick=()=>{if(!document.hidden)void load();};const timer=setInterval(tick,15000);
  const outside=(e:globalThis.PointerEvent)=>{if(e.target instanceof Node&&!root.current?.contains(e.target))setOpen(false);};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);window.addEventListener('focus',tick);
  return()=>{revision.current++;clearInterval(timer);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('focus',tick);};
 },[open,load,invites,unread]);
 useEffect(()=>{let alive=true,pending=false;async function refresh(){if(document.hidden||pending)return;const client=getClient();if(!client)return;pending=true;try{const {data,error}=await client.rpc('pp_notifications',{p_owner:owner,p_action:'list'}).abortSignal(AbortSignal.timeout(12000));if(alive&&!error)setReplies(data);}finally{pending=false;}}void refresh();const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh);};},[owner,open]);
 async function openReply(r:Reply){const client=getClient();if(!client)return;const {error}=await client.rpc('pp_notifications',{p_owner:owner,p_action:'read',p_id:r.id}).abortSignal(AbortSignal.timeout(12000));if(error){setError('Nie udało się oznaczyć odpowiedzi jako przeczytanej.');return;}window.location.assign('/game/'+r.game_id+'#comment-'+r.parent_id);}
 useEffect(()=>{let alive=true,pending=false;const refresh=async()=>{if(pending||document.hidden)return;pending=true;try{const rows:DuelInvite[]=await duelApi('list');if(alive)setDuels(rows.filter(r=>r.guest===owner&&r.state==='invited'));}catch{}finally{pending=false;}};void refresh();const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh);};},[owner,open]);
 const total=invites+unread+replies.unread+duels.length;
 return <div className="notifications" ref={root}><button ref={trigger} className="notification-trigger" aria-label={'Powiadomienia'+(total?`: ${total}`:'')} aria-expanded={open} aria-controls="notifications-panel" onClick={()=>setOpen(v=>!v)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>{total>0&&<b>{total>99?'99+':total}</b>}</button>
 {open&&<section id="notifications-panel" className="notification-panel" role="dialog" aria-labelledby="notifications-title"><div className="community-heading"><h2 id="notifications-title">Powiadomienia</h2><button className="community-button" aria-label="Zamknij powiadomienia" onClick={()=>{setOpen(false);trigger.current?.focus();}}>×</button></div><p className="community-hint">Zaproszenia, wiadomości i odpowiedzi na Twoje komentarze. Otwarcie dzwonka nie oznacza przeczytania wiadomości.</p>
 {error&&<p role="status">{error} <button className="community-button" disabled={loading} onClick={()=>void load()}>Ponów</button></p>}{!data&&loading&&<p role="status">Wczytuję powiadomienia…</p>}
 <h3>Zaproszenia do gry <small>{duels.length}</small></h3>{duels.length?<ul>{duels.map(r=><li key={r.id}><a href={'/duel?room='+r.id}><span><strong>{r.display_name}</strong><small>Szybka piątka — pojedynek · Dołącz →</small></span></a></li>)}</ul>:<p className="community-hint">Brak zaproszeń do gry.</p>}<a className="news-back" href="/duel">Twoje pokoje →</a>
 <h3>Odpowiedzi na komentarze <small>{replies.unread}</small></h3>{replies.rows.length?<ul>{replies.rows.map(r=><li key={r.id}><button className="reply-notification" onClick={()=>void openReply(r)}><strong>{r.display_name}</strong><small>@{r.handle} odpowiedział(a) na Twój komentarz →</small></button></li>)}</ul>:<p className="community-hint">Brak nowych odpowiedzi.</p>}
 {data&&<>{!data.invites.length&&!data.messages.length&&!replies.unread&&!duels.length?<p className="community-empty">Wszystko na bieżąco. Brak nowych powiadomień.</p>:<><h3>Zaproszenia do znajomych <small>{data.invites.length}</small></h3>{data.invites.length?<ul>{data.invites.map(p=><li key={p.player_id}><a href="#friends" onClick={()=>setOpen(false)}><span aria-hidden="true">{avatars[p.avatar_key]}</span><span><strong>{p.display_name}</strong><small>@{p.handle} zaprasza Cię do znajomych</small></span><span aria-hidden="true">→</span></a></li>)}</ul>:<p className="community-hint">Brak oczekujących zaproszeń.</p>}<h3>Nowe wiadomości <small>{data.messages.length}</small></h3>{data.messages.length?<ul>{data.messages.map(p=><li key={p.player_id}><a href={'#chat/'+p.handle} onClick={()=>setOpen(false)}><span aria-hidden="true">{avatars[p.avatar_key]}</span><span><strong>{p.display_name}</strong><small>Nieprzeczytane wiadomości · @{p.handle}</small></span><span aria-hidden="true">→</span></a></li>)}</ul>:<p className="community-hint">Wszystkie rozmowy przeczytane.</p>}</>}</>}
 </section>}
 </div>;
}
