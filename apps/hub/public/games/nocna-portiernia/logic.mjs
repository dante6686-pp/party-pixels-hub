import { visits, SCENARIO_VERSION, PROTOTYPE_LIMIT } from './scenario.mjs';
export function initialState(limit = PROTOTYPE_LIMIT) {
  if (!Number.isInteger(limit) || limit < 1 || limit > visits.length) throw Error('INVALID_LIMIT');
  return { scenarioVersion:SCENARIO_VERSION, limit, nextVisitIndex:0, decisions:[], mistakes:0, ending:null };
}
export function decide(state, index, allow) {
  if (!validCheckpoint(state) || state.ending || index !== state.nextVisitIndex || typeof allow !== 'boolean') return state;
  const mistakes = state.mistakes + Number(allow !== visits[index].allow);
  const nextVisitIndex = index + 1;
  return { ...state, nextVisitIndex, decisions:[...state.decisions, allow], mistakes,
    ending: mistakes >= 3 ? 'failed' : nextVisitIndex === state.limit ? (state.limit === 8 ? 'survived' : 'prototype') : null };
}
/** @param {any} s @param {number|null} expectedLimit */
export function validCheckpoint(s, expectedLimit = null) {
  if (!s || typeof s !== 'object' || Array.isArray(s) || Object.keys(s).sort().join(',') !== 'decisions,ending,limit,mistakes,nextVisitIndex,scenarioVersion') return false;
  if (s.scenarioVersion !== SCENARIO_VERSION || !Number.isInteger(s.limit) || s.limit < 1 || s.limit > visits.length || (expectedLimit !== null && s.limit !== expectedLimit)) return false;
  if (!Array.isArray(s.decisions) || s.decisions.length > s.limit || s.decisions.some(x=>typeof x !== 'boolean') || s.nextVisitIndex !== s.decisions.length) return false;
  let mistakes = 0;
  for (let i=0; i<s.decisions.length; i++) {
    mistakes += Number(s.decisions[i] !== visits[i].allow);
    if (mistakes >= 3 && i < s.decisions.length-1) return false;
  }
  const ending = mistakes >= 3 ? 'failed' : s.nextVisitIndex === s.limit ? (s.limit === 8 ? 'survived' : 'prototype') : null;
  return s.mistakes === mistakes && s.ending === ending;
}
