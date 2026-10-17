'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {avatars,getClient} from '../lib/client';
import {communityError,scoreLabel,writeFeedback,type Comment,type Rank,type Rating} from '../lib/community';
import {profileHref} from './profile-card';
import {useViewer} from './use-viewer';
import {platformApi} from '../lib/platform';

export default function GameCommunity({game}:{game:string}){
 const viewer=useViewer();
 return <div className="game-community">{['quick-math','two-seconds'].includes(game)&&<GameRanking key={'rank-'+(viewer.owner??'guest')} game={game} owner={viewer.owner}/>}<GameFeedback key={viewer.owner??'guest'} game={game} owner={viewer.owner} canWrite={!!viewer.owner&&viewer.ready} authLoading={viewer.loading}/></div>;
}
function GameRanking({game,owner}:{game:string;owner?:string}){
 const [data,setData]=useState<{rows:Rank[];mine:Rank|null}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const revision=useRef(0);
 const load=useCallback(async()=>{
  const client=getClient();if(!client){setError('Ranking jest chwilowo niedostępny.');return;}
  const version=++revision.current;setLoading(true);setError('');
  const {data,error}=await client.rpc('pp_game_ranking',{p_game:game}).abortSignal(AbortSignal.timeout(12000));
  if(version!==revision.current)return;setLoading(false);
  if(error)setError('Nie udało się wczytać rankingu.');else setData(data);
 },[game]);
 useEffect(()=>{if(['quick-math','two-seconds'].includes(game))void load();return()=>{revision.current++;};},[load,game]);
 return <section className="community-panel" aria-labelledby="game-ranking-title"><div className="community-heading"><div><p className="eyebrow">REKORDY GRACZY</p><h2 id="game-ranking-title">Ranking</h2></div>{['quick-math','two-seconds'].includes(game)&&<button className="community-button" disabled={loading} onClick={()=>void load()}>Odśwież ranking</button>}</div>
 {!['quick-math','two-seconds'].includes(game)?<p className="muted">Ta gra nie ma rankingu punktowego. Informacje o zapisie znajdziesz wyżej.</p>:<><p className="community-hint">{game==='quick-math'?'Więcej punktów = lepsze miejsce. Odpowiedzi sprawdza serwer.':'Mniejszy błąd = lepsze miejsce. Czas mierzy przeglądarka — wyniki nie są zweryfikowane.'} Remisy zajmują to samo miejsce.</p>
 {error&&<p role="status">{error}</p>}{!data&&loading&&<p role="status">Wczytuję ranking…</p>}
 {data&&<><div className="my-record"><strong>Twój rekord</strong>{owner?(data.mine?<p><b>{scoreLabel(game,data.mine.value)}</b> · miejsce {data.mine.place} · prób: {data.mine.attempts}</p>:<p>Jeszcze bez wyniku. Rozegraj pierwszą rundę!</p>):<p><a href="/#profile">Zaloguj się</a>, aby zobaczyć swój rekord i miejsce.</p>}</div>
 {data.rows.length?<div className="ranking-scroll"><table className="game-ranking"><caption>Top 20 graczy</caption><thead><tr><th scope="col">Miejsce</th><th scope="col">Gracz</th><th scope="col">Wynik</th></tr></thead><tbody>{data.rows.map(row=><tr key={row.player_id} className={row.player_id===owner?'ranking-me':undefined}><td>{row.place}</td><td><a href={profileHref(row.handle)}><span aria-hidden="true">{avatars[row.avatar_key]}</span> {row.display_name}<small>@{row.handle}{row.player_id===owner?' · Ty':''}</small></a></td><td>{scoreLabel(game,row.value)}</td></tr>)}</tbody></table></div>:<p className="community-empty">Ranking czeka na pierwszych graczy.</p>}</>}
 </>}
 </section>;
}
function GameFeedback({game,owner,canWrite,authLoading}:{game:string;owner?:string;canWrite:boolean;authLoading:boolean}){
 const [rating,setRating]=useState<Rating>({average:null,votes:0,mine:null}),[stars,setStars]=useState(0),[comments,setComments]=useState<Comment[]>([]),[body,setBody]=useState('');
 const [loaded,setLoaded]=useState(false),[loading,setLoading]=useState(false),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[remove,setRemove]=useState<string|null>(null);
 const [pending,setPending]=useState<{id:string;body:string}|null>(null);
 const revision=useRef(0),alive=useRef(true),locked=useRef(false);
 const load=useCallback(async(before?:string)=>{
  const client=getClient();if(!client){setError('Opinie są chwilowo niedostępne.');return;}
  const version=++revision.current;setLoading(true);setError('');
  const {data,error}=await client.rpc('pp_game_feedback',{p_game:game,p_before:before??null}).abortSignal(AbortSignal.timeout(12000));
  if(!alive.current||version!==revision.current)return;
  setLoading(false);
  if(error){setError('Nie udało się wczytać opinii. Spróbuj ponownie.');return;}
  setLoaded(true);setRating(data.rating);setStars(data.rating.mine??0);setMore(data.comments.length===20);
  setComments(old=>before?[...new Map<string,Comment>([...old,...data.comments].map((c:Comment)=>[c.id,c])).values()]:data.comments);
 },[game]);
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;revision.current++;};},[load]);
 useEffect(()=>{let current=true;async function reveal(){const id=window.location.hash.match(/^#comment-(\d+)$/)?.[1];if(!id)return;const client=getClient();if(!client)return;const {data,error}=await client.rpc('pp_comment_thread',{p_owner:owner??null,p_game:game,p_parent:id,p_action:'root'}).abortSignal(AbortSignal.timeout(12000));if(!current)return;if(error||!data){setNotice('Ten komentarz jest już niedostępny.');return;}setComments(old=>old.some(c=>c.id===id)?old:[data,...old]);requestAnimationFrame(()=>document.getElementById('comment-'+id)?.scrollIntoView({block:'center'}));}void reveal();window.addEventListener('hashchange',reveal);return()=>{current=false;window.removeEventListener('hashchange',reveal);};},[game,owner,loaded]);
 async function rate(e:FormEvent){
  e.preventDefault();if(!owner||!canWrite||locked.current||!stars)return;locked.current=true;setBusy(true);setNotice('');
  try{await writeFeedback(owner,game,'rate',{p_stars:stars});if(alive.current){setNotice('Twoja ocena została zapisana.');await load();}}
  catch(e){if(alive.current)setNotice(communityError(e));}finally{locked.current=false;if(alive.current)setBusy(false);}
 }
 async function post(e:FormEvent){
  e.preventDefault();if(!owner||!canWrite||locked.current)return;const job=pending??{id:crypto.randomUUID(),body:body.trim()};if(!job.body)return;
  locked.current=true;setBusy(true);setPending(job);setNotice('');
  try{await writeFeedback(owner,game,'comment',{p_body:job.body,p_request:job.id});if(alive.current){setPending(null);setBody('');setNotice('Komentarz opublikowany.');await load();}}
  catch(e){if(alive.current)setNotice(communityError(e)+' Treść zachowana — możesz ponowić tę samą próbę.');}
  finally{locked.current=false;if(alive.current)setBusy(false);}
 }
 async function removeComment(id:string){
  if(!owner||locked.current)return;locked.current=true;setBusy(true);setNotice('');
  try{await writeFeedback(owner,game,'remove',{p_comment:id});if(alive.current){setRemove(null);setComments(old=>old.filter(c=>c.id!==id));setNotice('Twój komentarz został usunięty.');}}
  catch(e){if(alive.current)setNotice(communityError(e));}finally{locked.current=false;if(alive.current)setBusy(false);}
 }
 return <section className="community-panel" aria-labelledby="game-feedback-title"><div className="community-heading"><div><p className="eyebrow">GŁOS SPOŁECZNOŚCI</p><h2 id="game-feedback-title">Oceny i komentarze</h2></div><button className="community-button" onClick={()=>void load()} disabled={loading||busy}>Odśwież opinie</button></div>
 {error&&<p role="status">{error}</p>}{!loaded&&loading&&<p role="status">Wczytuję opinie…</p>}
 {loaded&&<div className="rating-summary"><span aria-hidden="true">★</span><strong>{rating.average===null?'Brak ocen':Number(rating.average).toLocaleString('pl-PL',{maximumFractionDigits:1})+' / 5'}</strong><small>Głosów: {rating.votes}</small></div>}
 {canWrite?<><form className="rating-form" onSubmit={rate}><fieldset disabled={busy||loading||!!pending}><legend>{rating.mine?'Twoja ocena — możesz ją zmienić':'Jak oceniasz tę grę?'}</legend><div className="rating-options">{[1,2,3,4,5].map(n=><label key={n}><input type="radio" name="game-rating" value={n} checked={stars===n} onChange={()=>setStars(n)}/><span>{n} ★</span></label>)}</div><button className="community-button" disabled={!stars} type="submit">Zapisz ocenę</button></fieldset></form><form className="comment-form" onSubmit={post}><label htmlFor="game-comment-body">Twój komentarz</label><textarea id="game-comment-body" value={pending?.body??body} onChange={e=>setBody(e.target.value)} disabled={busy||!!pending} maxLength={1000} rows={3} required placeholder="Co Ci się podoba? Co warto poprawić?"/><small>{(pending?.body??body).length}/1000 · Komentarz i profil autora są publiczne.</small><button className="community-button" disabled={busy||!(pending?.body??body).trim()} type="submit">{busy?'Zapisuję…':pending?'Ponów publikację':'Dodaj komentarz'}</button></form></>:<p className="community-gate">{authLoading?'Sprawdzam konto…':<><a href="/#profile">{owner?'Uzupełnij profil':'Zaloguj się'}</a>, aby oceniać gry i dodawać komentarze.</>}</p>}
 {notice&&<p className="notice" role="status">{notice}</p>}
 <div className="game-comments">{comments.map(c=><article id={'comment-'+c.id} className="game-comment" key={c.id}><div className="comment-author"><a href={profileHref(c.handle)}><span aria-hidden="true">{avatars[c.avatar_key]}</span><strong>{c.display_name}<small>@{c.handle}</small></strong></a><time dateTime={c.created_at}>{new Date(c.created_at).toLocaleString('pl-PL',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Warsaw'})}</time></div><p>{c.body}</p>{canWrite&&owner&&(c.player_id===owner?<div className="comment-actions">{remove===c.id?<><span>Usunąć Twój komentarz?</span><button className="community-button" disabled={busy} onClick={()=>void removeComment(c.id)}>Tak, usuń</button><button className="community-button" disabled={busy} onClick={()=>setRemove(null)}>Anuluj</button></>:<button className="community-button" disabled={busy} onClick={()=>setRemove(c.id)}>Usuń mój komentarz</button>}</div>:<CommentReport owner={owner} game={game} comment={c.id}/>)}<CommentThread key={(owner??'guest')+c.id} owner={owner} canWrite={canWrite} game={game} parent={c.id} count={c.replies??0}/></article>)}</div>
 {loaded&&!comments.length&&<p className="community-empty">Jeszcze bez komentarzy. Podziel się pierwszą opinią.</p>}
 {more&&<button className="community-button" disabled={loading||busy} onClick={()=>void load(comments.at(-1)?.id)}>{loading?'Wczytuję…':'Starsze komentarze'}</button>}
 </section>;
}
function CommentReport({owner,game,comment}:{owner:string;game:string;comment:string}){
 const dialog=useRef<HTMLDialogElement>(null),pending=useRef<{id:string;reason:string}|null>(null),locked=useRef(false);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
 async function report(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(locked.current)return;const job=pending.current??{id:crypto.randomUUID(),reason:String(new FormData(e.currentTarget).get('reason'))};pending.current=job;
  locked.current=true;setBusy(true);
  try{await writeFeedback(owner,game,'report',{p_comment:comment,p_request:job.id,p_reason:job.reason});dialog.current?.close();setOpen(false);setNotice('Zgłoszenie zapisane do sprawdzenia.');pending.current=null;}
  catch(e){setNotice(communityError(e));}finally{locked.current=false;setBusy(false);}
 }
 return <><button className="report-button" onClick={()=>{setNotice('');pending.current=null;setOpen(true);}}>Zgłoś komentarz</button>{notice&&<small role="status">{notice}</small>}{open&&<dialog className="report-dialog" ref={dialog} onCancel={e=>{if(busy)e.preventDefault();else setOpen(false);}}><form onSubmit={report}><h2>Zgłoś komentarz</h2><p>Treść komentarza zostanie zapisana do sprawdzenia. Autor nie zobaczy Twojego zgłoszenia.</p><label>Powód<select name="reason" disabled={busy||!!pending.current}><option value="harassment">Obraźliwe zachowanie</option><option value="spam">Spam</option><option value="inappropriate">Nieodpowiednia treść</option><option value="other">Inny powód</option></select></label>{notice&&<p role="status">{notice}</p>}<button className="primary" type="submit" disabled={busy}>{busy?'Zapisuję…':pending.current?'Ponów zgłoszenie':'Wyślij zgłoszenie'}</button><button className="text-button" type="button" disabled={busy} onClick={()=>{dialog.current?.close();setOpen(false);}}>Anuluj</button></form></dialog>}</>;
}

function CommentThread({owner,canWrite,game,parent,count}:{owner?:string;canWrite:boolean;game:string;parent:string;count:number}){
 const [open,setOpen]=useState(false),[rows,setRows]=useState<Comment[]>([]),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[more,setMore]=useState(false),[notice,setNotice]=useState(''),[confirm,setConfirm]=useState<string|null>(null);
 const pending=useRef<{id:string;body:string}|null>(null),alive=useRef(true),lock=useRef(false),revision=useRef(0);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;revision.current++;};},[]);
 async function read(after?:string){const client=getClient();if(!client)return;const version=++revision.current;setBusy(true);const {data,error}=await client.rpc('pp_comment_thread',{p_owner:owner??null,p_game:game,p_parent:parent,p_action:'read',p_after:after??null}).abortSignal(AbortSignal.timeout(12000));if(!alive.current||version!==revision.current)return;setBusy(false);if(error){setNotice('Wątek jest niedostępny lub wystąpił błąd połączenia.');return;}setRows(old=>after?[...new Map<string,Comment>([...old,...data].map((c:Comment)=>[c.id,c])).values()]:data);setLoaded(true);setMore(data.length===20);}
 useEffect(()=>{if(window.location.hash==='#comment-'+parent){setOpen(true);void read();}},[]);
 async function post(e:FormEvent){e.preventDefault();if(!owner||!canWrite||lock.current)return;const job=pending.current??{id:crypto.randomUUID(),body:body.trim()};if(!job.body)return;pending.current=job;lock.current=true;setBusy(true);try{await platformApi(owner,'pp_comment_thread',{p_game:game,p_parent:parent,p_action:'post',p_body:job.body,p_request:job.id});if(alive.current){pending.current=null;setBody('');setNotice('Odpowiedź opublikowana.');await read(rows.at(-1)?.id);}}catch(e){if(alive.current)setNotice((e instanceof Error?e.message:'Nie potwierdzono publikacji.')+' Treść zachowana.');}finally{lock.current=false;if(alive.current)setBusy(false);}}
 async function removeReply(id:string){if(!owner||lock.current)return;lock.current=true;setBusy(true);try{await writeFeedback(owner,game,'remove',{p_comment:id});if(alive.current){setRows(old=>old.filter(c=>c.id!==id));setConfirm(null);}}catch(e){if(alive.current)setNotice(communityError(e));}finally{lock.current=false;if(alive.current)setBusy(false);}}
 return <div className="comment-thread"><button className="community-button" aria-expanded={open} onClick={()=>{setOpen(v=>!v);if(!open&&!loaded)void read();}}>Odpowiedzi{count>0?' · '+count:''} {open?'⌃':'⌄'}</button>{open&&<div className="reply-list">{rows.map(c=><article className="game-comment" key={c.id}><div className="comment-author"><a href={profileHref(c.handle)}><span aria-hidden="true">{avatars[c.avatar_key]}</span><strong>{c.display_name}<small>@{c.handle}</small></strong></a><time dateTime={c.created_at}>{new Date(c.created_at).toLocaleString('pl-PL')}</time></div><p>{c.body}</p>{owner&&canWrite&&(c.player_id===owner?<div>{confirm===c.id?<><button className="community-button" disabled={busy} onClick={()=>void removeReply(c.id)}>Tak, usuń odpowiedź</button><button className="community-button" onClick={()=>setConfirm(null)}>Anuluj</button></>:<button className="community-button" disabled={busy} onClick={()=>setConfirm(c.id)}>Usuń moją odpowiedź</button>}</div>:<CommentReport owner={owner} game={game} comment={c.id}/>)}</article>)}{more&&<button className="community-button" disabled={busy} onClick={()=>void read(rows.at(-1)?.id)}>Dalsze odpowiedzi</button>}{!loaded&&<button className="community-button" disabled={busy} onClick={()=>void read()}>{busy?'Wczytuję…':'Ponów wczytywanie'}</button>}{loaded&&!rows.length&&<p>Jeszcze bez odpowiedzi.</p>}{canWrite?<form className="comment-form" onSubmit={post}><label htmlFor={'reply-'+parent}>Twoja odpowiedź</label><textarea id={'reply-'+parent} rows={2} maxLength={1000} required value={pending.current?.body??body} disabled={busy||!!pending.current} onChange={e=>setBody(e.target.value)}/><button className="community-button" disabled={busy||!(pending.current?.body??body).trim()}>{pending.current?'Ponów odpowiedź':'Odpowiedz'}</button></form>:<p><a href="/#profile">Zaloguj się</a>, aby odpowiedzieć.</p>}{notice&&<p role="status">{notice}</p>}</div>}</div>;
}
