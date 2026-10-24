import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser = await chromium.launch({channel:'chrome'});
try {
  const context = await browser.newContext({viewport:{width:390,height:844}});
  const page = await context.newPage();
  const base = process.env.BLOG_URL || 'http://127.0.0.1:8001/';
  let musicRequests=0;
  await context.route('**/*', route => {
    const url=new URL(route.request().url());
    if(url.hostname==='music.163.com') {musicRequests++; return route.fulfill({contentType:'text/html',body:'<p>网易云测试播放器</p>'});}
    if(url.origin!==new URL(base).origin) return route.abort();
    return route.continue();
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('.music-toggle').waitFor();
  assert.equal(musicRequests,0);
  await page.locator('.music-toggle').click();
  const player=page.frameLocator('.music-frame');
  await player.locator('#netease-player iframe').waitFor();
  assert.match(await player.locator('#netease-player iframe').getAttribute('src'),/id=3448038585/);
  await player.locator('#music-tracks').selectOption('1918901957');
  assert.equal(await player.locator('#netease-player iframe').count(),1);
  assert.match(await player.locator('#netease-player iframe').getAttribute('src'),/id=1918901957/);
  const panel=await page.locator('#music-panel').boundingBox();
  assert.ok(panel.x>=0 && panel.x+panel.width<=390);
  await player.locator('#music-stop').click();
  assert.equal(await player.locator('#netease-player iframe').count(),0);
  await player.locator('#music-start').click();
  await player.locator('#netease-player iframe').waitFor();
  await page.locator('.music-toggle').click();
  assert.equal(await player.locator('#netease-player iframe').count(),1);
  await page.locator('.music-toggle').click();
  const popupPromise=context.waitForEvent('page');
  await page.locator('[data-music-window]').click();
  const popup=await popupPromise;
  await popup.locator('#netease-player iframe').waitFor();
  assert.equal(await page.locator('.music-frame').getAttribute('src'),null);
  await page.goto(new URL('tags/',base).href,{waitUntil:'domcontentloaded'});
  await page.locator('.music-toggle').waitFor();
  assert.equal(await popup.locator('#netease-player iframe').count(),1);
  console.log('Music: deferred loading, two song IDs, single player, stop/restart, collapse, mobile and independent window passed (NetEase response mocked).');
} finally {await browser.close();}
