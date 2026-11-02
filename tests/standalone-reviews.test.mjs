import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {lookup,replay} from '../docs/javascripts/xiangqi/library.mjs';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('data/chess/standalone-format-manifest.json',root)));
const library=JSON.parse(readFileSync(new URL('docs/assets/xiangqi/library.json',root)));
const hash=s=>createHash('sha256').update(s).digest('hex');
// Fingerprints are recorded from 675c59c before formatting, including former HTML images.
function content(text,title){
 return text.split('\n').flatMap(raw=>{
  let line=raw.trim();
  if(!line||line==='# '+title)return [];
  line=line.replace(/^#{1,6}\s+/,'').replace(/^(\d+)\.\s*/,'$1、').replace(/^（(\d+)）\s*/,'$1、');
  const callout=line.match(/^\?\?\?\+?\s+\S+\s+"(.*)"$/);
  if(callout){line=callout[1];if(['局面图','推演分支','局面分析'].includes(line))return [];}
  return [line];
 }).join('\n');
}
test('34 older standalone reviews preserve their metadata, text and all 406 images',()=>{
 assert.equal(manifest.articles.length,34);
 assert.equal(manifest.articles.reduce((n,a)=>n+a.images.length,0),406);
 assert.equal(new Set(manifest.articles.map(a=>a.source)).size,34);
 for(const entry of manifest.articles){
  const text=readFileSync(new URL('docs/'+entry.source,root),'utf8');
  const end=text.indexOf('\n---',4)+4,meta=text.slice(0,end),body=text.slice(end);
  assert.equal(hash(meta),entry.metadataHash,entry.source);
  assert.equal(hash(content(body,entry.title)),entry.contentHash,entry.source);
  assert.deepEqual([...body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]),entry.images,entry.source);
  assert.ok(!/^\s*>/m.test(body),entry.source);
  assert.ok(!/^\s*<img\b/m.test(body),entry.source);
  assert.ok(!/^\t/m.test(body),entry.source);
 }
});
test('standalone formatting preserves every original mainline and branch and its article link',()=>{
 for(const entry of manifest.articles){
  const games=library.games.filter(g=>g.source===entry.source);
  assert.deepEqual(games.map(g=>g.id),entry.gameIds,entry.source);
  assert.deepEqual(games.flatMap(g=>g.lines.map(l=>hash(l.moves.join(' ')))).sort(),entry.replayHashes,entry.source);
  for(const game of games){
   assert.equal(decodeURIComponent(game.url),entry.source.replace(/\.md$/,'/'));
   for(const line of game.lines){
    const {states}=replay(game,line.id);
    assert.equal(states.length,line.moves.length+1);
    assert.ok(lookup(library,states.at(-1)).hits.some(h=>h.gameId===game.id&&h.lineId===line.id));
   }
  }
 }
});
