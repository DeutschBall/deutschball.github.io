import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {lookup,replay} from '../docs/javascripts/xiangqi/library.mjs';
import {fen,index,names} from '../docs/javascripts/xiangqi/rules.mjs';
const entries=JSON.parse(readFileSync(new URL('../data/chess/additional-articles.json',import.meta.url))).articles;
const data=JSON.parse(readFileSync(new URL('../docs/assets/xiangqi/library.json',import.meta.url)));
const base=process.env.BLOG_URL||'http://127.0.0.1:8001/';
const artifacts='.cache/additional-articles/browser';mkdirSync(artifacts,{recursive:true});
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const browser=await chromium.launch({channel:'chrome'}),context=await browser.newContext({viewport:{width:1440,height:1100}});
const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
await context.route('https://music.163.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Music fixture</title>'}));
await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
await context.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/css',body:''}));
await context.route('https://unpkg.com/**',r=>r.fulfill({contentType:'text/javascript',body:'window.MathJax.typesetPromise=()=>Promise.resolve();'}));
await context.route('**/chessdb.php?**',r=>r.fulfill({body:'unknown',headers:{'Access-Control-Allow-Origin':'*'}}));
const url=source=>new URL(source.replace(/\.md$/,'/').split('/').map(encodeURIComponent).join('/'),base).href;
try{
 const page=await context.newPage();
 for(const entry of entries){
  await page.setViewportSize({width:1440,height:1100});
  const response=await page.goto(url(entry.source),{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
  const article=page.locator('article');
  assert.equal((await article.locator('h1').textContent()).trim(),entry.headingTitle);
  assert.deepEqual(await article.locator('img[src*="raw.githubusercontent.com"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src'))),entry.images);
  assert.equal(await article.locator('details.info img[src*="raw.githubusercontent.com"]').count(),entry.images.length);
  assert.equal(await article.locator('pre, blockquote').count(),0);
  assert.ok(!(await article.innerText()).includes('???'));
  if(entry.source.endsWith('/顺炮直车两头蛇对双横车@2026.11.4.md')){
   assert.deepEqual(await article.locator('h2').allTextContents(),['马三进四','相七进九','车二进五','炮八平九']);
   assert.deepEqual(await article.locator('details.question > summary').allTextContents(),['车1平6','黑棋此时发难','车4进5','红先补士','红先骑河车']);
   assert.deepEqual(await article.locator('details.failure > summary').allTextContents(),entry.unnumberedAnalysis);
   await page.screenshot({path:artifacts+'/article-desktop.png',fullPage:true});
  }else{
   assert.deepEqual(await article.locator('h2').allTextContents(),entry.headings);
   assert.deepEqual(await article.locator('details.question > summary').allTextContents(),entry.questionTitles);
   assert.equal(await article.locator('.admonition.warning').count(),0);
   assert.ok((await article.innerText()).includes('退二又遭到马6进7踩'));
   await article.locator('details.question').first().locator('summary').first().click();
   assert.ok((await article.innerText()).includes('11、兵三进一 卒7进1'));
   await page.screenshot({path:artifacts+'/slow-rook-desktop.png',fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth,{}, {timeout:2000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 for(const [path,count] of [['布局棋理/',20],['布局棋理/定式/顺炮/',4]]){
  await page.goto(new URL(path,base).href,{waitUntil:'domcontentloaded'});
  assert.match(await page.locator('article').innerText(),new RegExp('共 '+count+' 篇'));
 }
 for(const entry of entries){
  const link=page.locator('article li a').filter({hasText:entry.title});
  assert.equal(new URL(await link.getAttribute('href'),page.url()).href,url(entry.source));
 }
 await page.setViewportSize({width:1440,height:1100});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const root=page.locator('#xiangqi-analysis'),lib=page.locator('[data-library]'),input=root.locator('textarea');
 await lib.locator('.xq-library-count').waitFor({state:'attached'});
 await root.locator('.xq-library-toggle > summary').click();await root.locator('.xq-fen summary').click();
 await root.locator('.xq-history-toggle > summary').click();
 const action=a=>root.locator(`[data-action="${a}"]`).click();
 const assertState=async value=>{
  assert.equal(await input.inputValue(),value);
  const match=lookup(data,value);
  assert.equal(await lib.locator('.xq-library-count').textContent(),`${match.mainlineCount} 局主线到过此局面 · ${match.variationCount} 个分析分支命中`);
 };
 const results=[];
 for(const entry of entries.filter(e=>e.indexed)){
  const game=data.games.find(g=>g.id===entry.gameId);
  const item=()=>lib.locator('.xq-library-match').filter({has:page.locator(`button[data-game="${game.id}"]`)});
  for(const line of game.lines){
   const {states}=replay(game,line.id),last=states.at(-1);
   const shared=states.find(state=>lookup(data,state).hits.filter(h=>h.gameId===game.id).length>1);
   await input.fill(fen(shared||last));await action('import');
   assert.equal(await item().locator('.xq-library-title').innerText(),entry.title);
   if(line.id==='main'){
    const [article]=await Promise.all([context.waitForEvent('page'),item().getByRole('link',{name:'跳转文章'}).click()]);
    await article.waitForLoadState('domcontentloaded');
    assert.equal(article.url(),url(entry.source));assert.equal((await context.request.get(article.url())).status(),200);
    assert.equal((await article.locator('article h1').textContent()).trim(),entry.headingTitle);await article.close();
   }
   const select=item().locator('select');
   if(shared)assert.ok(await select.locator('option').count()>1);
   if(await select.count())await select.selectOption(line.id);
   await item().locator(`button[data-line="${line.id}"]`).click();await assertState(fen(last));
   assert.deepEqual(await root.locator('.xq-history button').evaluateAll(nodes=>nodes.map(n=>n.title)),line.moves);
   assert.equal(await root.locator('.xq-piece').count(),last.board.filter(Boolean).length);
   const destination=line.moves.at(-1).slice(2);
   assert.equal(await root.locator(`[data-square="${destination}"] .xq-piece`).innerText(),names[last.board[index(destination)]]);
   await action('undo');await assertState(fen(states.at(-2)));
   assert.equal(await root.locator('.xq-history button').count(),line.moves.length-1);
   await action('redo');await assertState(fen(last));
   await action('first');await assertState(game.startFen);
   for(let ply=1;ply<=line.fromPly+1;ply++){await action('next');await assertState(fen(states[ply]));}
   if(line.fromPly+1<line.moves.length)await action('last');
   await assertState(fen(last));results.push({line:line.id,plies:line.moves.length,fromPly:line.fromPly});
  }
 }
 assert.equal(results.length,17);assert.equal(results.length,entries.reduce((sum,e)=>sum+e.lines.length,0));assert.deepEqual(errors,[]);
 writeFileSync(artifacts+'/results.json',JSON.stringify({articles:entries.map(e=>e.source),lines:results,errors},null,2));
 console.log('New studies: two article URLs, 48 folded diagrams, 17 mainline/branch replays, fork selection, history, undo, FEN and mobile checks passed.');
}finally{await browser.close();}
