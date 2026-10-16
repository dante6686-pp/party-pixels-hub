import {getClient,type Profile} from './client';
export type Rating={average:number|null;votes:number;mine:number|null};
export type Comment=Pick<Profile,'player_id'|'handle'|'display_name'|'avatar_key'>&{id:string;body:string;created_at:string};
export type Rank=Pick<Profile,'player_id'|'handle'|'display_name'|'avatar_key'>&{value:number;attempts:number;place:number;verification_status:string};
const errors:Record<string,string>={PLAYER_CHANGED:'Sesja się zmieniła. Zaloguj się ponownie.',PROFILE_REQUIRED:'Potwierdź e-mail i zapisz profil, aby opublikować opinię.',INVALID_RATING:'Wybierz ocenę od 1 do 5.',INVALID_COMMENT:'Komentarz musi mieć od 1 do 1000 znaków.',COMMENT_LIMIT:'Limit komentarzy: 3 na minutę i 30 na dobę. Spróbuj później.',RATE_LIMIT:'Odczekaj chwilę przed zmianą oceny.',REPORT_LIMIT:'Limit 10 zgłoszeń komentarzy na dobę.',COMMENT_REMOVED:'Ten komentarz został już usunięty.',FORBIDDEN:'Nie możesz usunąć tego komentarza.',CONTACT_UNAVAILABLE:'Ta treść jest niedostępna.',DUPLICATE_CONFLICT:'Ta próba ma już inną treść. Odśwież stronę.'};
export function communityError(error:unknown){return error instanceof Error?errors[error.message]??'Nie udało się połączyć. Spróbuj ponownie.':'Nie udało się połączyć. Spróbuj ponownie.';}
export async function writeFeedback(owner:string,game:string,action:string,args:Record<string,unknown>={}){
 const client=getClient();if(!client)throw Error('OFFLINE');
 const {data:session,error:authError}=await client.auth.getUser();if(authError||session.user?.id!==owner)throw Error('PLAYER_CHANGED');
 const {data,error}=await client.rpc('pp_game_feedback_write',{p_owner:owner,p_game:game,p_action:action,...args}).abortSignal(AbortSignal.timeout(12000));
 if(error)throw Error(error.message);return data;
}
export function scoreLabel(game:string,value:number){return game==='quick-math'?`${value} / 5 pkt`:`${value} ms błędu`;}
