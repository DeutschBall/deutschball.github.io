import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseMoveRow} from '../scripts/build-chess-library.mjs';
import {positionKey,lookup,replay} from '../docs/javascripts/xiangqi/library.mjs';
const root=new URL('../',import.meta.url);
const entries=JSON.parse(readFileSync(new URL('data/chess/additional-articles.json',root))).articles;
const library=JSON.parse(readFileSync(new URL('docs/assets/xiangqi/library.json',root)));
const audit=JSON.parse(readFileSync(new URL('data/chess/import-audit.json',root))).articles;
const hash=s=>createHash('sha256').update(s).digest('hex');
function semantic(body){return body.split(/\r?\n/).flatMap(raw=>{
 let line=raw.trim().replace(/^(?:>\s*)+/,'');if(!line)return [];
 line=line.replace(/^#{1,6}\s+/,'');const box=line.match(/^\?\?\?\+?\s+\S+\s+(".*")$/);
 if(box){line=JSON.parse(box[1]);if(['局面图','推演分支','局面分析'].includes(line))return [];}
 return [line.replace(/[ \t]+/g,' ')];
}).join('\n');}

test('November two-snakes study preserves all 18 diagrams and its prose with three reviewed notation corrections',()=>{
 const entry=entries.find(a=>a.indexed),text=readFileSync(new URL('docs/'+entry.source,root),'utf8');
 assert.equal(entry.source,'布局棋理/定式/顺炮/顺炮直车两头蛇对双横车@2026.11.4.md');
 assert.equal(entry.images.length,18);
 assert.equal(hash(semantic(text.split(/---\r?\n/)[2])),entry.contentHash);
 assert.deepEqual([...text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]),entry.images);
 assert.equal(entry.corrections.length,3);
 for(const c of entry.corrections){assert.ok(text.includes(c.to));assert.ok(!text.includes(c.from));}
 for(const title of entry.unnumberedAnalysis)assert.ok(text.includes(title));
 assert.ok(!/^\t/m.test(text));
});

test('all 53 numbered rows replay as a 12-ply opening and seven source-backed branches',()=>{
 const entry=entries.find(a=>a.indexed),games=library.games.filter(g=>g.source===entry.source);
 assert.equal(games.length,1);const [game]=games;
 assert.equal(game.id,entry.gameId);assert.equal(game.title,entry.title);assert.equal(game.completeness,'fragment');
 assert.deepEqual(game.lines.map(l=>[l.moves.length,l.fromPly,l.sources.at(-1).chinese]),entry.lines.map(l=>[l.plies,l.fromPly,l.lastMove]));
 const article=readFileSync(new URL('docs/'+entry.source,root),'utf8').split(/\r?\n/);
 const numbered=article.flatMap((text,i)=>parseMoveRow(text)?[i+1]:[]);
 const included=[...new Set(game.lines.flatMap(l=>l.sources.map(s=>s.sourceLine)))].sort((a,b)=>a-b);
 assert.equal(numbered.length,53);assert.deepEqual(included,numbered);
 const record=audit.find(a=>a.source===entry.source);
 assert.equal(record.status,'converted');assert.deepEqual(record.issues,[]);assert.deepEqual(record.acceptedRows,numbered);
 for(const line of game.lines){
  const {states}=replay(game,line.id);
  assert.equal(states.length,line.moves.length+1);
  assert.ok(lookup(library,states.at(-1)).hits.some(h=>h.gameId===game.id&&h.lineId===line.id));
  if(line.kind==='variation')assert.deepEqual(line.moves.slice(0,line.fromPly),game.lines[0].moves);
 }
 // These complete board positions are independently checked against the original source diagrams.
 const cannon=game.lines.find(l=>l.sources.at(-1).chinese==='后炮退一');
 assert.equal(positionKey(replay(game,cannon.id).states.at(-1)),'2bakab2/4n4/4c1n2/p1P1p1N1p/9/1N2C1P2/P3P3P/B8/3rCr3/1R2K1BR1 b');
 assert.ok(cannon.sources.some(s=>s.chinese==='帅四平五'));
 const horse=game.lines.find(l=>l.title.startsWith('车4进5'));
 assert.equal(positionKey(replay(game,horse.id).states.at(-1)),'2bakab2/5r3/2n3n2/p3p1p1p/4c2R1/N1p3P2/Pc4C1P/BCN6/9/2RAKAB2 b');
 assert.ok(horse.sources.some(s=>s.chinese==='前马进九'));
});

test('the published slow-rook draft remains unindexed until it has source moves',()=>{
 const entry=entries.find(a=>!a.indexed),text=readFileSync(new URL('docs/'+entry.source,root),'utf8');
 assert.match(text,/^title: "顺炮直车对缓开车@2026\.11\.4"$/m);
 assert.equal(text.match(/^# (.+)$/m)[1],entry.headingTitle);
 assert.equal(text.split(/\r?\n/).filter(t=>parseMoveRow(t)).length,0);
 assert.ok(!library.games.some(g=>g.source===entry.source));
 const record=audit.find(a=>a.source===entry.source);
 assert.equal(record.status,'needs-source');assert.equal(record.games,0);assert.equal(record.issues.length,1);
});
