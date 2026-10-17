import {getClient} from './client';
export async function platformApi(owner:string,name:string,args:Record<string,unknown>={}){
 const client=getClient();if(!client)throw Error('Brak połączenia.');
 const {data,error}=await client.rpc(name,{p_owner:owner,...args}).abortSignal(AbortSignal.timeout(12000));
 if(error)throw Error(({MODERATOR_REQUIRED:'Brak uprawnień moderatora.',PROFILE_REQUIRED:'Potwierdź e-mail i zapisz profil.',PLAYER_CHANGED:'Sesja się zmieniła. Zaloguj się ponownie.',INVITES_DISABLED:'Ten gracz nie przyjmuje zaproszeń.',COMMENT_UNAVAILABLE:'Ten wątek jest niedostępny.',COMMENT_LIMIT:'Limit: 3 komentarze na minutę i 30 na dobę.',PROTECTED_ACCOUNT:'Tego konta nie można zablokować.',DUPLICATE_CONFLICT:'Ta próba ma już inną treść.'} as Record<string,string>)[error.message]??'Operacja nie powiodła się. Spróbuj ponownie.');
 return data;
}
