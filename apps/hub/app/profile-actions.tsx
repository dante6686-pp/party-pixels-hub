'use client';
import {useCallback,useEffect,useState} from 'react';
import {getClient,type Profile} from '../lib/client';
import ReportButton,{safety} from './report-button';
type Relationship={relation:string;request_id:string}|null;
export default function ProfileActions({peer}:{peer:Profile}){
 const [owner,setOwner]=useState<string|null>(null),[authLoaded,setAuthLoaded]=useState(false),[loaded,setLoaded]=useState(false),[relation,setRelation]=useState<Relationship>(null),[blocked,setBlocked]=useState(false),[allowed,setAllowed]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[confirm,setConfirm]=useState(false);
 useEffect(()=>{
  const client=getClient();if(!client){setAuthLoaded(true);return;}let alive=true;let revision=0;
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{revision++;if(alive){setOwner(session?.user.id??null);setAuthLoaded(true);}});
  const initial=revision;void client.auth.getUser().then(({data})=>{if(alive&&initial===revision){setOwner(data.user?.id??null);setAuthLoaded(true);}}).catch(()=>{if(alive)setAuthLoaded(true);});
  return()=>{alive=false;subscription.unsubscribe();};
 },[]);
 const refresh=useCallback(async()=>{
  if(!owner||owner===peer.player_id)return;
  const [status,friends]=await Promise.all([safety(owner,'status',{p_peer:peer.player_id}),getClient()!.rpc('pp_friends',{p_owner:owner,p_action:'list'}).abortSignal(AbortSignal.timeout(12000))]);
  if(friends.error)throw friends.error;
  return {status,relationship:friends.data.find((p:Profile)=>p.player_id===peer.player_id)??null};
 },[owner,peer.player_id]);
 useEffect(()=>{
  let alive=true;setLoaded(false);setNotice('');setBlocked(false);setAllowed(false);setRelation(null);setConfirm(false);
  if(owner&&owner!==peer.player_id)void refresh().then(r=>{if(alive&&r){setRelation(r.relationship);setBlocked(r.status.blocked_by_me);setAllowed(r.status.contact_allowed);setLoaded(true);}}).catch(()=>{if(alive)setNotice('Nie udało się sprawdzić kontaktu. Potwierdź e-mail i zapisz swój profil, a potem odśwież stronę.');});
  return()=>{alive=false;};
 },[refresh,owner,peer.player_id]);
 async function act(action:string){
  if(!owner||busy)return;setBusy(true);setNotice('');
  try{
   if(action==='block'||action==='unblock')await safety(owner,action,{p_peer:peer.player_id});
   else {const {error}=await getClient()!.rpc('pp_friends',{p_owner:owner,p_action:action,p_target:peer.player_id,p_request:relation?.request_id??null}).abortSignal(AbortSignal.timeout(12000));if(error)throw error;}
   const r=await refresh();if(r){setRelation(r.relationship);setBlocked(r.status.blocked_by_me);setAllowed(r.status.contact_allowed);}
   setConfirm(false);setNotice({block:'Gracz zablokowany. Nowe wiadomości i zaproszenia są zatrzymane.',unblock:'Gracz odblokowany. Możecie ponownie dodać się do znajomych.',send:'Zaproszenie wysłane.',accept:'Jesteście znajomymi!',cancel:'Zaproszenie cofnięte.',decline:'Zaproszenie odrzucone.'}[action]??'Zapisano.');
  }catch{setNotice('Nie potwierdzono zmiany. Odśwież stronę i sprawdź aktualny stan.');}
  finally{setBusy(false);}
 }
 if(!authLoaded)return <p role="status">Sprawdzam kontakt…</p>;
 if(!owner)return <div className="profile-actions"><a className="profile-edit" href="/#profile">Zaloguj się, aby nawiązać kontakt ↗</a></div>;
 if(owner===peer.player_id)return <div className="profile-actions"><a className="profile-edit" href="/#profile">Twój profil — przejdź do edycji ↗</a></div>;
 return <section className="profile-actions" aria-label="Kontakt z graczem">
 {loaded&&<><div className="profile-action-row">{allowed&&!blocked&&(relation?.relation==='friend'?<a className="profile-edit" href={'/#chat/'+peer.handle}>Napisz wiadomość ↗</a>:relation?.relation==='incoming'?<><button disabled={busy} onClick={()=>void act('accept')}>Przyjmij zaproszenie</button><button disabled={busy} onClick={()=>void act('decline')}>Odrzuć</button></>:relation?.relation==='outgoing'?<button disabled={busy} onClick={()=>void act('cancel')}>Cofnij zaproszenie</button>:<button disabled={busy} onClick={()=>void act('send')}>Dodaj do znajomych</button>)}
 {blocked?<button disabled={busy} onClick={()=>void act('unblock')}>Odblokuj gracza</button>:<button disabled={busy} onClick={()=>setConfirm(true)}>Zablokuj gracza</button>}
 <ReportButton owner={owner} peer={peer.player_id}/></div>
 {!allowed&&!blocked&&<p className="muted">Kontakt z tym graczem jest obecnie niedostępny.</p>}
 {confirm&&<div className="block-confirm"><p>Zablokować gracza? Usuniemy znajomość i zatrzymamy wiadomości oraz zaproszenia w obie strony.</p><button disabled={busy} onClick={()=>void act('block')}>Tak, zablokuj</button><button disabled={busy} onClick={()=>setConfirm(false)}>Anuluj</button></div>}</>}
 {notice&&<p role="status" className="notice">{notice}</p>}</section>;
}
export function BlockedPlayers({owner}:{owner:string}){
 const [rows,setRows]=useState<Profile[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let alive=true;void safety(owner,'blocks').then(data=>{if(alive)setRows(data);}).catch(()=>{if(alive)setNotice('Nie udało się odczytać blokad.');});return()=>{alive=false;};},[owner,attempt]);
 async function unblock(peer:string){if(busy)return;setBusy(true);try{await safety(owner,'unblock',{p_peer:peer});setAttempt(a=>a+1);setNotice('Odblokowano gracza. Znajomość wymaga ponownego zaproszenia.');}catch{setNotice('Nie potwierdzono odblokowania. Spróbuj ponownie.');}finally{setBusy(false);}}
 return <section className="blocked-players"><h2>Zablokowani gracze</h2>{rows.length?<ul>{rows.map(p=><li key={p.player_id}><a href={'/u/'+p.handle}>{p.display_name} · @{p.handle}</a><button disabled={busy} onClick={()=>void unblock(p.player_id)}>Odblokuj</button></li>)}</ul>:<p className="muted">Nie masz zablokowanych graczy.</p>}<button className="text-button" onClick={()=>setAttempt(a=>a+1)}>Odśwież blokady</button>{notice&&<p role="status">{notice}</p>}</section>;
}
