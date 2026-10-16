export type Player = {playerId:string;handle:string;displayName:string;avatar:string};
export type GameId = 'quick-math' | 'two-seconds';
export type Session = {sessionId:string;gameId:GameId;rulesetVersion:1;challenge: {a:number;b:number}[] | {targetMs:number}};
export type Receipt = {submissionId:string;sessionId:string;gameId:GameId;value:number;unit:'points'|'milliseconds';verificationStatus:'validated'|'unverified'};
type Host = {player:Player; invoke:(operation:'start'|'submit',args:Record<string,unknown>)=>Promise<unknown>};
/** Trusted in-hub adapter. No auth tokens are part of the game API.
 * Untrusted external games still require the separately planned iframe bridge.
 */
export function createPlatformClient(host:Host) {
  const player:Player={playerId:host.player.playerId,handle:host.player.handle,displayName:host.player.displayName,avatar:host.player.avatar};
  return {
    player:{get:()=>({...player})},
    sessions:{start:async(gameId:GameId)=>await host.invoke('start',{gameId}) as Session},
    scores:{submit:async(sessionId:string,requestId:string,result:Record<string,unknown>)=>await host.invoke('submit',{sessionId,requestId,result}) as Receipt},
  };
}
