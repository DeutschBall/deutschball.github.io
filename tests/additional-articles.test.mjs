import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseMoveRow,convertRows} from '../scripts/build-chess-library.mjs';
import {parseFen,play,pseudo,index} from '../docs/javascripts/xiangqi/rules.mjs';
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

test('slow-rook study preserves all 30 external diagrams, source prose and reviewed corrections',()=>{
 const entry=entries.find(a=>a.source.endsWith('/顺炮直车对缓开车@2026.11.4.md')),text=readFileSync(new URL('docs/'+entry.source,root),'utf8');
 assert.match(text,/^title: "顺炮直车对缓开车@2026\.11\.4"$/m);
 assert.equal(text.match(/^# (.+)$/m)[1],entry.headingTitle);
 assert.equal(entry.images.length,30);
 assert.deepEqual([...text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]),entry.images);
 assert.ok(entry.images.every(url=>url.startsWith('https://raw.githubusercontent.com/DeutschBall/picgo/main/')));
 const preserved=text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!/^#{1,6}\s/.test(line)&&!/^\?\?\?|^!!!/.test(line)&&!entry.sourceNotes.includes(line)).map(line=>line.replace(/[ \t]+/g,' ')).join('\n');
 assert.equal(hash(preserved),entry.preservedContentHash);
 assert.equal(entry.corrections.length,6);
 for(const correction of entry.corrections){assert.ok(text.includes(correction.to));assert.ok(!text.split(/\r?\n/).some(line=>line.trim()===correction.from));}
 assert.deepEqual(entry.sourceNotes,[]);assert.ok(text.includes('退二又遭到马6进7踩'));
 assert.ok(!/^#{3,6}\s/m.test(text),'only second-level article sections remain in the table of contents');
 assert.deepEqual([...text.matchAll(/^## (.+)$/gm)].map(m=>m[1]),['马八进七','兵七进一']);
 assert.match(text,/^\?\?\? question "炮2进4"\n\n    5、\.\.\. 炮2进4/m);
 assert.match(text,/^    \?\?\? question "马七进六"\n\n        6、马七进六 炮2平7/m);
 assert.match(text,/^    \?\?\? question "马七进八"\n\n        6、马七进八 车9进1/m);
 assert.ok(!/^\t|[ \t]+$/m.test(text));
});

test('all 67 slow-rook rows replay as a six-ply opening and eight distinct analysis paths',()=>{
 const entry=entries.find(a=>a.source.endsWith('/顺炮直车对缓开车@2026.11.4.md'));
 const games=library.games.filter(g=>g.source===entry.source);assert.equal(games.length,1);
 const [game]=games;assert.equal(game.id,'blog-e011ed3e900a');assert.equal(game.id,entry.gameId);assert.equal(game.completeness,'fragment');
 assert.deepEqual(game.lines.map(l=>[l.moves.length,l.fromPly,l.sources.at(-1).chinese]),[[6,0,'卒7进1'],[24,6,'马2进3'],[33,6,'马六进八'],[37,6,'兵九进一'],[18,6,'车2平4'],[21,6,'马七进六'],[22,6,'马3退2'],[18,6,'车4进2'],[25,6,'车七进四']]);
 assert.deepEqual(game.lines.map(l=>[l.moves.length,l.fromPly,l.sources.at(-1).chinese]),entry.lines.map(l=>[l.plies,l.fromPly,l.lastMove]));
 const article=readFileSync(new URL('docs/'+entry.source,root),'utf8').split(/\r?\n/);
 const numbered=article.flatMap((text,i)=>parseMoveRow(text)?[i+1]:[]);
 assert.equal(numbered.length,67);
 assert.deepEqual([...new Set(game.lines.flatMap(l=>l.sources.map(s=>s.sourceLine)))].sort((a,b)=>a-b),numbered);
 const record=audit.find(a=>a.source===entry.source);
 assert.equal(record.status,'converted');assert.equal(record.games,1);assert.deepEqual(record.issues,[]);assert.deepEqual(record.acceptedRows,numbered);
 for(const line of game.lines){
  const {states}=replay(game,line.id);assert.equal(states.length,line.moves.length+1);
  assert.ok(lookup(library,states.at(-1)).hits.some(h=>h.gameId===game.id&&h.lineId===line.id));
  if(line.kind==='variation')assert.deepEqual(line.moves.slice(0,line.fromPly),game.lines[0].moves);
 }
 const trapped=game.lines.find(l=>l.title.startsWith('车4平7'));
 assert.equal(positionKey(replay(game,trapped.id).states.at(-1)),'rn1ak1b2/4a4/4bc3/p7p/cN4p2/P8/4PRP1P/1C2B4/6r2/1R1AKAB2 b');
 const doubleAttack=game.lines.find(l=>l.title.startsWith('车4进5'));
 assert.equal(positionKey(replay(game,doubleAttack.id).states.at(-1)),'r1bakab2/9/2N1c1n2/p3p3p/2R3p2/9/P3P1c1P/1r2C1N2/4A4/2BAK1BR1 b');
 for(const diagram of entry.diagramPositions){const line=game.lines.find(l=>l.title.startsWith(diagram.title));assert.equal(positionKey(replay(game,line.id).states.at(-1)),diagram.position);}
 // The original 15...车5平3 contradicts the diagram and cannot lead to 16...车4进4.
 const corrupted=article.slice(),row=trapped.sources.find(s=>s.chinese==='车5平4').sourceLine;
 corrupted[row-1]=corrupted[row-1].replace('车5平4','车5平3');
 const rows=[...new Set(trapped.sources.map(s=>s.sourceLine))].map(line=>({line,text:corrupted[line-1].trim()}));
 assert.throws(()=>convertRows(corrupted,rows,parseFen(game.startFen)),/合法着法/);
 // Author clarified the prose: after 炮五退二, 马6进7 attacks the cannon on e4.
 const jumped=play(play(replay(game,trapped.id).states[26],'e6e4'),'f5g3');
 assert.equal(jumped.board[index('e4')],'C');assert.equal(jumped.board[index('g3')],'n');
 assert.ok(pseudo(jumped.board,index('g3'),index('e4')));
});
