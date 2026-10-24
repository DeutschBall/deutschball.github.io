import assert from 'node:assert/strict';
import {chromium} from 'playwright';
// A 30-second silent WAV exercises real media play/pause without relying on NetEase.
const pcm=Buffer.alloc(8000*2*30),wav=Buffer.alloc(44+pcm.length);
wav.write('RIFF');wav.writeUInt32LE(36+pcm.length,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);
wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length,40);pcm.copy(wav,44);
const browser=await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required']});
const base=process.env.BLOG_URL||'http://127.0.0.1:8001/';
async function makePage() {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='music.163.com')return route.fulfill({contentType:'audio/wav',body:wav});
  if(url.origin!==new URL(base).origin)return route.abort();
  return route.continue();
 });
 return page;
}
try {
 const page=await makePage();
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const panel=page.locator('#music-panel'),audio=page.locator('#blog-music audio');
 await page.waitForFunction(()=>{const a=document.querySelector('#blog-music audio');return a&&!a.paused&&a.currentTime>0;});
 assert.equal(await panel.isVisible(),true);
 assert.deepEqual(await panel.locator('button').allTextContents(),['上一曲','暂停','下一曲']);
 assert.equal(await page.locator('#blog-music iframe, #blog-music select, #blog-music a').count(),0);
 await page.locator('[data-music-play]').click();
 assert.equal(await audio.evaluate(a=>a.paused),true);
 const pausedTime=await audio.evaluate(a=>a.currentTime);
 await page.locator('[data-music-play]').click();
 await page.waitForFunction(t=>document.querySelector('#blog-music audio').currentTime>t,pausedTime);
 await page.locator('.music-toggle').click();
 assert.equal(await panel.isVisible(),false);
 assert.equal(await audio.evaluate(a=>a.paused),false);
 await page.locator('.music-toggle').click();
 await page.locator('[data-music-next]').click();
 assert.match(await audio.getAttribute('src'),/1918901957/);
 await page.locator('[data-music-next]').click();
 assert.match(await audio.getAttribute('src'),/3448038585/);
 await page.locator('[data-music-prev]').click();
 assert.match(await audio.getAttribute('src'),/1918901957/);
 await audio.evaluate(a=>a.dispatchEvent(new Event('ended')));
 assert.match(await audio.getAttribute('src'),/3448038585/);
 const box=await panel.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
 // Simulate autoplay rejection, then verify a user click can retry the real media method.
 const blocked=await makePage();
 await blocked.addInitScript(()=>{
  const original=HTMLMediaElement.prototype.play;
  let first=true;
  HTMLMediaElement.prototype.play=function(){if(first){first=false;this.autoplay=false;return Promise.reject(new DOMException('blocked','NotAllowedError'));}return original.call(this);};
 });
 await blocked.goto(base,{waitUntil:'domcontentloaded'});
 await blocked.getByText('点击播放，开始听歌。',{exact:true}).waitFor();
 assert.equal(await blocked.locator('[data-music-play]').innerText(),'播放');
 await blocked.locator('[data-music-play]').click();
 await blocked.waitForFunction(()=>!document.querySelector('#blog-music audio').paused);
 console.log('Music: default expanded/autoplay, real pause/resume, collapse without stopping, previous/next wrap, ended advance, mobile and autoplay rejection passed.');
}finally{await browser.close();}
