import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterGames,games} from '../apps/hub/lib/catalog.ts';
test('catalog combines search, category, graphics and supported mode',()=>{
 assert.equal(filterGames('','all','all','all').length,3);
 assert.deepEqual(filterGames('','3d','solo','Akcja').map(g=>g.id),['magazyn-auto']);
 assert.equal(filterGames('piątka','2d','solo','Logiczne')[0]?.id,'quick-math');
 assert.equal(filterGames('  SToper  ','2d','all','all')[0]?.id,'two-seconds');
 assert.equal(filterGames('','all','multiplayer','all').length,0);
 assert.equal(filterGames('MAGAZYN','2d','solo','all').length,0);
 assert.equal(new Set(games.map(g=>g.id)).size,games.length);
});

test('each catalog play action opens its dedicated game route',()=>{
 for(const game of games){assert.equal(game.play,'/play/'+game.id);assert.equal(game.play.includes('#'),false);}
});
