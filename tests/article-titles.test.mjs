import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('data/chess/article-titles.json',root)));
const split=JSON.parse(readFileSync(new URL('data/chess/doubt-split.json',root)));
const retired=new Set(split.collections.map(c=>c.originalSource));
const articles=[...manifest.articles.filter(a=>!retired.has(a.source)),...split.articles];
const library=JSON.parse(readFileSync(new URL('docs/assets/xiangqi/library.json',root)));
const hash=s=>createHash('sha256').update(s).digest('hex');
test('all content titles show their known full date or explicitly retain a missing date',()=>{
 assert.equal(articles.length,166);
 assert.equal(articles.filter(a=>a.date).length,161);
 assert.equal(articles.filter(a=>a.needsDate).length,5);
 for(const entry of articles){
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
test('display title baseline preserves surviving identities and follows doubt article migrations',()=>{
 const expectedIds=[...manifest.games.filter(g=>!retired.has(g.source)).map(g=>g.id),...split.articles.filter(a=>a.gameId).map(a=>a.gameId)];
 assert.deepEqual(library.games.map(g=>g.id).sort(),expectedIds.sort());
 for(const before of manifest.games){
  if(retired.has(before.source)){
   const migrated=library.games.filter(g=>split.articles.some(a=>a.originalSource===before.source&&a.source===g.source));
   const hashes=migrated.flatMap(g=>g.lines.map(l=>hash(l.moves.join(' '))));
   for(const prior of before.moveHashes)assert.ok(hashes.includes(prior),'lost original line: '+prior);
   continue;
  }
  const game=library.games.find(g=>g.id===before.id);
  const article=articles.find(a=>a.source===before.source);
  assert.equal(game.source,before.source);
  assert.equal(decodeURIComponent(game.url),before.source.replace(/\.md$/,'/'));
  assert.equal(game.title,article.title);
  assert.deepEqual(game.lines.map(l=>hash(l.moves.join(' '))).sort(),before.moveHashes,before.source);
 }
});
