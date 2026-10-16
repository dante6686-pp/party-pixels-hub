'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {getClient} from '../lib/client';
export async function safety(owner:string,action:string,args:Record<string,unknown>={}){
 const client=getClient();if(!client)throw new Error('Brak połączenia.');
 const {data,error}=await client.rpc('pp_safety',{p_owner:owner,p_action:action,...args}).abortSignal(AbortSignal.timeout(12000));
 if(error)throw new Error(error.message==='REPORT_LIMIT'?'Limit 10 zgłoszeń na dobę. Spróbuj później.':'Nie potwierdzono operacji. Spróbuj ponownie.');return data;
}
export default function ReportButton({owner,peer,message}:{owner:string;peer:string;message?:string}){
 const [open,setOpen]=useState(false),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),request=useRef<string|null>(null),pending=useRef<{reason:string;details:string}|null>(null);
 useEffect(()=>{if(open){dialog.current?.showModal();request.current=crypto.randomUUID();pending.current=null;}},[open]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;const form=new FormData(e.currentTarget);
  const payload=pending.current??{reason:String(form.get('reason')),details:String(form.get('details')??'')};pending.current=payload;
  setBusy(true);setNotice('');
  try{await safety(owner,message?'report_message':'report_profile',{p_peer:peer,p_message:message??null,p_reason:payload.reason,p_details:payload.details,p_request:request.current});dialog.current?.close();setOpen(false);setNotice('Zgłoszenie zapisane do sprawdzenia.');}
  catch(e){setNotice(e instanceof Error?e.message:'Błąd zgłoszenia.');}finally{setBusy(false);}
 }
 return <><button className="report-button" onClick={()=>{setOpen(true);setNotice('');}}>Zgłoś {message?'wiadomość':'profil'}</button>{notice&&<small role="status">{notice}</small>}{open&&<dialog ref={dialog} className="report-dialog" onCancel={e=>{if(busy)e.preventDefault();else setOpen(false);}}><form onSubmit={submit}><h2>{message?'Zgłoś wiadomość':'Zgłoś profil'}</h2><p>Zgłoszenie zapisze treść wskazanej wiadomości lub publiczne dane profilu do sprawdzenia. Zgłoszony gracz nie widzi Twojego zgłoszenia.</p><fieldset disabled={busy||!!pending.current}><label>Powód<select name="reason" required><option value="harassment">Nękanie lub obraźliwe zachowanie</option><option value="spam">Spam</option><option value="inappropriate">Nieodpowiednia treść</option><option value="other">Inny powód</option></select></label><label>Dodatkowe informacje<textarea name="details" maxLength={1000} rows={3}/></label></fieldset><button className="primary" disabled={busy} type="submit">{busy?'Zapisuję…':pending.current?'Ponów zgłoszenie':'Wyślij zgłoszenie'}</button><button className="text-button" disabled={busy} type="button" onClick={()=>{dialog.current?.close();setOpen(false);pending.current=null;}}>Anuluj</button></form></dialog>}</>;
}
