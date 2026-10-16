export const PROTOCOL_VERSION = 1;
export type PublicPlayer = {
  playerId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
};
export type ScoreRequest = {
  sessionId: string;
  requestId: string;
  result: { value: number };
};
export type GameSession = {
  id: string;
  playerId: string;
  gameId: string;
  expiresAt: number;
};
export class PlatformError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.name = 'PlatformError';
    this.code = code;
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
/** Explicit projection: never forward auth records or tokens to games. */
export function publicPlayer(value: PublicPlayer): PublicPlayer {
  return {
    playerId: value.playerId, handle: value.handle,
    displayName: value.displayName, avatarUrl: value.avatarUrl,
  };
}
export function parseScoreRequest(value: unknown): ScoreRequest {
  if (!record(value) || !exactKeys(value, ['sessionId', 'requestId', 'result']) ||
      typeof value.sessionId !== 'string' || !uuid.test(value.sessionId) ||
      typeof value.requestId !== 'string' || !uuid.test(value.requestId) ||
      !record(value.result) || !exactKeys(value.result, ['value']) ||
      !Number.isSafeInteger(value.result.value)) {
    throw new PlatformError('INVALID_RESULT');
  }
  return {sessionId: value.sessionId, requestId: value.requestId, result: {value: value.result.value as number}};
}
/** Run on the server using authenticated identity and a database-loaded session.
 * This validates ownership and shape, NOT whether the reported gameplay is honest.
 * Persistence must lock/recheck the session and deduplicate within its transaction.
 */
export function validateSubmission(input: {
  authenticatedPlayerId: string | null;
  session: GameSession;
  request: unknown;
  now: number;
  metric: {minimum: number; maximum: number};
}) {
  if (!input.authenticatedPlayerId) throw new PlatformError('AUTH_REQUIRED');
  if (input.session.playerId !== input.authenticatedPlayerId) throw new PlatformError('FORBIDDEN');
  if (!Number.isFinite(input.now) || !Number.isFinite(input.session.expiresAt) || input.now >= input.session.expiresAt) {
    throw new PlatformError('SESSION_EXPIRED');
  }
  const request = parseScoreRequest(input.request);
  if (request.sessionId !== input.session.id) throw new PlatformError('FORBIDDEN');
  const {minimum, maximum} = input.metric;
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || minimum > maximum ||
      request.result.value < minimum || request.result.value > maximum) throw new PlatformError('INVALID_RESULT');
  return {
    playerId: input.authenticatedPlayerId, gameId: input.session.gameId,
    sessionId: input.session.id, requestId: request.requestId, value: request.result.value,
    verificationStatus: 'unverified' as const,
  };
}
export function bestResult(current: number | null, candidate: number, direction: 'asc' | 'desc') {
  if (current === null) return candidate;
  return direction === 'asc' ? Math.min(current, candidate) : Math.max(current, candidate);
}
