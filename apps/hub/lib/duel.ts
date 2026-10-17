import {getClient} from './client';
export type DuelInvite={id:string;host:string;guest:string;state:string;round:number;display_name:string;handle:string;expires_at:string};
export type Duel={id:string;state:string;round:number;host:string;guest:string;host_ready:boolean;guest_ready:boolean;starts_at:string|null;expires_at:string;server_now:string;host_seen:string;guest_seen:string|null;questions:{a:number;b:number;op:string}[]|null;submitted:boolean;peer_submitted:boolean;host_score:number|null;guest_score:number|null;host_ms:number|null;guest_ms:number|null;winner:string|null;reason:string|null;players:{id:string;name:string;handle:string;avatar:string}[]};
export async function duelApi(action:string,args:Record<string,unknown>={}){
 const client=getClient();if(!client)throw Error('Brak połączenia.');
 const {data,error}=await client.rpc('pp_duel',{p_action:action,...args}).abortSignal(AbortSignal.timeout(10000));
 if(error)throw Error(({PROFILE_REQUIRED:'Zaloguj się, potwierdź e-mail i zapisz profil.',ROOM_UNAVAILABLE:'Ten pokój jest niedostępny dla Twojego konta.',FRIENDS_ONLY:'Możesz zaprosić dostępną osobę z Twoich znajomych.',PLAYER_BUSY:'Ty lub znajomy macie już aktywny pokój. Otwórz go lub poczekaj na zakończenie.',INVITE_LIMIT:'Limit: 20 nowych zaproszeń na dobę.',STALE_ROUND:'Runda już się zmieniła. Odśwież pokój.',INVALID_ANSWERS:'Wpisz odpowiedzi jako liczby.'}as Record<string,string>)[error.message]??'Nie potwierdzono operacji. Odśwież pokój i spróbuj ponownie.');
 return data;
}
