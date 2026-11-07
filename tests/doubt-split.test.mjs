import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseMoveRow} from '../scripts/build-chess-library.mjs';
import {lookup,replay} from '../docs/javascripts/xiangqi/library.mjs';
import {restoreDiagramSources} from './diagram-sources.mjs';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('data/chess/doubt-split.json',root)));
const library=JSON.parse(readFileSync(new URL('docs/assets/xiangqi/library.json',root)));
const audit=JSON.parse(readFileSync(new URL('data/chess/import-audit.json',root))).articles;
const entries=[...manifest.articles,...manifest.updatedArticles];
const formatted=JSON.parse(readFileSync(new URL('data/chess/layout-format.json',root))).articles;
const hash=s=>createHash('sha256').update(s).digest('hex');

test('all 12 specific doubts preserve text, 85 diagrams and exactly two content sections',()=>{
 assert.equal(manifest.collections.length,5);assert.equal(entries.length,12);
 let images=0;
 for(const entry of entries){
  const text=restoreDiagramSources(entry.source,readFileSync(new URL('docs/'+entry.source,root),'utf8'));
  const [,meta,body]=text.split('---\n');
  assert.ok(meta.includes('date: '+entry.date));
  assert.equal(body.match(/^# (.+)$/m)[1],entry.headingTitle);
  assert.deepEqual([...body.matchAll(/^## (.+)$/gm)].map(m=>m[1]),['典型局面','局例']);
  // The later presentation migration records a second fingerprint of this same split source.
  assert.equal(formatted.find(a=>a.source===entry.source).doubtContentHash,entry.contentHash,entry.source);
  const urls=[...body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]);
  assert.deepEqual(urls,entry.images);images+=urls.length;
 }
 assert.equal(images,85);
 for(const category of ['中炮对屏风马','仙人指路','列炮','顺炮']){
  const sources=readdirSync(new URL('docs/布局棋理/疑形/'+category+'/',root)).filter(n=>n.endsWith('.md')&&n!=='index.md');
  assert.deepEqual(sources.sort(),entries.filter(a=>a.source.split('/')[2]===category).map(a=>a.source.split('/').at(-1)).sort());
 }
 for(const collection of manifest.collections){
  assert.ok(!existsSync(new URL('docs/'+collection.originalSource,root)));
  const legacy=readFileSync(new URL('docs/'+collection.originalSource.replace(/\.md$/,'/index.html'),root),'utf8');
  for(const entry of manifest.articles.filter(a=>a.originalSource===collection.originalSource)){
   assert.ok(entry.originalAnchor,entry.source);
   assert.ok(legacy.includes('id="'+entry.originalAnchor+'"'));
   assert.ok(legacy.includes(encodeURIComponent(entry.source.split('/').at(-1).replace(/\.md$/,''))));
  }
 }
});

test('the book keeps both complete parts on directory homepages, including all 31 cases and 87 diagrams',()=>{
 assert.equal(manifest.directoryArticles.length,2);
 let chapters=0,images=0;
 for(const entry of manifest.directoryArticles){
  const text=restoreDiagramSources(entry.source,readFileSync(new URL('docs/'+entry.source,root),'utf8'));
  const [,meta,body]=text.split('---\n');
  assert.match(meta,/^directory_article: true$/m);
  assert.equal(body.match(/^# (.+)$/m)[1],entry.title);
  assert.equal(formatted.find(a=>a.source===entry.source).doubtContentHash,entry.contentHash);
  assert.deepEqual([...body.matchAll(/^### (.+)$/gm)].map(m=>m[1]),entry.chapters);
  assert.deepEqual([...body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]),entry.images);
  assert.ok(!library.games.some(g=>g.source===entry.source));
  assert.ok(!audit.some(a=>a.source===entry.source));
  chapters+=entry.chapters.length;images+=entry.images.length;
 }
 assert.equal(chapters,31);assert.equal(images,87);
 assert.ok(!existsSync(new URL('docs/布局棋理/疑形/通论/index.md',root)));
});

test('source migrations preserve every old replay and issue without inventing records for diagrams',()=>{
 let lines=0,games=0;
 for(const entry of entries){
  const found=library.games.filter(g=>g.source===entry.source);
  assert.equal(found.length,entry.gameId?1:0);
  const source=readFileSync(new URL('docs/'+entry.source,root),'utf8').split(/\r?\n/);
  const record=audit.find(a=>a.source===entry.source);
  const numbered=source.flatMap((t,i)=>parseMoveRow(t)?[i+1]:[]);
  assert.deepEqual([...record.acceptedRows,...record.issues.filter(i=>i.line).map(i=>i.line)].sort((a,b)=>a-b),numbered);
  if(!entry.gameId){assert.equal(record.status,'needs-source');continue;}
  games++;const [game]=found;
  assert.equal(game.id,entry.gameId);assert.equal(game.title,entry.title);
  assert.equal(decodeURIComponent(game.url),entry.source.replace(/\.md$/,'/'));
  assert.equal(game.completeness,'fragment');
  assert.equal(game.lines[0].moves.length,entry.mainlinePlies);
  assert.deepEqual(game.lines.map(l=>hash(l.moves.join(' '))).sort(),entry.replayHashes,entry.source);
  for(const line of game.lines){
   const {states}=replay(game,line.id);lines++;
   assert.equal(states.length,line.moves.length+1);
   assert.ok(lookup(library,states.at(-1)).hits.some(h=>h.gameId===game.id&&h.lineId===line.id));
   for(const row of line.sources)assert.ok(source[row.sourceLine-1].includes(row.chinese));
   if(line.kind==='variation'){
    assert.deepEqual(line.moves.slice(0,line.fromPly),game.lines[0].moves.slice(0,line.fromPly));
    assert.notEqual(line.moves[line.fromPly],game.lines[0].moves[line.fromPly]);
   }
  }
 }
 assert.equal(games,11);assert.equal(lines,30);
 for(const collection of manifest.collections){
  const children=manifest.articles.filter(a=>a.originalSource===collection.originalSource);
  assert.deepEqual(children.flatMap(a=>a.previousReplayHashes).sort(),collection.originalReplayHashes);
  assert.ok(!library.games.some(g=>g.source===collection.originalSource));
  const issues=audit.filter(a=>children.some(c=>c.source===a.source)).flatMap(a=>a.issues);
  if(collection.originalGameIds.length)assert.deepEqual(issues.map(i=>i.text).sort(),collection.originalIssues.map(i=>i.text).sort());
 }
 for(const entry of manifest.updatedArticles){
  assert.deepEqual(audit.find(a=>a.source===entry.source).issues.map(i=>i.text),entry.originalIssues.map(i=>i.text));
 }
});
