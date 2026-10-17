import {getClient} from './client';
export type LibraryGame='magazyn-auto'|'quick-math'|'two-seconds'|'nocna-portiernia';
export async function recordPlayed(owner:string,game:LibraryGame){
 const client=getClient();if(!client)return;
 const {error}=await client.rpc('pp_library',{p_owner:owner,p_action:'played',p_game:game}).abortSignal(AbortSignal.timeout(10000));
 if(!error)window.dispatchEvent(new Event('party-pixels:library'));
}
