import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {START,parseFen,play} from '../docs/javascripts/xiangqi/rules.mjs';
import {positionKey,createIndex,lookup,replay} from '../docs/javascripts/xiangqi/library.mjs';
import {convertRows,build} from '../scripts/build-chess-library.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const library=JSON.parse(readFileSync(new URL('../docs/assets/xiangqi/library.json',import.meta.url)));
test('sample converts all mainline and numbered variation moves, with provenance',()=>{
 const g=library.games[0];assert.equal(g.lines[0].moves.length,20);assert.equal(g.lines[1].moves.length,22);
 assert.deepEqual(g.lines[0].moves.slice(0,4),['h2e2','h7e7','h0g2','h9g7']);
 assert.equal(g.lines[1].fromPly,19);assert.ok(g.lines.every(l=>l.sources.every(s=>s.sourceLine>0)));
 for(const line of g.lines)assert.equal(replay(g,line.id).states.length,line.moves.length+1);
 assert.deepEqual(JSON.parse(JSON.stringify(build(root))),library);
});
test('position keys ignore clocks, preserve side, and normalize aliases',()=>{
 assert.equal(positionKey(START),positionKey(START.replace('0 1','38 24')));
 assert.notEqual(positionKey(START),positionKey(START.replace(' w ',' b ')));
 assert.equal(positionKey(START),positionKey(START.replaceAll('N','H').replaceAll('n','h')));
});
test('game count deduplicates repeated positions, distinct games remain distinct',()=>{
 const g={id:'a',startFen:START,lines:[{id:'main',kind:'mainline',moves:['h0g2','h9g7','g2h0','g7h9']}]};
 let data={positions:createIndex([g])};assert.equal(lookup(data,START).mainlineCount,1);assert.deepEqual(lookup(data,START).hits[0].plies,[0,4]);
 data={positions:createIndex([g,{...g,id:'b'}])};assert.equal(lookup(data,START).mainlineCount,2);
 assert.throws(()=>createIndex([g,g]),/重复/);
});
test('analysis prefix does not inflate counts; branch-only position has zero mainline games',()=>{
 const g=library.games[0];const branch=replay(g,g.lines[1].id),main=replay(g,'main');
 assert.equal(lookup(library,START).mainlineCount,1);assert.equal(lookup(library,START).variationCount,0);
 assert.equal(lookup(library,branch.states[20]).mainlineCount,0);assert.equal(lookup(library,branch.states[20]).variationCount,1);
 assert.equal(lookup(library,main.states[20]).mainlineCount,1);
 assert.equal(lookup(library,play(parseFen(START),'a3a4')).hits.length,0);
});
test('source changes, illegal moves and wrong turn fail conversion instead of guessing',()=>{
 assert.throws(()=>convertRows(['1、炮二平五'],[{line:1,text:'1、炮二平四'}],parseFen(START)),/已改变/);
 assert.throws(()=>convertRows(['1、车一进九'],[{line:1,text:'1、车一进九'}],parseFen(START)),/合法/);
 assert.throws(()=>convertRows(['1、... 炮8平5'],[{line:1,text:'1、... 炮8平5'}],parseFen(START)),/行棋方/);
 assert.throws(()=>convertRows(['2、炮二平五'],[{line:1,text:'2、炮二平五'}],parseFen(START)),/回合/);
});
