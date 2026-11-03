import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('data/chess/article-titles.json',root)));
const library=JSON.parse(readFileSync(new URL('docs/assets/xiangqi/library.json',root)));
const hash=s=>createHash('sha256').update(s).digest('hex');
test('all content titles show their known full date or explicitly retain a missing date',()=>{
 assert.equal(manifest.articles.length,161);
 assert.equal(manifest.articles.filter(a=>a.date).length,156);
 assert.equal(manifest.articles.filter(a=>a.needsDate).length,5);
 for(const entry of manifest.articles){
  const text=readFileSync(new URL('docs/'+entry.source,root),'utf8');
  const value=text.match(/^title:\s*(.+)$/m)[1];
  assert.equal(value.startsWith('"')?JSON.parse(value):value,entry.title,entry.source);
  const heading=text.match(/^# (.+)$/m)?.[1];
  if(heading)assert.equal(heading,entry.headingTitle,entry.source);
  if(entry.date){
   const suffix='@'+entry.date.split('-').map(Number).join('.');
   assert.ok(entry.title.endsWith(suffix),entry.source);
   assert.ok(entry.headingTitle.endsWith(suffix),entry.source);
  }else{
   assert.ok(entry.title.endsWith('（日期待补）'),entry.source);
   if(entry.month)assert.ok(entry.title.includes('@'+entry.month.split('-').map(Number).join('.')));
  }
 }
});
test('display title updates preserve all 152 game identities, article URLs and replay lines',()=>{
 assert.deepEqual(library.games.map(g=>g.id).sort(),manifest.games.map(g=>g.id).sort());
 for(const before of manifest.games){
  const game=library.games.find(g=>g.id===before.id);
  const article=manifest.articles.find(a=>a.source===before.source);
  assert.equal(game.source,before.source);
  assert.equal(decodeURIComponent(game.url),before.source.replace(/\.md$/,'/'));
  assert.equal(game.title,article.title);
  // The November 3 article revision adds this source-verified opening; all title-era lines remain.
  const additions=before.source==='布局棋理/疑形/顺炮/顺炮布局疑型总结.md'
   ? [hash('h2e2 h7e7 h0g2 h9g7 i0h0 b9c7 g3g4 c6c5 h0h5')]:[];
  assert.deepEqual(game.lines.map(l=>hash(l.moves.join(' '))).sort(),[...before.moveHashes,...additions].sort(),before.source);
 }
});
