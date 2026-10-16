'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {avatars,getClient,type Profile} from '../lib/client';
type Message={id:string;sender_id:string;body:string;created_at:string};
type Conversation=Profile & {preview:string;unread:boolean};
const errors:Record<string,string>={FRIENDS_ONLY:'Możesz pisać tylko do aktualnych znajomych.',PLAYER_CHANGED:'Sesja się zmieniła. Zaloguj się ponownie.',RATE_LIMIT:'Chwila przerwy — limit to 30 wiadomości na minutę.',INVALID_MESSAGE:'Wpisz od 1 do 2000 znaków.',DUPLICATE_CONFLICT:'Nie udało się ponowić tej wiadomości.'};
async function api(owner:string,action:string,extra:Record<string,unknown>={}){
 const client=getClient();if(!client)throw new Error('Brak połączenia.');
 const {data,error}=await client.rpc('pp_messages',{p_owner:owner,p_action:action,...extra}).abortSignal(AbortSignal.timeout(12000));
 if(error)throw new Error(errors[error.message]??'Brak połączenia. Spróbuj ponownie.');return data;
}
export default function Messages({owner,selected,onSelect}:{owner:string;selected:Profile|null;onSelect:(p:Profile|null)=>void}){
 const [inbox,setInbox]=useState<Conversation[]>([]),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 const alive=useRef(true),version=useRef(0);
 const refresh=useCallback(async()=>{
  const v=++version.current;
  try{const data=await api(owner,'inbox');if(alive.current&&v===version.current){setInbox(data);setError('');setLoaded(true);}}
  catch(e){if(alive.current)setError(e instanceof Error?e.message:'Błąd rozmów.');}
 },[owner]);
 useEffect(()=>{alive.current=true;void refresh();const tick=()=>{if(!document.hidden)void refresh();};const timer=setInterval(tick,10000);window.addEventListener('focus',tick);return()=>{alive.current=false;version.current++;clearInterval(timer);window.removeEventListener('focus',tick);};},[refresh]);
 return <section className="messages" aria-labelledby="messages-title"><h2 id="messages-title">Wiadomości <span>{inbox.filter(x=>x.unread).length>0?'●':''}</span></h2>
 <p className="muted">Prywatne rozmowy z Twoją ekipą. Wybierz „Napisz” przy znajomym, aby zacząć.</p>
 {error&&<p role="status">{error} <button onClick={()=>void refresh()}>Ponów</button></p>}
 <div className="message-layout"><nav aria-label="Rozmowy">{inbox.map(p=><button key={p.player_id} aria-pressed={selected?.player_id===p.player_id} onClick={()=>onSelect(p)}><strong>{avatars[p.avatar_key]} {p.display_name}{p.unread?' · Nowa':''}</strong><small>@{p.handle}</small><span>{p.preview}</span></button>)}{loaded&&!inbox.length&&<p className="muted">Tutaj pojawią się Twoje rozmowy.</p>}</nav>
 {selected?<Thread key={owner+selected.player_id} owner={owner} peer={selected} onRead={refresh} onClose={()=>onSelect(null)}/>:<p className="muted">Wybierz rozmowę lub znajomego.</p>}</div>
 </section>;
}
function Thread({owner,peer,onRead,onClose}:{owner:string;peer:Profile;onRead:()=>Promise<void>;onClose:()=>void}){
 const [messages,setMessages]=useState<Message[]>([]),[body,setBody]=useState(''),[notice,setNotice]=useState(''),[canSend,setCanSend]=useState(false),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[more,setMore]=useState(false),[olderBusy,setOlderBusy]=useState(false),[pending,setPending]=useState<{id:string;body:string}|null>(null);
 const alive=useRef(true),locked=useRef(false),loading=useRef(false),lastRead=useRef('0'),scroll=useRef<HTMLDivElement>(null),nearBottom=useRef(true);
 const load=useCallback(async()=>{
  if(loading.current)return;loading.current=true;
  try{const data=await api(owner,'history',{p_peer:peer.player_id});if(!alive.current)return;
   const rows=data.messages as Message[];setCanSend(data.can_send);setLoaded(true);
   setMessages(old=>{
    const overlap=!old.length||rows.length<50||rows.some(r=>r.id===old[old.length-1].id);
    const combined=new Map((overlap?old:[]).map(m=>[m.id,m]));rows.forEach(m=>combined.set(m.id,m));
    return [...combined.values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
   });
   if(rows.length===50)setMore(true);
  }catch(e){if(alive.current)setNotice(e instanceof Error?e.message:'Nie udało się odczytać rozmowy.');}
  finally{loading.current=false;}
 },[owner,peer.player_id]);
 useEffect(()=>{alive.current=true;void load();const tick=()=>{if(!document.hidden)void load();};const timer=setInterval(tick,5000);window.addEventListener('focus',tick);document.addEventListener('visibilitychange',tick);return()=>{alive.current=false;clearInterval(timer);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',tick);};},[load]);
 useEffect(()=>{
  if(nearBottom.current&&scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;
  const last=messages.at(-1)?.id;
  if(last&&last!==lastRead.current&&nearBottom.current&&!document.hidden&&document.hasFocus()){
   void api(owner,'read',{p_peer:peer.player_id,p_read:last}).then(()=>{if(alive.current){lastRead.current=last;void onRead();}}).catch(()=>{});
  }
 },[messages,owner,peer.player_id,onRead]);
 async function older(){
  if(olderBusy||!messages.length)return;setOlderBusy(true);
  try{const data=await api(owner,'history',{p_peer:peer.player_id,p_before:messages[0].id});if(!alive.current)return;
   setMore(data.messages.length===50);nearBottom.current=false;
   setMessages(old=>{const map=new Map<string,Message>(old.map(m=>[m.id,m]));(data.messages as Message[]).forEach(m=>map.set(m.id,m));return [...map.values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);});
  }catch(e){if(alive.current)setNotice(e instanceof Error?e.message:'Błąd historii.');}
  finally{if(alive.current)setOlderBusy(false);}
 }
 async function send(e:FormEvent){
  e.preventDefault();if(locked.current)return;
  const job=pending??{id:crypto.randomUUID(),body:body.trim()};if(!job.body)return;
  locked.current=true;setBusy(true);setPending(job);setNotice('');
  try{await api(owner,'send',{p_peer:peer.player_id,p_body:job.body,p_request:job.id});if(!alive.current)return;
   setPending(null);setBody('');setNotice('Wysłano.');nearBottom.current=true;await load();void onRead();
  }catch(e){if(alive.current)setNotice((e instanceof Error?e.message:'Błąd wysyłania.')+' Treść zachowana. Kliknij „Ponów wysyłanie”.');}
  finally{locked.current=false;if(alive.current)setBusy(false);}
 }
 return <div className="message-thread"><div className="friends-heading"><h3>{peer.display_name} <small>@{peer.handle}</small></h3><button onClick={onClose}>Zamknij</button></div>
 <div className="message-history" ref={scroll} onScroll={()=>{const el=scroll.current;if(el)nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}}>
 {more&&<button disabled={olderBusy} onClick={()=>void older()}>{olderBusy?'Wczytuję…':'Starsze wiadomości'}</button>}
 {!loaded?<p>Wczytuję rozmowę…</p>:!messages.length?<p className="muted">Napisz pierwsze „cześć” 👋</p>:messages.map(m=><article className={m.sender_id===owner?'message own':'message'} key={m.id}><small>{m.sender_id===owner?'Ty':peer.display_name} · {new Date(m.created_at).toLocaleString('pl-PL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small><p>{m.body}</p></article>)}
 </div><p role="status" aria-live="polite">{notice}</p>
 {loaded&&!canSend&&<p>Nie jesteście już znajomymi. Historia pozostaje dostępna, ale wysyłanie jest wyłączone.</p>}
 <form onSubmit={send}><label htmlFor="message-body">Twoja wiadomość</label><textarea id="message-body" value={pending?.body??body} disabled={busy||!!pending||!canSend} onChange={e=>setBody(e.target.value)} maxLength={2000} rows={3} placeholder="Napisz coś…" required/><small>{(pending?.body??body).length}/2000 · Enter: nowy wiersz</small><button type="submit" disabled={busy||!canSend||!(pending?.body??body).trim()}>{busy?'Wysyłam…':pending?'Ponów wysyłanie':'Wyślij'}</button></form>
 <small>Nowe wiadomości pojawiają się co kilka sekund. Niedokończona wiadomość pozostaje tylko w tym otwartym oknie rozmowy.</small>
 </div>;
}
