import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicPlayer, validateSubmission, bestResult, parseScoreRequest} from '../packages/contracts/src/index.ts';

const sessionId = 'a0000000-0000-4000-8000-000000000001';
const request = {sessionId, requestId: 'b0000000-0000-4000-8000-000000000001', result: {value: 42}};
const base = {
  authenticatedPlayerId: 'player-a',
  session: {id: sessionId, playerId: 'player-a', gameId: 'quiz', expiresAt: 200},
  request, now: 100, metric: {minimum: 0, maximum: 100},
};
test('public profile strips auth fields even if the input contains them', () => {
  const profile = {playerId: 'a', handle: 'patryk', displayName: 'Patryk', avatarUrl: null, email: 'private', access_token: 'secret'};
  assert.deepEqual(Object.keys(publicPlayer(profile)).sort(), ['avatarUrl', 'displayName', 'handle', 'playerId']);
});
test('both games derive the same player from server context', () => {
  const a = validateSubmission(base);
  const b = validateSubmission({...base, session: {...base.session, gameId: 'race'}});
  assert.equal(a.playerId, b.playerId);
  assert.notEqual(a.gameId, b.gameId);
  assert.equal(a.verificationStatus, 'unverified');
});
test('anonymous callers and other accounts cannot submit another player session', () => {
  assert.throws(() => validateSubmission({...base, authenticatedPlayerId: null}), /AUTH_REQUIRED/);
  assert.throws(() => validateSubmission({...base, authenticatedPlayerId: 'player-b'}), /FORBIDDEN/);
});
test('expired session and mismatching session identifiers are rejected', () => {
  assert.throws(() => validateSubmission({...base, now: 200}), /SESSION_EXPIRED/);
  assert.throws(() => validateSubmission({...base, request: {...request, sessionId: request.requestId}}), /FORBIDDEN/);
});
test('client cannot inject a player, XP or verification status', () => {
  for (const extra of [{playerId: 'player-b'}, {xp: 999}, {verified: true}]) {
    assert.throws(() => parseScoreRequest({...request, ...extra}), /INVALID_RESULT/);
  }
});
test('malformed, fractional, nonfinite and out-of-range results are rejected', () => {
  for (const value of [null, '', '42', NaN, Infinity, 1.5, -1, 101, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateSubmission({...base, request: {...request, result: {value}}}), /INVALID_RESULT/);
  }
  assert.throws(() => parseScoreRequest({...request, requestId: 'bad'}), /INVALID_RESULT/);
});
test('a delayed worse score never replaces a better score, in either ranking direction', () => {
  assert.equal(bestResult(bestResult(null, 90, 'desc'), 42, 'desc'), 90);
  assert.equal(bestResult(bestResult(null, 1000, 'asc'), 2000, 'asc'), 1000);
});
