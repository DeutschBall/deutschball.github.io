import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createIndex,lookup,replay} from '../docs/javascripts/xiangqi/library.mjs';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('data/chess/layout-format.json',root)));
const additions=JSON.parse(readFileSync(new URL('data/chess/additional-articles.json',root))).articles;
const library=JSON.parse(readFileSync(new URL('docs/assets/xiangqi/library.json',root)));
const audit=JSON.parse(readFileSync(new URL('data/chess/import-audit.json',root))).articles;
const hash=s=>createHash('sha256').update(s).digest('hex');
function semantic(text){
 return text.split(/\r?\n/).flatMap(raw=>{
  let line=raw.trim().replace(/^(?:>\s*)+/,'');if(!line)return [];
  line=line.replace(/^#{1,6}\s+/,'');
  const callout=line.match(/^\?\?\?\+?\s+\S+\s+(".*")$/);
  if(callout){line=JSON.parse(callout[1]);if(['局面图','推演分支','局面分析'].includes(line))return [];}
  return [line.replace(/^(\d+)\.\s*/,'$1、').replace(/^（(\d+)）\s*/,'$1、')];
 }).join('\n');
}
test('18 historical layout articles retain their metadata, paragraphs, labels and 313 source images',()=>{
 const sources=[];
 function scan(dir){for(const f of readdirSync(new URL('docs/'+dir+'/',root),{withFileTypes:true})){
  const source=dir+'/'+f.name;
  if(f.isDirectory())scan(source);
  else if(f.name.endsWith('.md')){
   const text=readFileSync(new URL('docs/'+source,root),'utf8');
   if(f.name!=='index.md'||/^directory_article: true$/m.test(text))sources.push(source);
  }
 }}
 scan('布局棋理');assert.equal(manifest.articles.length,18);
 assert.deepEqual(sources.sort(),[...manifest.articles,...additions.filter(a=>a.source.startsWith('布局棋理/'))].map(a=>a.source).sort());
 let images=0;
 for(const entry of manifest.articles){
  const text=readFileSync(new URL('docs/'+entry.source,root),'utf8');
  const end=text.indexOf('\n---',4)+4,meta=text.slice(0,end),body=text.slice(end);
  assert.equal(hash(meta),entry.metadataHash,entry.source);
  assert.equal(hash(semantic(body)),entry.contentHash,entry.source);
  const urls=[...body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]);
  assert.deepEqual(urls,entry.images);images+=urls.length;
  assert.ok(!/^\s*>/m.test(body),entry.source);
  assert.ok(!/^\t/m.test(body),entry.source);
 }
 assert.equal(images,313);
});
test('formatting keeps all 78 legal replay lines and every existing source issue',()=>{
 let games=0,lines=0;
 const issueKeys=issues=>issues.map(i=>JSON.stringify([semantic(i.text||''),i.reason.replace(/第 \d+ 行/g,'第 # 行')])).sort();
 for(const entry of manifest.articles){
  const imported=library.games.filter(g=>g.source===entry.source);games+=imported.length;
  assert.deepEqual(imported.map(g=>g.id),entry.gameIds);
  assert.deepEqual(imported.flatMap(g=>g.lines.map(l=>hash(l.moves.join(' ')))).sort(),entry.replayHashes,entry.source);
  if(!entry.directoryArticle)assert.deepEqual(issueKeys(audit.find(a=>a.source===entry.source).issues),issueKeys(entry.issues),entry.source);
  for(const game of imported)for(const line of game.lines){
   const {states}=replay(game,line.id);lines++;
   assert.equal(states.length,line.moves.length+1);
   assert.ok(lookup(library,states.at(-1)).hits.some(h=>h.gameId===game.id&&h.lineId===line.id));
  }
 }
 assert.equal(games,14);assert.equal(lines,78);
 const originalGames=library.games.filter(g=>!additions.some(a=>a.source===g.source));
 const originalPositions=createIndex(originalGames);
 assert.equal(Object.keys(originalPositions).length,3494);
 assert.equal(hash(Object.keys(originalPositions).sort().join('\n')),manifest.positionKeysHash);
 for(const key of Object.keys(originalPositions))assert.ok(library.positions[key]);
});
