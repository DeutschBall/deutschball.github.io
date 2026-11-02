import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {lookup,replay} from '../docs/javascripts/xiangqi/library.mjs';
import {fen} from '../docs/javascripts/xiangqi/rules.mjs';
// Remote font loading must not stall content/layout screenshots.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const manifest=JSON.parse(readFileSync(new URL('../data/chess/'+(process.env.REVIEW_MANIFEST||'split-manifest.json'),import.meta.url)));
const library=JSON.parse(readFileSync(new URL('../docs/assets/xiangqi/library.json',import.meta.url)));
const base=process.env.BLOG_URL||'http://127.0.0.1:8001/';
const browser=await chromium.launch({channel:'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
context.setDefaultNavigationTimeout(Number(process.env.REVIEW_TIMEOUT||30000));
const errors=[],results=[];
const phase=process.env.SPLIT_PHASE||'all',offset=Number(process.env.SPLIT_OFFSET||0),limit=Number(process.env.SPLIT_LIMIT||100000);
const studyEntries=manifest.articles.filter(a=>a.gameIds.length).slice(offset,offset+limit);
const pageEntries=manifest.articles.slice(offset,offset+limit);
const artifactDir=process.env.SPLIT_ARTIFACTS||'../.tools/split-browser';mkdirSync(artifactDir,{recursive:true});
await context.route('https://music.163.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Music fixture</title>'}));
// Content migration does not depend on remote font/CDN availability.
await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
await context.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/css',body:''}));
await context.route('https://unpkg.com/**',r=>r.fulfill({contentType:'text/javascript',body:'window.MathJax.typesetPromise=()=>Promise.resolve();'}));
await context.route('**/chessdb.php?**',r=>r.fulfill({body:'unknown',headers:{'Access-Control-Allow-Origin':'*'}}));
try{
 if(phase!=='study'){
 // Every split article gets desktop/mobile DOM and layout validation.
 let next=0;
 await Promise.all(Array.from({length:Number(process.env.REVIEW_WORKERS||2)},async()=>{
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  while(next<pageEntries.length){
   const entry=pageEntries[next++],url=new URL(entry.source.replace(/\.md$/,'/'),base).href;
   await page.setViewportSize({width:1440,height:1000});
   const response=await page.goto(url,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200,entry.source);
   assert.equal((await page.locator('article h1').textContent()).trim(),entry.title);
   const created=page.locator('article .dd-item:has([data-icon="doc_created"]) time');
   assert.equal(await created.count(),entry.date?1:0);
   if(entry.date)assert.equal(await created.textContent(),entry.date);
   const images=await page.locator('article details img').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')));
   assert.deepEqual(images,entry.images,entry.source);
   assert.equal(await page.locator('article pre').count(),0,'unexpected code block: '+entry.source);
   assert.equal(await page.locator('article blockquote').count(),0,'unconverted quotation: '+entry.source);
   assert.equal(await page.locator('article').evaluate(el=>el.innerText.includes('???')),false,entry.source);
   const callouts=await page.locator('article details').evaluateAll(nodes=>nodes.map(n=>n.querySelector('summary')?.textContent));
   assert.equal(await page.locator('article details.info img').count(),entry.images.length,entry.source);
   if(!process.env.REVIEW_MANIFEST)assert.equal(callouts.filter(s=>s==='局面图').length,entry.images.length,entry.source);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,entry.source);
   await page.setViewportSize({width:390,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,entry.source);
   // Each former collection gets a representative screenshot for comparison.
   if(entry.ordinal===1)await page.screenshot({path:`${artifactDir}/${(entry.originalSource||entry.source).split('/').at(-1)}.png`,fullPage:true});
   results.push({source:entry.source,title:entry.title,images:images.length,callouts:callouts.length,desktop:true,mobile:true,indexed:entry.gameIds.length>0});
   if(results.length%10===0)console.log(`Review article pages: ${results.length}/${pageEntries.length}`);
  }
  await page.close();
 }));
 // Original collection URLs still enumerate all their split articles.
 for(const c of manifest.collections||[]){
  const page=await context.newPage();
  const response=await page.goto(new URL(c.source.replace(/\.md$/,'/'),base).href,{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200);assert.equal(await page.locator('li a').count(),c.entries.length);await page.close();
 }
 assert.deepEqual(errors,[]);
 assert.equal(results.length,pageEntries.length);
 writeFileSync(`${artifactDir}/results-pages-${offset}.json`,JSON.stringify({base,articles:results,errors},null,2));
 console.log(`Review page checks passed: ${results.length} articles, ${(manifest.collections||[]).length} catalogs.`);
 }
 if(phase!=='pages'){
 // Actually load every indexed line in the study room and verify history, FEN and undo.
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const root=page.locator('#xiangqi-analysis'),lib=page.locator('[data-library]'),input=root.locator('textarea');
 await lib.locator('.xq-library-count').waitFor({state:'attached'});
 await root.locator('.xq-library-toggle > summary').click();await root.locator('.xq-fen summary').click();
 const action=a=>root.locator(`[data-action="${a}"]`).click();
 let articles=0,lines=0;
 for(const entry of studyEntries){
  for(const game of library.games.filter(g=>g.source===entry.source)){
   articles++;
   for(const line of game.lines){
    const {states}=replay(game,line.id),last=fen(states.at(-1));
    assert.ok(lookup(library,last).hits.some(h=>h.gameId===game.id&&h.lineId===line.id));
    await input.fill(last);await action('import');
    const item=lib.locator('.xq-library-match').filter({has:page.locator(`button[data-game="${game.id}"]`)});
    const link=item.getByRole('link',{name:'跳转文章'});
    assert.equal(await link.getAttribute('href'),new URL(game.url,base).href);
    if(line.id==='main'){
     const [article]=await Promise.all([context.waitForEvent('page'),link.click()]);
     article.on('pageerror',e=>errors.push(e.message));
     await article.waitForLoadState('domcontentloaded');assert.equal(decodeURI(article.url()),decodeURI(new URL(game.url,base).href));
     assert.equal((await article.locator('article h1').textContent()).trim(),entry.title);await article.close();
    }
    const select=item.locator('select');if(await select.count())await select.selectOption(line.id);
    await item.locator('button').click();
    assert.equal(await input.inputValue(),last);
    assert.deepEqual(await root.locator('.xq-history button').evaluateAll(nodes=>nodes.map(n=>n.title)),line.moves);
    await action('undo');assert.equal(await input.inputValue(),fen(states.at(-2)));
    await action('redo');assert.equal(await input.inputValue(),last);lines++;
   }
  }
  if(articles&&articles%10===0)console.log(`Review study room: ${articles}/${studyEntries.length} articles, ${lines} lines`);
 }
 assert.equal(articles,studyEntries.length);assert.deepEqual(errors,[]);
 writeFileSync(`${artifactDir}/results-study-${offset}.json`,JSON.stringify({base,sources:studyEntries.map(a=>a.source),studyRoom:{articles,lines},errors},null,2));
 console.log(`Review study batch passed: offset ${offset}, ${articles} indexed articles / ${lines} lines.`);
 }
}finally{await browser.close();}
