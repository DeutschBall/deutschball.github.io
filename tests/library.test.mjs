import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {START,parseFen,play,index} from '../docs/javascripts/xiangqi/rules.mjs';
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
 assert.equal(library.coverage.indexedArticles,152);
 assert.equal(library.coverage.processedArticles,161);
 assert.equal(library.coverage.pendingArticles.length,9);
 assert.equal(library.games.length,152);
 assert.equal(new Set(library.games.map(g=>g.source)).size,152);
 for(const game of library.games)for(const line of game.lines){
  assert.equal(replay(game,line.id).states.length,line.moves.length+1);
  assert.equal(line.sources.length,line.moves.length);
  assert.ok(line.sources.every(s=>s.sourceLine>0&&s.chinese));
 }
 assert.equal(lookup(library,START).mainlineCount,152);
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
 assert.equal(audit.length,161);assert.equal(new Set(audit.map(a=>a.source)).size,161);
 for(const a of audit){
  assert.equal(library.games.filter(g=>g.source===a.source).length,a.games);
  for(const issue of a.issues)if(issue.line)assert.ok(!a.acceptedRows.includes(issue.line));
 }
});

test('flying-elephant review preserves its mainline, five branches and every numbered source row',()=>{
 const source='复盘/业8/应对飞象拐角马@2026.11.2.md';
 const games=library.games.filter(g=>g.source===source);
 assert.equal(games.length,1);
 const [game]=games;
 assert.equal(game.title,'应对飞象拐角马@2026.11.2');
 assert.equal(game.completeness,'fragment');
 assert.equal(game.lines[0].sources.at(-1).chinese,'炮5平4');
 assert.deepEqual(game.lines.map(l=>[l.moves.length,l.fromPly]),[[16,0],[17,11],[27,15],[25,15],[31,15],[14,7]]);
 const article=readFileSync(new URL('../docs/'+source,import.meta.url),'utf8').split(/\r?\n/);
 const numbered=article.flatMap((text,i)=>parseMoveRow(text)?[i+1]:[]);
 const imported=[...new Set(game.lines.flatMap(l=>l.sources.map(s=>s.sourceLine)))].sort((a,b)=>a-b);
 assert.equal(numbered.length,37);
 assert.deepEqual(imported,numbered);
 const audit=JSON.parse(readFileSync(new URL('../data/chess/import-audit.json',import.meta.url))).articles.find(a=>a.source===source);
 assert.equal(audit.status,'converted');assert.deepEqual(audit.issues,[]);assert.deepEqual(audit.acceptedRows,numbered);
 for(const line of game.lines){
  const {states}=replay(game,line.id);
  assert.equal(states.length,line.moves.length+1);
  assert.ok(lookup(library,states.at(-1)).hits.some(h=>h.gameId===game.id&&h.lineId===line.id));
  if(line.kind==='variation'){
   assert.deepEqual(line.moves.slice(0,line.fromPly),game.lines[0].moves.slice(0,line.fromPly));
   assert.notEqual(line.moves[line.fromPly],game.lines[0].moves[line.fromPly]);
  }
 }
 // The diagram after 13. 炮八平六 places the black central cannon on e4.
 const defense=game.lines.find(l=>l.sources.at(-1).chinese==='炮八平六');
 assert.equal(defense.sources.find(s=>s.sourceLine===167&&s.chinese.startsWith('炮5')).chinese,'炮5进3');
 assert.equal(replay(game,defense.id).states.at(-1).board[index('e4')],'c');
});

test('restored June section stays separate from the preceding game and retains its source moves',()=>{
 const split=JSON.parse(readFileSync(new URL('../data/chess/split-manifest.json',import.meta.url)));
 const juneSources=new Set(split.articles.filter(a=>a.originalSource==='复盘/业3～业7/复盘-2025.6.md').map(a=>a.source));
 const june=library.games.filter(g=>juneSources.has(g.source));
 const doubleCannon=june.find(g=>g.source.endsWith('/双炮过河 对 屏风马@2025.6.23.md'));
 const singleHorse=june.find(g=>g.source.endsWith('/中炮直车双正马对单提马横车@2025.6.19.md'));
 assert.equal(june.length,17);
 assert.notEqual(doubleCannon.id,singleHorse.id);
 assert.equal(doubleCannon.lines[0].moves.length,5);
 assert.deepEqual(doubleCannon.lines[0].sources.map(s=>s.chinese),['炮二进四','马8进7','炮八进四','马2进3','兵三进一']);
 assert.equal(singleHorse.lines[0].moves.length,18);
 assert.equal(singleHorse.lines[0].sources.at(-1).chinese,'士4进5');
});

test('November same-direction cannon revision keeps the new examples and removes the old duplicate',()=>{
 const source='布局棋理/疑形/顺炮/顺炮布局疑型总结.md';
 const game=library.games.find(g=>g.source===source);
 const article=readFileSync(new URL('../docs/'+source,import.meta.url),'utf8').split(/\r?\n/);
 assert.ok(!article.includes('## 边炮亮车针对边象保3卒'));
 const opening=game.lines.find(l=>l.title.startsWith('局例-顺炮直车进三兵对缓开车双正马进三卒'));
 const relocated=game.lines.find(l=>l.title.startsWith('局例-顺炮直车对横车-红双正马进三兵对黑进三卒'));
 assert.equal(game.completeness,'fragment');
 assert.equal(game.lines.length,12);
 assert.equal(game.lines[0].moves.length,13);
 assert.deepEqual(opening.moves,['h2e2','h7e7','h0g2','h9g7','i0h0','b9c7','g3g4','c6c5','h0h5']);
 assert.equal(opening.fromPly,5);
 const last=replay(game,opening.id).states.at(-1);
 assert.equal(positionKey(last),'r1bakab1r/9/1cn1c1n2/p3p1p1p/2p4R1/6P2/P1P1P3P/1C2C1N2/9/RNBAKAB2 b');
 assert.equal(last.turn,'b');assert.equal(last.fullmove,5);
 assert.equal(relocated.moves.length,20);assert.equal(relocated.fromPly,9);
 assert.equal(game.lines.filter(l=>JSON.stringify(l.moves)===JSON.stringify(relocated.moves)).length,1);
 for(const line of [opening,relocated]){
  const heading=article.findIndex(t=>t==='### '+line.title.split(' · L')[0]);
  assert.ok(heading>=0);
  const end=article.findIndex((t,i)=>i>heading&&/^#{1,3} /.test(t));
  const rows=article.flatMap((text,i)=>i>heading&&(end<0||i<end)&&parseMoveRow(text)?[{line:i+1,text:text.trim()}]:[]);
  const converted=convertRows(article,rows,parseFen(START)).converted;
  assert.deepEqual(line.moves,converted.map(m=>m.move));
  const sourceStart=line.fromPly-(line.fromPly%2);
  assert.deepEqual(line.sources.slice(sourceStart),converted.slice(sourceStart));
 }
 const audit=JSON.parse(readFileSync(new URL('../data/chess/import-audit.json',import.meta.url))).articles.find(a=>a.source===source);
 assert.equal(audit.status,'partial');assert.equal(audit.issues.length,10);
 for(const line of game.lines){
  const {states}=replay(game,line.id);
  assert.equal(states.length,line.moves.length+1);
  assert.ok(lookup(library,states.at(-1)).hits.some(h=>h.gameId===game.id&&h.lineId===line.id));
  if(line.kind==='variation'){
   assert.deepEqual(line.moves.slice(0,line.fromPly),game.lines[0].moves.slice(0,line.fromPly));
   assert.notEqual(line.moves[line.fromPly],game.lines[0].moves[line.fromPly]);
  }
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
