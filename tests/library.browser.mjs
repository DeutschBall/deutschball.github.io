import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {replay} from '../docs/javascripts/xiangqi/library.mjs';
import {START,fen,parseFen,play} from '../docs/javascripts/xiangqi/rules.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome'}),context=await browser.newContext({viewport:{width:1440,height:1200}}),page=await context.newPage();
const base=process.env.BLOG_URL||'http://127.0.0.1:8001/';
const data=JSON.parse(readFileSync(new URL('../docs/assets/xiangqi/library.json',import.meta.url))),game=data.games[0];
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const lib=page.locator('[data-library]'),root=page.locator('#xiangqi-analysis');
const waitCount=()=>lib.locator('.xq-library-count').waitFor();
const square=c=>root.locator(`[data-square="${c}"]`),action=a=>root.locator(`[data-action="${a}"]`).click();
try {
 await page.route('**/chessdb.php?**',r=>r.fulfill({body:'unknown',headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.goto(base,{waitUntil:'domcontentloaded'});await waitCount();
 assert.match(await lib.innerText(),/5 \/ 56 篇/);assert.match(await lib.locator('.xq-library-count').innerText(),/5 局主线.*0 个分析/);
 const articleURL=await lib.locator('a').first().getAttribute('href');const response=await context.request.get(articleURL);assert.equal(response.status(),200);assert.ok((await response.text()).includes(game.title));
 const fenInput=root.locator('textarea');
 assert.equal(await fenInput.inputValue(),START);
 for(const removed of ['按棋局去重，区分行棋方','实战归属待核实','仅收录明确编号着法','· 回放'])assert.ok(!(await lib.textContent()).includes(removed));
 const catalog=lib.locator('.xq-library-catalog');
 const openCatalog=async()=>{if(!await catalog.evaluate(e=>e.open))await catalog.locator(':scope > summary').click();};
 const expectCatalog=async count=>{assert.equal(await catalog.locator('summary').innerText(),`打开已收录棋谱（${count} 局）`);};
 await openCatalog();await expectCatalog(5);assert.equal(await catalog.locator('[data-line]').count(),5);
 await square('h2').click();await square('e2').click();assert.match(await lib.locator('.xq-library-count').innerText(),/5 局主线/);
 assert.equal(await fenInput.inputValue(),fen(play(parseFen(START),'h2e2')));
 assert.equal(await catalog.evaluate(e=>e.open),true);
 await action('undo');assert.equal(await fenInput.inputValue(),START);await square('a3').click();await square('a4').click();assert.match(await lib.locator('.xq-library-count').innerText(),/0 局主线/);assert.match(await lib.innerText(),/暂无匹配/);
 await expectCatalog(0);assert.equal(await catalog.locator('[data-line]').count(),0);
 await action('reset');await expectCatalog(5);await openCatalog();
 await lib.locator(`[data-game="${game.id}"][data-line="main"]`).click();assert.match(await root.locator('[data-ply]').innerText(),/20 \/ 20/);
 assert.equal(await fenInput.inputValue(),fen(replay(game,'main').states.at(-1)));await expectCatalog(1);
 await action('first');await expectCatalog(5);assert.equal(await fenInput.inputValue(),START);
 await action('next');assert.equal(await fenInput.inputValue(),fen(replay(game,'main').states[1]));
 await root.locator('.xq-fen summary').click();
 const importFen=async value=>{await fenInput.fill(value);await action('import');};
 await importFen(fen(replay(game,'pawn-push').states[20]));await expectCatalog(1);
 assert.equal(await catalog.locator('[data-line="main"]').count(),0);
 await openCatalog();await lib.locator('[data-line="pawn-push"]').click();assert.match(await root.locator('[data-ply]').innerText(),/22 \/ 22/);
 assert.equal(await fenInput.inputValue(),fen(replay(game,'pawn-push').states.at(-1)));
 await importFen(fen(replay(game,'main').states[10]).replace(/\d+ \d+$/,'30 99'));await expectCatalog(1);
 const currentFen=await fenInput.inputValue();await fenInput.fill('bad input');
 // An editor draft survives unrelated toggles; invalid import must not change the board/catalog.
 await page.locator('.xq-history-toggle > summary').click();assert.equal(await fenInput.inputValue(),'bad input');
 await page.locator('.xq-history-toggle > summary').click();await action('import');assert.equal(await fenInput.inputValue(),'bad input');await expectCatalog(1);
 await importFen(currentFen);
 for(const scheme of ['default','slate']){await page.evaluate(s=>document.body.setAttribute('data-md-color-scheme',s),scheme);assert.equal(await fenInput.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');assert.equal(await fenInput.evaluate(e=>getComputedStyle(e).color),'rgb(32, 33, 36)');}
 await context.setOffline(true);await action('reset');assert.match(await lib.locator('.xq-library-count').innerText(),/5 局主线/);await context.setOffline(false);
 for(const entry of data.games) {
  const link=lib.locator('a').filter({hasText:entry.title});
  const url=await link.getAttribute('href');const r=await context.request.get(url);assert.equal(r.status(),200);assert.ok((await r.text()).includes(entry.title));
 }
 for(const entry of data.games)for(const line of entry.lines) {
  await importFen(fen(replay(entry,line.id).states.at(-1)));
  await openCatalog();
  await lib.locator(`[data-game="${entry.id}"][data-line="${line.id}"]`).click();
  assert.equal(await root.locator('.xq-history button').count(),line.moves.length);
  assert.ok((await root.locator('[data-message]').innerText()).includes(entry.title));
 }
 await action('reset');
 console.log('All five source links and every mainline/variation replay passed.');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.setViewportSize({width:1440,height:1200});await lib.screenshot({path:'/tmp/dustland-library.png',style:'.md-header,.md-top {visibility:hidden!important;}'});
 await page.route('**/assets/xiangqi/library.json',r=>r.fulfill({status:503,body:'Unavailable'}));await page.reload({waitUntil:'domcontentloaded'});await lib.getByText('重试加载',{exact:true}).waitFor();assert.match(await lib.innerText(),/不能判断命中数量/);assert.equal(await lib.locator('.xq-library-count').count(),0);
 await page.unroute('**/assets/xiangqi/library.json');await lib.getByText('重试加载',{exact:true}).click();await waitCount();assert.deepEqual(errors,[]);
 console.log('Library browser: counts, article URL, moves/undo/FEN, replay, variation isolation, offline lookup, mobile, failure/retry passed.');
}finally{await browser.close();}
