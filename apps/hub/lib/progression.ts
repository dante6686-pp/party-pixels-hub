import {getClient} from './client';
export const tasks=[
 {key:'round',title:'Rozgrzewka',description:'Ukończ rundę Szybkiej piątki.',points:10,href:'/play/quick-math'},
 {key:'perfect',title:'Celna piątka',description:'Zdobądź 5/5 w Szybkiej piątce.',points:20,href:'/play/quick-math'},
 {key:'timing',title:'Wyczucie czasu',description:'Złap 2 sekundy z błędem do 0,2 s.',points:15,href:'/play/two-seconds'},
 {key:'duel',title:'Gramy razem',description:'Ukończ pojedynek — obaj gracze zatwierdzają odpowiedzi.',points:20,href:'/duel'},
 {key:'rematch',title:'Rewanż!',description:'Ukończ kolejną rundę w tym samym pokoju.',points:15,href:'/duel'},
 {key:'days',title:'Wracamy do gry',description:'Zagraj w trzy różne dni. Nie muszą być kolejne.',points:20,href:'/#games'},
] as const;
export const rewards=[{key:'welcome',points:10,title:'Pierwsze kroki',description:'Pamiątkowe wyróżnienie uczestnika.'},{key:'frame',points:40,title:'Ramka Starter',description:'Złota ramka avatara.'},{key:'banner',points:70,title:'Baner Starter',description:'Limonkowo-złote tło profilu.'},{key:'finish',points:100,title:'Dusza imprezy',description:'Odznaka ukończenia i tytuł pod nickiem.'}] as const;
export const badgeArt={level10:{title:'Poziom 10',description:'Osiągnij co najmniej 10. poziom (900 XP).'},starter:{title:'Dusza imprezy',description:'Ukończ Starter Challenge i odbierz nagrodę 100 pkt.'},event:{title:'Bywalec wydarzeń',description:'Specjalne wyróżnienie przyznawane przez administratora za udział w wydarzeniu.'},secret:{title:'Odkrywca sekretów',description:'Specjalne wyróżnienie przyznawane przez administratora za odkrycie sekretu.'}};
export type BadgeKey=keyof typeof badgeArt;
export type ProgressProfile={level:number|null;welcome:boolean;frame:boolean;banner:boolean;title:string|null;badges:BadgeKey[];pinned:BadgeKey[]};
export type Starter={points:number;tasks:{key:string;claimed:boolean}[];rewards:string[];pixels:number;xp:number;days:number;profile:ProgressProfile};
export async function starterApi(action='get',args:Record<string,unknown>={}):Promise<Starter>{const client=getClient();if(!client)throw Error('Brak połączenia.');const {data,error}=await client.rpc('pp_starter',{p_action:action,...args}).abortSignal(AbortSignal.timeout(12000));if(error)throw Error(({TASK_LOCKED:'Najpierw ukończ zadanie.',REWARD_LOCKED:'Ta nagroda jest jeszcze zablokowana.',PROFILE_REQUIRED:'Zaloguj się, potwierdź e-mail i zapisz profil.',BADGE_LOCKED:'Możesz wyróżniać tylko zdobyte odznaki.'}as Record<string,string>)[error.message]??'Nie potwierdzono operacji. Odśwież i spróbuj ponownie.');return data;}
