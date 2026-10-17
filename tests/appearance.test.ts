import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultAppearance,validateAppearance,appearanceVars} from '../apps/hub/lib/appearance.ts';
test('appearance only accepts bounded typed tokens and readable colors',()=>{
 assert.deepEqual(validateAppearance(defaultAppearance),defaultAppearance);
 for(const bad of [{...defaultAppearance,titleSize:200},{...defaultAppearance,titleSize:'22'},{...defaultAppearance,accent:'url(evil)'},{...defaultAppearance,accent:'#000000'},{...defaultAppearance,background:'#ffffff'},{...defaultAppearance,css:'body{display:none}'}])assert.equal(validateAppearance(bad),null);
 assert.equal(appearanceVars(defaultAppearance)['--pp-coverRatio'],'2.5');
 assert.equal(appearanceVars(defaultAppearance)['--pp-titleSize'],'22px');
});
