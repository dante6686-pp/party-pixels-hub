// Host-owned catalog: the frame never selects a game, URL or account.
export const GAME = {
  id: 'magazyn-auto',
  build: 'magazyn-auto-pp-1',
  title: 'MAGAZYN AUTO',
  subtitle: 'Wielka Szychta',
  url: '/games/magazyn-auto/index.html',
} as const;
export const PROTOCOL = 1;
export type InputMode = 'touch' | 'keyboard';
export type Checkpoint = {mission: number; cash: number};
export type GamePlayer = {playerId: string; displayName: string; avatar: string};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export function checkpoint(value: unknown): Checkpoint | null {
  if (!record(value) || Object.keys(value).length !== 2 ||
    !Number.isSafeInteger(value.mission) || !Number.isSafeInteger(value.cash) ||
    (value.mission as number) < 0 || (value.mission as number) > 3 ||
    (value.cash as number) < 0 || (value.cash as number) > 1_000_000_000) return null;
  return {mission: value.mission as number, cash: value.cash as number};
}
export function isReady(value: unknown): boolean {
  return record(value) && value.type === 'pp:ready' && value.protocol === PROTOCOL && value.build === GAME.build;
}
export function acceptsHandshake(event:{source:unknown;origin:string;data:unknown},selectedFrame:unknown):boolean {
  return selectedFrame != null && event.source === selectedFrame && event.origin === 'null' && isReady(event.data);
}
export type FrameMessage =
  | {type: 'progress'; mission: number}
  | {type: 'state'; state: 'menu' | 'playing' | 'paused' | 'complete' | 'busted'}
  | {type: 'input-detected'; mode: InputMode}
  | {type: 'save'; checkpoint: Checkpoint; requestId: number}
  | {type: 'error'};
export function frameMessage(value: unknown): FrameMessage | null {
  if (!record(value)) return null;
  if(value.type==='progress' && Number.isInteger(value.mission) && (value.mission as number)>=0 && (value.mission as number)<=3)
    return {type:'progress',mission:value.mission as number};
  if (value.type === 'error') return {type: 'error'};
  if (value.type === 'input-detected' && (value.mode === 'touch' || value.mode === 'keyboard'))
    return {type: 'input-detected', mode: value.mode};
  if (value.type === 'state' && ['menu','playing','paused','complete','busted'].includes(String(value.state)))
    return {type: 'state', state: value.state as Extract<FrameMessage,{type:'state'}>['state']};
  if (value.type === 'save' && Number.isSafeInteger(value.requestId) && (value.requestId as number) > 0) {
    const data = checkpoint(value.checkpoint);
    if (data) return {type: 'save', checkpoint: data, requestId: value.requestId as number};
  }
  return null;
}
export function saveKey(playerId: string | null): string {
  return `party-pixels:save:v1:${GAME.id}:${playerId ?? 'guest'}`;
}
export function campaignTitle(mission:number):string {
  return mission>=3?'Kampania ukończona · Wolna jazda':`Kampania · Misja ${mission+1}/3`;
}
