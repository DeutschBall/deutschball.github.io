import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lookup,replay} from '../docs/javascripts/xiangqi/library.mjs';
import {START,fen,parseFen,play} from '../docs/javascripts/xiangqi/rules.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome'}),context=await browser.newContext({viewport:{width:1440,height:1200}}),page=await context.newPage();
const base=process.env.BLOG_URL||'http://127.0.0.1:8001/';
const data=JSON.parse(readFileSync(new URL('../docs/assets/xiangqi/library.json',import.meta.url))),game=data.games[0];
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const lib=page.locator('[data-library]'),root=page.locator('#xiangqi-analysis');
const action=a=>root.locator(`[data-action="${a}"]`).click(),fenInput=root.locator('textarea');
const matchState=async value=>{
 const result=lookup(data,value);
 assert.equal(await root.locator('[data-library-count]').innerText(),`${new Set(result.hits.map(h=>h.gameId)).size} 局匹配`);
 assert.equal(await lib.locator('.xq-library-match').count(),new Set(result.hits.map(h=>h.gameId)).size);
 assert.equal(await lib.locator('.xq-library-count').textContent(),`${result.mainlineCount} 局主线到过此局面 · ${result.variationCount} 个分析分支命中`);
 assert.equal(await fenInput.inputValue(),value);
};
try {
 await page.route('**/chessdb.php?**',r=>r.fulfill({body:'unknown',headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.goto(base,{waitUntil:'domcontentloaded'});await lib.locator('.xq-library-count').waitFor({state:'attached'});
 assert.equal(await root.locator('.xq-library-toggle').evaluate(e=>e.open),false);
 assert.equal(await root.locator('[data-library-count]').innerText(),'149 局匹配');
 assert.match(await lib.textContent(),/50 \/ 56 篇/);await matchState(START);
 assert.equal(await lib.getByRole('button',{name:'摆上棋谱',exact:true,includeHidden:true}).count(),149);
 assert.equal(await lib.locator('.xq-library-catalog').count(),0);
 for(const removed of ['按棋局去重，区分行棋方','实战归属待核实','仅收录明确编号着法','· 回放'])assert.ok(!(await lib.textContent()).includes(removed));
 await root.locator('[data-square="h2"]').click();await root.locator('[data-square="e2"]').click();await matchState(fen(play(parseFen(START),'h2e2')));
 await action('undo');await matchState(START);
 await action('redo');await matchState(fen(play(parseFen(START),'h2e2')));
 await action('undo');await matchState(START);
 await root.locator('.xq-library-toggle > summary').click();
 await root.locator('.xq-fen summary').click();
 const importFen=async value=>{await fenInput.fill(value);await action('import');await matchState(value);};
 // A legal empty-material position is absent from this opening-focused library.
 const unmatched='3k5/9/9/9/9/9/9/9/9/4K4 w - - 0 1';
 await importFen(unmatched);assert.equal(await lib.locator('.xq-library-match').count(),0);
 assert.match(await lib.textContent(),/暂无匹配/);
 await action('reset');await matchState(START);
 // Check every distinct article URL against the generated site, including monthly compilations.
 const articles=[...new Map(data.games.map(g=>[g.source,g])).values()];
 for(let i=0;i<articles.length;i+=8)await Promise.all(articles.slice(i,i+8).map(async entry=>{
  const response=await context.request.get(new URL(entry.url,base).href);assert.equal(response.status(),200,entry.source);
 }));
 // Rule tests replay every imported line; browser exercises all curated lines plus a monthly game and a long branch.
 const curated=data.games.slice(0,5).flatMap(g=>g.lines.map(line=>({entry:g,line})));
 const monthly=data.games.find(g=>g.source.includes('复盘-2025.5.md'));
 const longest=data.games.flatMap(entry=>entry.lines.map(line=>({entry,line}))).sort((a,b)=>b.line.moves.length-a.line.moves.length)[0];
 for(const {entry,line} of [...curated,{entry:monthly,line:monthly.lines[0]},longest]) {
  await importFen(fen(replay(entry,line.id).states.at(-1)));
  const select=lib.locator(`select[data-game="${entry.id}"]`);if(await select.count())await select.selectOption(line.id);
  await lib.locator(`button[data-game="${entry.id}"][data-line="${line.id}"]`).click();
  assert.equal(await root.locator('.xq-history button').count(),line.moves.length);
  assert.ok((await root.locator('[data-message]').innerText()).includes(entry.title));
 }
 await importFen(fen(replay(game,'main').states[10]).replace(/\d+ \d+$/,'30 99'));
 const value=await fenInput.inputValue();await fenInput.fill('invalid input');await action('import');assert.equal(await fenInput.inputValue(),'invalid input');
 await importFen(value);
 for(const scheme of ['default','slate']){await page.evaluate(s=>document.body.setAttribute('data-md-color-scheme',s),scheme);assert.equal(await fenInput.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');}
 await context.setOffline(true);await action('reset');await matchState(START);await context.setOffline(false);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.route('**/assets/xiangqi/library.json',r=>r.fulfill({status:503,body:'Unavailable'}));
 await page.reload({waitUntil:'domcontentloaded'});await root.locator('.xq-library-toggle > summary').click();await lib.getByText('重试加载',{exact:true}).waitFor();assert.equal(await lib.locator('.xq-library-count').count(),0);
 assert.equal(await root.locator('[data-library-count]').innerText(),'加载失败');
 await page.unroute('**/assets/xiangqi/library.json');await lib.getByText('重试加载',{exact:true}).click();await lib.locator('.xq-library-count').waitFor();
 assert.deepEqual(errors,[]);
 console.log(`Library browser: ${articles.length} article URLs, 149 initial matches, sampled mainline/branch replay, FEN, offline, mobile and recovery passed.`);
}finally{await browser.close();}
