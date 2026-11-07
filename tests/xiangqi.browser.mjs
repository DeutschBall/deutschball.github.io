import assert from 'node:assert/strict';
import {START} from '../docs/javascripts/xiangqi/rules.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=process.env.BLOG_URL || 'http://127.0.0.1:8001/';
const root=page.locator('#xiangqi-analysis');
const click=action=>root.locator(`[data-action="${action}"]`).click();
const square=c=>root.locator(`button[data-square="${c}"]`);
const ready=()=>root.locator('.fen-board-square').first().waitFor();
const turn=root.locator('[data-xq-turn]');
const fenPanel=root.locator('.xq-fen > summary'),fenInput=root.locator('textarea');
async function importFen(position) {
 await fenInput.fill(position);await click('import');await ready();
}
async function drag(from,to,button='left') {
 await root.locator('.xq-board').scrollIntoViewIfNeeded();
 const [start,end]=await Promise.all([square(from).boundingBox(),square(to).boundingBox()]);
 await page.mouse.move(start.x+start.width/2,start.y+start.height/2);
 await page.mouse.down({button});
 await page.mouse.move(end.x+end.width/2,end.y+end.height/2,{steps:8});
 await page.mouse.up({button});
}
try {
 await page.route('https://music.163.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Music fixture</title>'}));
 await page.route('**/javascripts/mathjax.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
 await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/css',body:''}));
 await page.goto(base,{waitUntil:'domcontentloaded'});await ready();
 assert.equal(await root.locator('.fen-board-figure[data-game="xiang"] .fen-board-xiang-grid').count(),1);
 assert.deepEqual(await root.locator('.fen-board-controls button[data-action]').evaluateAll(buttons=>buttons.map(button=>button.dataset.action)),['undo','redo','clear-arrows','export-fen']);
 assert.equal(await root.locator('.xq-board-toggle .xq-toolbar').count(),0);
 await page.addStyleTag({content:'#xiangqi-analysis summary::after { transition-duration:0s!important }'});
 const measurements=await root.evaluate(node=>{
  const folds=['.xq-board-toggle','.xq-history-toggle'].map(selector=>node.querySelector(selector));
  return [false,true].map(open=>folds.map(fold=>{
   fold.open=open;
   const summary=fold.querySelector('summary'),header=getComputedStyle(summary);
   const arrow=getComputedStyle(summary,'::after'),frame=getComputedStyle(fold);
   return [summary.getBoundingClientRect().height,header.padding,header.backgroundColor,
    frame.borderTop,frame.borderRadius,arrow.top,arrow.right,arrow.width,arrow.height,arrow.maskImage,arrow.transform];
  }));
 });
 for(const [board,native] of measurements)assert.deepEqual(board,native);
 await root.locator('.xq-cloud-toggle > summary').click();
 await page.waitForFunction(()=>document.querySelectorAll('.xq-candidates tbody tr').length>0,{},{timeout:20000});
 console.log('Live HTTPS/CORS: '+await root.locator('[data-cloud]').innerText());
 assert.equal(await root.locator('.fen-board-pieces [data-piece]').count(),32);
 await drag('h2','e2','right');await drag('h7','e7','right');
 assert.deepEqual(await root.locator('.fen-board-arrows .fen-board-arrow').evaluateAll(nodes=>nodes.map(node=>node.dataset.side)),['w','b']);
 await drag('h2','e2');
 assert.match(await turn.innerText(),/黑方/);
 assert.equal(await root.locator('.fen-board-arrows .fen-board-arrow').count(),0);
 assert.match(await root.locator('.xq-history').innerText(),/炮二平五/);
 await square('h7').click();await square('e7').click();
 await click('first');assert.match(await root.locator('[data-ply]').innerText(),/0 \/ 2/);
 await click('next');assert.match(await root.locator('[data-ply]').innerText(),/1 \/ 2/);
 await click('last');await click('undo');assert.match(await root.locator('[data-ply]').innerText(),/1 \/ 1/);
 await fenPanel.click();await click('export-fen');
 const exported=await fenInput.inputValue();assert.match(exported,/ b - - 1 1$/);
 await root.locator('.fen-board-status').filter({hasText:/已复制 FEN|请手动复制 FEN/}).waitFor();
 await root.locator('textarea').fill('bad');await click('import');assert.match(await root.locator('[data-message]').innerText(),/FEN/);assert.match(await turn.innerText(),/黑方/);
 await root.locator('textarea').fill(exported);await click('import');assert.match(await root.locator('[data-ply]').innerText(),/0 \/ 0/);
 await importFen(START);
 await page.waitForFunction(()=>document.querySelectorAll('.xq-candidates tbody tr').length>0);
 await root.locator('.xq-move').first().click();assert.match(await root.locator('[data-ply]').innerText(),/1 \/ 1/);
 await importFen(START);await page.waitForFunction(()=>document.querySelectorAll('.xq-candidates tbody tr').length>0);
 await fenPanel.click();
 await root.locator('.xq-table-wrap').evaluate(e=>e.scrollTop=0);
 await root.screenshot({path:process.env.SCREENSHOT_PATH || '/tmp/dustland-xiangqi-desktop.png',style:'.md-header,.md-top { visibility:hidden !important; }'});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await square('h2').click();await square('e2').click();assert.match(await turn.innerText(),/黑方/);
 await page.evaluate(()=>document.body.setAttribute('data-md-color-scheme','default'));
 await root.screenshot({path:'/tmp/dustland-xiangqi-mobile.png'});
 await context.setOffline(true);await click('retry');
 await page.waitForFunction(()=>document.querySelector('[data-cloud]').textContent.includes('无法连接'));
 await square('h7').click();await square('e7').click();assert.match(await turn.innerText(),/红方/);
 await context.setOffline(false);await click('retry');await page.waitForFunction(()=>!document.querySelector('[data-cloud]').textContent.includes('正在'));
 console.log('Default artwork, Material fold alignment, plugin controls, history, FEN, recommendation, mobile and offline operation: OK');
 // Deterministic late responses, unknown data, and terminal state handling.
 await page.route('https://www.chessdb.cn/chessdb.php?**',async route=>{
   const url=new URL(route.request().url()),turn=url.searchParams.get('board').split(' ')[1];
   if(turn==='w')await new Promise(r=>setTimeout(r,700));
   try{await route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},body:turn==='w'?'invalid board\0':'unknown\0'});}catch{}
 });
 await page.reload({waitUntil:'domcontentloaded'});await ready();await root.locator('.xq-cloud-toggle > summary').click();await click('retry');await page.waitForTimeout(100);
 await square('h2').click();await square('e2').click();await page.waitForTimeout(1100);
 assert.match(await root.locator('[data-cloud]').innerText(),/暂无此局面/);
 assert.equal(await root.locator('tbody tr').count(),0);
 await root.locator('.xq-fen summary').click();
 await root.locator('textarea').fill('3k5/9/9/9/9/9/9/9/3r1r3/4K4 w - - 0 1');await click('import');
 assert.match(await turn.innerText(),/困毙/);assert.equal(await root.locator('[data-action="retry"]').isDisabled(),true);
 console.log('Unknown state, stale response isolation, stalemate: OK');
 assert.deepEqual(errors,[]);
 const article=await context.newPage();let cloudCalls=0;article.on('request',r=>{if(r.url().includes('chessdb.php'))cloudCalls++;});
 await article.goto(new URL('tags/',base).href,{waitUntil:'domcontentloaded'});await article.waitForTimeout(500);assert.equal(cloudCalls,0);
 console.log('Article pages make no cloud requests; no page errors.');
}finally{await browser.close();}
