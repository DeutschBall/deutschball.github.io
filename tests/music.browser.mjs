import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome'});
const base=process.env.BLOG_URL||'http://127.0.0.1:8001/';
try {
 for (const [random, id] of [[0,'3448038585'],[0.999,'1918901957']]) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  let loads=0;
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='music.163.com') {
    loads++;
    return route.fulfill({contentType:'text/html; charset=utf-8',body:'<button onclick="this.textContent=this.textContent===\'播放\'?\'暂停\':\'播放\'">播放</button>'});
   }
   if(url.origin!==new URL(base).origin)return route.abort();
   return route.continue();
  });
  await page.addInitScript(value=>{Math.random=()=>value;},random);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const panel=page.locator('#music-panel'),frame=page.locator('#music-panel iframe');
  await frame.waitFor();
  assert.equal(await panel.isVisible(),true);
  assert.equal(await page.locator('#blog-music button').count(),1);
  assert.equal(await page.locator('#blog-music audio, #blog-music select').count(),0);
  assert.match(await frame.getAttribute('src'),new RegExp(`id=${id}&auto=1`));
  assert.equal(await frame.getAttribute('allow'),'autoplay');
  const player=page.frameLocator('#music-panel iframe').getByRole('button');
  await player.click();
  assert.equal(await player.textContent(),'暂停');
  await page.locator('.music-toggle').click();
  assert.equal(await panel.isVisible(),false);
  await page.locator('.music-toggle').click();
  assert.equal(await panel.isVisible(),true);
  assert.equal(await player.textContent(),'暂停');
  assert.equal(loads,1);
  await player.click();
  assert.equal(await player.textContent(),'播放');
  const box=await panel.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
  await page.close();
 }
 console.log('Music: random selection, interactive native iframe, default expanded, collapse without reload, and mobile layout passed.');
}finally{await browser.close();}
