import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformClient} from '../packages/party-pixels-sdk/src/index.ts';
test('games receive only public profile and submit no player or auth token',async()=>{
 const calls:unknown[]=[];
 const player={playerId:'a',handle:'patryk',displayName:'Patryk',avatar:'ghost',email:'private',accessToken:'secret'};
 const sdk=createPlatformClient({player,invoke:async(op,args)=>{calls.push([op,args]);return {};}});
 assert.deepEqual(Object.keys(sdk.player.get()).sort(),['avatar','displayName','handle','playerId']);
 const read=sdk.player.get();read.handle='changed';assert.equal(sdk.player.get().handle,'patryk');
 await sdk.sessions.start('quick-math');
 await sdk.scores.submit('session','stable-request',{answers:[1,2,3,4,5]});
 await sdk.scores.submit('session','stable-request',{answers:[1,2,3,4,5]});
 assert.deepEqual(calls[1],calls[2]);
 assert.equal(JSON.stringify(calls).includes('secret'),false);
 assert.equal(JSON.stringify(calls).includes('playerId'),false);
});
