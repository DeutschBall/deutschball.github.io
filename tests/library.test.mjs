import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {START,parseFen,play} from '../docs/javascripts/xiangqi/rules.mjs';
import {positionKey,createIndex,lookup,replay} from '../docs/javascripts/xiangqi/library.mjs';
import {convertRows,parseMoveRow,build} from '../scripts/build-chess-library.mjs';
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
 const g=library.games[0],isolated={positions:createIndex([g])};const branch=replay(g,g.lines[1].id),main=replay(g,'main');
 assert.equal(lookup(isolated,START).mainlineCount,1);assert.equal(lookup(isolated,START).variationCount,0);
 assert.equal(lookup(isolated,branch.states[20]).mainlineCount,0);assert.equal(lookup(isolated,branch.states[20]).variationCount,1);
 assert.equal(lookup(isolated,main.states[20]).mainlineCount,1);
 assert.equal(lookup(isolated,play(parseFen(START),'a3a4')).hits.length,0);
});
test('source changes, illegal moves and wrong turn fail conversion instead of guessing',()=>{
 assert.throws(()=>convertRows(['1、炮二平五'],[{line:1,text:'1、炮二平四'}],parseFen(START)),/已改变/);
 assert.throws(()=>convertRows(['1、车一进九'],[{line:1,text:'1、车一进九'}],parseFen(START)),/合法/);
 assert.throws(()=>convertRows(['1、... 炮8平5'],[{line:1,text:'1、... 炮8平5'}],parseFen(START)),/行棋方/);
 assert.throws(()=>convertRows(['2、炮二平五'],[{line:1,text:'2、炮二平五'}],parseFen(START)),/回合/);
});

test('full-site articles and every imported line replay with source provenance',()=>{
 assert.equal(library.coverage.indexedArticles,50);
 assert.equal(library.coverage.processedArticles,56);
 assert.equal(library.coverage.pendingArticles.length,6);
 assert.equal(library.games.length,149);
 assert.equal(new Set(library.games.map(g=>g.source)).size,50);
 for(const game of library.games)for(const line of game.lines){
  assert.equal(replay(game,line.id).states.length,line.moves.length+1);
  assert.equal(line.sources.length,line.moves.length);
  assert.ok(line.sources.every(s=>s.sourceLine>0&&s.chinese));
 }
 assert.equal(lookup(library,START).mainlineCount,149);
 assert.equal(lookup(library,START).variationCount,0);
});

test('parenthesized notation, quoted continuations, ellipses and explicit source slices',()=>{
 assert.equal(parseMoveRow('（1）炮二平五 馬８进７').tokens.length,2);
 assert.equal(parseMoveRow('> （1） ... 炮８平５').turn,'b');
 assert.equal(parseMoveRow('1、炮二平五 ...').turn,'w');
 assert.equal(parseMoveRow('1、这是解释文字'),null);
 const source=['（1）炮二平五 炮８平５'];
 assert.equal(convertRows(source,[{line:1,text:source[0],take:1}],parseFen(START)).converted.length,1);
 assert.throws(()=>convertRows(source,[{line:1,text:source[0],take:3}],parseFen(START)),/范围/);
});

test('all article audits are complete and unresolved rows are not silently included',()=>{
 const audit=JSON.parse(readFileSync(new URL('../data/chess/import-audit.json',import.meta.url))).articles;
 assert.equal(audit.length,56);assert.equal(new Set(audit.map(a=>a.source)).size,56);
 for(const a of audit){
  assert.equal(library.games.filter(g=>g.source===a.source).length,a.games);
  for(const issue of a.issues)if(issue.line)assert.ok(!a.acceptedRows.includes(issue.line));
 }
});


test('move separators accept punctuation and symbols with all four numbering styles',()=>{
 for(const prefix of ['1、','1、 ','1.','1. ']) {
  for(const separator of ['，','， ',' ','  ','；','; ', '/', '|', '→', '——', ' · ', '、', '★', '😃', '\t']) {
   const text=prefix+'炮二平五'+separator+'马８进７';
   const result=convertRows([text],[{line:1,text}],parseFen(START));
   assert.deepEqual(result.converted.map(m=>m.move),['h2e2','h9g7'],text);
  }
 }
 for(const separator of ['然后','但是','and','123']) {
  assert.throws(()=>parseMoveRow('1. 炮二平五'+separator+'马８进７'),/说明或不支持/);
 }
 assert.throws(()=>parseMoveRow('1. 炮二平五；马８进７；马二进三'),/说明或不支持/);
 assert.throws(()=>convertRows(['1. 车一进九；马８进７'],[{line:1,text:'1. 车一进九；马８进７'}],parseFen(START)),/合法/);
});

test('ellipsis preserves recorded moves without inventing a missing turn',()=>{
 for(const ellipsis of ['…','……','...','......','．．．']) {
  const red='1. 炮二平五 '+ellipsis;
  const first=convertRows([red],[{line:1,text:red}],parseFen(START));
  assert.deepEqual(first.converted.map(m=>m.move),['h2e2']);
  assert.equal(first.state.turn,'b');
  const black='1. '+ellipsis+' 马８进７';
  const second=convertRows([black],[{line:1,text:black}],first.state);
  assert.deepEqual(second.converted.map(m=>m.move),['h9g7']);
  assert.equal(second.state.turn,'w');
  assert.equal(second.state.fullmove,2);
  assert.throws(()=>convertRows([black],[{line:1,text:black}],parseFen(START)),/行棋方/);
  const next='2. 马二进三 马２进３';
  assert.throws(()=>convertRows([red,next],[{line:1,text:red},{line:2,text:next}],parseFen(START)),/回合/);
  assert.equal(parseMoveRow('1. '+ellipsis),null);
 }
});
