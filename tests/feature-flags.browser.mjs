import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, extname} from 'node:path';
import {createServer} from 'node:http';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const temp=await mkdtemp(join(tmpdir(),'blog-feature-flags-'));
const variants=[{},...['quotes','cloud_analysis','chess_library','home_music','xiangqi'].map(key=>({[key]:false})),
  {xiangqi:false,home_music:false,floating_music:true},
  {quotes:false,cloud_analysis:false,chess_library:false}];
const server=createServer(async(req,res)=>{
  try {
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path.includes('..'))throw Error('Invalid path');
    const file=join(temp,path.endsWith('/')?path+'index.html':path);
    const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'};
    res.setHeader('Content-Type',types[extname(file)]||'text/plain');
    res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
let browser;
try {
  for(const [i,flags] of variants.entries()) {
    const result=spawnSync(process.env.PYTHON||'python3',['-c',`
import json, sys
from mkdocs.config import load_config
from mkdocs.commands.build import build
config = load_config(config_file='mkdocs.yml', site_dir=sys.argv[1])
config['extra']['feature_flags'].update(json.loads(sys.argv[2]))
build(config)
`,join(temp,String(i)),JSON.stringify(flags)],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
  }
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({channel:'chrome'});
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const [i,flags] of variants.entries()) {
    const page=await browser.newPage(),requests=[],errors=[];
    page.on('request',req=>requests.push(req.url()));
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{
      const url=route.request().url();
      // Keep these feature tests independent of the external MathJax CDN.
      if(url.endsWith('/javascripts/mathjax.js'))return route.fulfill({contentType:'text/javascript',body:''});
      if(url.includes('chessdb.php'))return route.fulfill({body:'unknown',headers:{'Access-Control-Allow-Origin':'*'}});
      return url.startsWith(origin)?route.continue():route.abort();
    });
    await page.goto(`${origin}/${i}/`,{waitUntil:'networkidle'});
    const enabled=key=>flags[key]!==false;
    const root=page.locator('#xiangqi-analysis');
    assert.equal(await root.count(),enabled('xiangqi')?1:0);
    assert.equal(await page.locator('.md-content iframe').count(),enabled('home_music')?1:0);
    assert.equal(await page.locator('#blog-music').count(),flags.floating_music?1:0);
    if(enabled('xiangqi')) {
      await root.locator('.xq-square').first().waitFor();
      assert.equal(await root.locator('[data-quote]').count(),enabled('quotes')?1:0);
      assert.equal(await root.locator('.xq-cloud-toggle').count(),enabled('cloud_analysis')?1:0);
      assert.equal(await root.locator('.xq-library').count(),enabled('chess_library')?1:0);
      const before=await root.locator('textarea').inputValue();
      await root.locator('[data-square="h2"]').press('Enter');
      await root.locator('[data-square="e2"]').press('Enter');
      assert.notEqual(await root.locator('textarea').inputValue(),before);
      await root.locator('[data-action="undo"]').click();
      assert.equal(await root.locator('textarea').inputValue(),before);
      if(enabled('cloud_analysis')) {
        await root.locator('.xq-cloud-toggle > summary').click();
        await page.waitForFunction(()=>document.querySelector('[data-cloud]').textContent.includes('暂无此局面'));
      }
    }
    assert.equal(requests.some(url=>url.includes('quotes.txt')),enabled('xiangqi')&&enabled('quotes'));
    assert.equal(requests.some(url=>url.includes('library.json')),enabled('xiangqi')&&enabled('chess_library'));
    assert.equal(requests.some(url=>url.includes('chessdb.php')),enabled('xiangqi')&&enabled('cloud_analysis'));
    assert.equal(requests.some(url=>url.includes('xiangqi-loader.js')),enabled('xiangqi'));
    assert.equal(requests.some(url=>url.endsWith('/music.js')),Boolean(flags.floating_music));
    assert.deepEqual(errors,[]);
    await page.close();
    console.log(`Feature flags passed: ${JSON.stringify(flags)}`);
  }
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
  await rm(temp,{recursive:true,force:true});
}
