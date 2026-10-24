import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome'});
try {
 const page=await browser.newPage(),requests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/chessdb.php?**',async route=>{
  requests.push(new URL(route.request().url()));
  await new Promise(resolve=>setTimeout(resolve,500));
  try{await route.fulfill({body:'unknown',headers:{'Access-Control-Allow-Origin':'*'}});}catch{}
 });
 await page.goto(process.env.BLOG_URL||'http://127.0.0.1:8001/',{waitUntil:'domcontentloaded'});
 const root=page.locator('#xiangqi-analysis'),toggle=root.locator('.xq-cloud-toggle'),summary=toggle.locator(':scope > summary');
 await root.locator('.xq-square').first().waitFor();
 const move=async(from,to)=>{await root.locator(`[data-square="${from}"]`).click();await root.locator(`[data-square="${to}"]`).click();};
 assert.equal(await toggle.evaluate(e=>e.open),false);
 await move('h2','e2');await page.waitForTimeout(650);assert.equal(requests.length,0);
 await summary.click();await page.waitForTimeout(1100);assert.equal(requests.length,2);
 assert.ok(requests.every(u=>u.searchParams.get('board').endsWith(' b')));
 await summary.click();await move('h7','e7');await page.waitForTimeout(650);assert.equal(requests.length,2);
 await summary.click();await page.waitForTimeout(400);assert.equal(requests.length,4);
 // Collapse while responses are pending: they must not populate the hidden panel.
 await summary.click();await page.waitForTimeout(650);
 assert.equal(await toggle.evaluate(e=>e.open),false);
 assert.match(await root.locator('[data-cloud]').textContent(),/展开后查询/);
 await move('h0','g2');await page.waitForTimeout(650);assert.equal(requests.length,4);
 await summary.click();await page.waitForTimeout(1100);assert.equal(requests.length,6);
 assert.ok(requests.slice(-2).every(u=>u.searchParams.get('board').endsWith(' b')));
 assert.match(await root.locator('[data-cloud]').innerText(),/暂无此局面/);
 assert.deepEqual(errors,[]);
 console.log('Lazy cloud: zero requests on load/closed moves, current-position queries on expansion, cancellation and reopening passed.');
}finally{await browser.close();}
