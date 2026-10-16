'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {avatars,getClient,type Profile} from '../lib/client';
import Messages from './messages';
type Person=Profile & {request_id:string|null;relation:'none'|'friend'|'incoming'|'outgoing'};
const errors:Record<string,string>={PLAYER_CHANGED:'Sesja się zmieniła. Zaloguj się ponownie.',PROFILE_REQUIRED:'Potwierdź e-mail i zapisz profil.',COOLDOWN:'Ponowne zaproszenie do tej osoby będzie dostępne po 24 godzinach.',FRIEND_LIMIT:'Limit: 20 wysłanych zaproszeń lub 200 znajomości i zaproszeń na konto.',STALE_REQUEST:'Zaproszenie się zmieniło. Odśwież listę.',INVALID_TRANSITION:'Stan zaproszenia się zmienił. Odśwież listę.'};
export default function Friends({owner,view,onMessages,onInvites,onUnread}:{owner:string;view:string;onMessages:()=>void;onInvites:(n:number)=>void;onUnread:(n:number)=>void}){
 const [selected,setSelected]=useState<Profile|null>(null);
 const [people,setPeople]=useState<Person[]>([]),[results,setResults]=useState<Person[]|null>(null),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[confirm,setConfirm]=useState<string|null>(null);
 const alive=useRef(true),locked=useRef(false),searchRev=useRef(0),listRev=useRef(0);
 const rpc=useCallback(async(action:string,extra:Record<string,unknown>={})=>{
  const client=getClient();if(!client)throw new Error('Brak połączenia.');
  const {data,error}=await client.rpc('pp_friends',{p_owner:owner,p_action:action,...extra}).abortSignal(AbortSignal.timeout(12000));
  if(error)throw new Error(errors[error.message]??'Nie udało się połączyć. Spróbuj ponownie.');return data;
 },[owner]);
 const refresh=useCallback(async()=>{
  const revision=++listRev.current;
  try{const data=await rpc('list');if(alive.current&&revision===listRev.current){setPeople(data as Person[]);onInvites((data as Person[]).filter(p=>p.relation==='incoming').length);}}
  catch(e){if(alive.current)setNotice(e instanceof Error?e.message:'Błąd odświeżania.');}
  finally{if(alive.current)setLoading(false);}
 },[rpc,onInvites]);
 useEffect(()=>{
  alive.current=true;void refresh();const focus=()=>{if(!document.hidden)void refresh();};const timer=setInterval(focus,30000);
  window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
  return()=>{alive.current=false;searchRev.current++;listRev.current++;clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
 },[refresh]);
 async function search(e:FormEvent){
  e.preventDefault();if(locked.current)return;const term=query.trim().toLowerCase();
  if(!/^[a-z0-9_]{3,20}$/.test(term)){setNotice('Wpisz minimum 3 znaki nicku: litery, cyfry lub _.');return;}
  locked.current=true;setBusy(true);setNotice('');const revision=++searchRev.current;
  try{const data=await rpc('search',{p_query:term});if(alive.current&&revision===searchRev.current)setResults(data as Person[]);}
  catch(e){if(alive.current)setNotice(e instanceof Error?e.message:'Błąd wyszukiwania.');}
  finally{locked.current=false;if(alive.current)setBusy(false);}
 }
 async function act(action:'send'|'accept'|'decline'|'cancel'|'remove',p:Person){
  if(locked.current)return;locked.current=true;setBusy(true);setNotice('');
  try{await rpc(action,{p_target:p.player_id,p_request:p.request_id});if(!alive.current)return;
   setConfirm(null);setResults(null);searchRev.current++;
   setNotice({send:'Zaproszenie wysłane.',accept:'Jesteście znajomymi!',decline:'Zaproszenie odrzucone.',cancel:'Zaproszenie cofnięte.',remove:'Usunięto ze znajomych.'}[action]);await refresh();
  }catch(e){if(alive.current)setNotice(e instanceof Error?e.message:'Nie udało się zapisać zmiany.');}
  finally{locked.current=false;if(alive.current)setBusy(false);}
 }
 function row(person:Person){
  const p=people.find(x=>x.player_id===person.player_id)??person;
  return <li key={p.player_id} className="friend-row"><span className="friend-avatar" aria-hidden="true">{avatars[p.avatar_key]??'👻'}</span><div className="friend-name"><strong>{p.display_name}</strong><small>@{p.handle}</small></div><div className="friend-actions">
   {p.relation==='none'&&<button disabled={busy} onClick={()=>void act('send',p)}>Zaproś</button>}
   {p.relation==='incoming'&&<><button disabled={busy} onClick={()=>void act('accept',p)}>Przyjmij</button><button disabled={busy} onClick={()=>void act('decline',p)}>Odrzuć</button></>}
   {p.relation==='outgoing'&&<><small>Wysłano</small><button disabled={busy} onClick={()=>void act('cancel',p)}>Cofnij</button></>}
   {p.relation==='friend'&&<button onClick={()=>{setSelected(p);onMessages();}}>Napisz</button>}
   {p.relation==='friend'&&(confirm===p.player_id?<><span>Usunąć?</span><button disabled={busy} onClick={()=>void act('remove',p)}>Tak, usuń</button><button onClick={()=>setConfirm(null)}>Zostaw</button></>:<button disabled={busy} onClick={()=>setConfirm(p.player_id)}>Usuń znajomego</button>)}
  </div></li>;
 }
 const groups=[['incoming','Otrzymane zaproszenia','Nie masz nowych zaproszeń.'],['friend','Twoi znajomi','Twoja ekipa zaczyna się od pierwszego zaproszenia.'],['outgoing','Wysłane zaproszenia','Nie masz oczekujących wysłanych zaproszeń.']] as const;
 return <><div hidden={view!=='friends'}><section className="friends" aria-labelledby="friends-title" id="znajomi">
  <div className="friends-heading"><div><p className="eyebrow">DOBRE GRY. DOBRA EKIPA.</p><h2 id="friends-title">Twoi ludzie.</h2></div><button disabled={busy} onClick={()=>{setNotice('');void refresh();}}>Odśwież</button></div>
  <p className="muted">Znajdź gracza po nicku i dodaj do znajomych.</p>
  <form className="friend-search" onSubmit={search}><label htmlFor="friend-query">Nick gracza</label><div><input id="friend-query" value={query} onChange={e=>{setQuery(e.target.value);setResults(null);searchRev.current++;}} placeholder="Wpisz co najmniej 3 znaki" autoComplete="off" minLength={3} maxLength={20} required/><button disabled={busy} type="submit">{busy?'Chwileczkę…':'Szukaj'}</button></div></form>
  <p role="status" aria-live="polite" className="notice">{notice}</p>
  {results!==null&&<div className="friends-group"><h3>Wyniki wyszukiwania</h3>{results.length?<ul>{results.map(row)}</ul>:<p className="muted">Nie znaleziono innych graczy. Sprawdź nick.</p>}</div>}
  {loading?<p role="status">Wczytuję ekipę…</p>:groups.map(([relation,title,empty])=>{const rows=people.filter(p=>p.relation===relation);return <div className="friends-group" key={relation}><h3>{title} <span>{rows.length}</span></h3>{rows.length?<ul>{rows.map(row)}</ul>:<p className="muted">{empty}</p>}</div>;})}
  <small>Lista odświeża się co 30 sekund i po powrocie do strony. Zaproszenia dotyczą znajomości.</small>
 </section></div><div hidden={view!=='messages'}><Messages owner={owner} selected={selected} onSelect={setSelected} active={view==='messages'} onUnread={onUnread}/></div></>;
}
