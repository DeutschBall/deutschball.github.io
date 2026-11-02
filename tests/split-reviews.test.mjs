import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {lookup,replay,positionKey} from '../docs/javascripts/xiangqi/library.mjs';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('data/chess/split-manifest.json',root)));
const library=JSON.parse(readFileSync(new URL('docs/assets/xiangqi/library.json',root)));
const hash=s=>createHash('sha256').update(s).digest('hex');
function content(text){
 return text.split('\n').flatMap(line=>{
  const t=line.trim(),callout=t.match(/^\?\?\? note (".*")$/);
  if(callout){const label=JSON.parse(callout[1]);return label==='推演分支'?[]:[label];}
  return t&&!t.startsWith('??? info "局面图"')?[t]:[];
 }).join('\n');
}
test('all 110 collection entries preserve titles, text, images and existing tags',()=>{
 assert.equal(manifest.collections.length,6);
 assert.equal(manifest.articles.length,110);
 assert.equal(new Set(manifest.articles.map(a=>a.source)).size,110);
 for(const collection of manifest.collections){
  assert.ok(!existsSync(new URL('docs/'+collection.source,root)));
  const catalog=readFileSync(new URL('docs/'+collection.source.replace(/\.md$/,'/index.html'),root),'utf8');
  for(const article of manifest.articles.filter(a=>a.originalSource===collection.source)){
   assert.ok(catalog.includes(encodeURIComponent(article.source.split('/').at(-1).replace(/\.md$/,''))));
   assert.ok(catalog.includes(`id="${article.originalAnchor}"`));
  }
 }
 for(const entry of manifest.articles){
  const text=readFileSync(new URL('docs/'+entry.source,root),'utf8');
  const [,meta,body]=text.split('---\n');
  assert.ok(meta.includes(entry.title),entry.source);
  let originalBody=content(body);
  for(const correction of entry.corrections||[])originalBody=originalBody.replace(correction.to,correction.from);
  assert.equal(hash(originalBody),entry.contentHash,entry.source);
  assert.deepEqual([...body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]),entry.images);
  for(const tag of entry.tags)assert.ok(manifest.allowedTags.includes(tag),tag);
  const actualTags=meta.split('tags:')[1].split('mathjax:')[0].trim();
  assert.deepEqual(actualTags==='[]'?[]:actualTags.split('\n').map(t=>t.replace(/^- /,'')),entry.tags,entry.source);
  // Unknown days remain unknown, rather than taking the collection's arbitrary date.
  assert.equal(/^date:/m.test(meta),!!entry.date,entry.source);
 }
});
test('split changes no previously indexed mainline or variation and each indexed article is searchable',()=>{
 let indexed=0;
 for(const entry of manifest.articles){
  const games=library.games.filter(g=>g.source===entry.source);
  assert.equal(games.length,entry.gameIds.length,entry.source);
  for(const game of games)assert.equal(decodeURIComponent(game.url),entry.source.replace(/\.md$/,'/'));
  const hashes=games.flatMap(g=>g.lines.map(l=>hash(l.moves.join(' ')))).sort();
  if(entry.previousGameIds.length||!entry.corrections)assert.deepEqual(hashes,entry.replayHashes,entry.source);
  for(const correction of entry.corrections||[]){
   const game=games[0];assert.ok(game);
   assert.equal(positionKey(replay(game,'main').states[correction.diagramAfterPly]),positionKey(correction.diagramFen));
   assert.equal(game.lines[0].sources[1].chinese,'马8进7');
  }
  if(games.length)indexed++;
  for(const game of games)for(const line of game.lines){
   const {states}=replay(game,line.id);
   assert.equal(states.length,line.moves.length+1);
   assert.ok(lookup(library,states.at(-1)).hits.some(h=>h.gameId===game.id&&h.lineId===line.id));
   for(const source of line.sources)assert.ok(source.sourceLine>0&&source.chinese);
  }
 }
 assert.equal(indexed,106);
 assert.equal(manifest.articles.filter(a=>!a.gameIds.length).length,4);
});
