import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {lookup,replay} from '../docs/javascripts/xiangqi/library.mjs';
import {fen,index} from '../docs/javascripts/xiangqi/rules.mjs';
const manifest=JSON.parse(readFileSync(new URL('../data/chess/doubt-split.json',import.meta.url)));
const library=JSON.parse(readFileSync(new URL('../docs/assets/xiangqi/library.json',import.meta.url)));
const entries=JSON.parse(readFileSync(new URL('../data/chess/layout-format.json',import.meta.url))).articles;
const additions=JSON.parse(readFileSync(new URL('../data/chess/additional-articles.json',import.meta.url))).articles;
const directoriesOnly=process.env.LAYOUT_PHASE==='directories';
const base=process.env.BLOG_URL||'http://127.0.0.1:8001/';
const artifacts=process.env.DOUBT_ARTIFACTS||'.cache/doubt-split/browser';
mkdirSync(artifacts,{recursive:true});process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const browser=await chromium.launch({channel:'chrome'}),context=await browser.newContext({viewport:{width:1440,height:1100}});
const errors=[],results=[];
await context.route('https://music.163.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Music fixture</title>'}));
await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
await context.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/css',body:''}));
await context.route('https://unpkg.com/**',r=>r.fulfill({contentType:'text/javascript',body:'window.MathJax.typesetPromise=()=>Promise.resolve();'}));
await context.route('**/chessdb.php?**',r=>r.fulfill({body:'unknown',headers:{'Access-Control-Allow-Origin':'*'}}));
const watch=p=>p.on('pageerror',e=>errors.push(e.message));
const url=source=>new URL(source.replace(/index\.md$/,'').replace(/\.md$/,'/').split('/').map(encodeURIComponent).join('/'),base).href;
async function verify(){
try{
 const page=await context.newPage();watch(page);
 for(const entry of directoriesOnly?[]:entries){
  await page.setViewportSize({width:1440,height:1100});
  const response=await page.goto(url(entry.source),{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200,entry.source);
  const article=page.locator('article');
  assert.equal((await article.locator('h1').textContent()).trim(),entry.headingTitle);
  assert.deepEqual(await article.locator('h2').allTextContents(),entry.headings);
  if(entry.directoryArticle){
   const book=manifest.directoryArticles.find(a=>a.source===entry.source);
   assert.deepEqual(await article.locator('h3').allTextContents(),book.chapters);
   assert.ok(!(await article.innerText()).includes('暂无内容'));
  }
  assert.deepEqual(await article.locator('img[src*="raw.githubusercontent.com"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src'))),entry.images);
  assert.equal(await article.locator('details.info img[src*="raw.githubusercontent.com"]').count(),entry.images.length,entry.source);
  assert.equal(await article.locator('pre, blockquote').count(),0,entry.source+' unexpected code or quotation block');
  assert.ok(!(await article.innerText()).includes('???'),entry.source);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),entry.source+' desktop overflow');
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth,{}, {timeout:2000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),entry.source+' mobile overflow');
  results.push({source:entry.source,images:entry.images.length,desktop:true,mobile:true});
 }
 if(!directoriesOnly)console.log('Layout pages: all 18 articles and 313 source images, folded diagrams/branches, desktop/mobile layout passed.');
 await page.setViewportSize({width:1440,height:1100});
 const categories=new Map([
  ['布局棋理/index.md',['定式','疑形']],
  ['布局棋理/定式/index.md',['中炮对屏风马','仙人指路','顺炮']],
  ['布局棋理/疑形/index.md',['《疑形与攻击》','中炮对屏风马','仙人指路','列炮','顺炮']],
 ]);
 for(const [source,count] of [
  ['布局棋理/index.md',18+additions.filter(a=>a.source.startsWith('布局棋理/')).length],['布局棋理/疑形/index.md',14],
  ['布局棋理/定式/index.md',4+additions.filter(a=>a.source.startsWith('布局棋理/定式/')).length],
  ['布局棋理/疑形/中炮对屏风马/index.md',0],['布局棋理/疑形/仙人指路/index.md',3],
  ['布局棋理/疑形/列炮/index.md',2],['布局棋理/疑形/《疑形与攻击》/index.md',2],['布局棋理/疑形/顺炮/index.md',7],
 ]){
  const response=await page.goto(new URL(source.replace(/index\.md$/,''),base).href,{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200,source);
  const article=page.locator('article');
  if(count)assert.match(await article.innerText(),new RegExp('共 '+count+' 篇'));
  else assert.match(await article.innerText(),/暂无内容/);
  if(categories.has(source)){
   const expected=categories.get(source),links=article.locator('li a');
   assert.deepEqual(await links.allTextContents(),expected,source+' category links');
   for(let i=0;i<expected.length;i++){
    const href=new URL(await links.nth(i).getAttribute('href'),page.url()).href;
    assert.equal(href,new URL(expected[i]+'/',page.url()).href);
    assert.equal((await context.request.get(href)).status(),200);
   }
   if(directoriesOnly)await page.screenshot({path:artifacts+'/'+(source==='布局棋理/index.md'?'布局总目录':source.split('/').at(-2)+'目录')+'.png',fullPage:true});
  }
  if(source.startsWith('布局棋理/疑形/')&&source!=='布局棋理/疑形/index.md'){
   const expected=entries.filter(e=>(e.source.endsWith('/index.md')?e.source.split('/').slice(0,-2).join('/')+'/':e.source.slice(0,e.source.lastIndexOf('/')+1))===source.slice(0,source.lastIndexOf('/')+1));
   assert.equal(await article.locator('li a').count(),expected.length);
   for(const entry of expected){
    const href=await article.locator('li a').filter({hasText:entry.title}).getAttribute('href');
    assert.equal(new URL(href,page.url()).href,url(entry.source));
   }
  }
 }
 if(!directoriesOnly){
  await page.goto(new URL('布局棋理/疑形/顺炮/',base).href,{waitUntil:'domcontentloaded'});
  await page.screenshot({path:artifacts+'/顺炮目录.png',fullPage:true});
  await page.goto(url(entries.find(e=>e.source.endsWith('/拆炮补象捉骑河车.md')).source),{waitUntil:'domcontentloaded'});
  await page.screenshot({path:artifacts+'/具体疑形.png',fullPage:true});
 }
 for(const collection of manifest.collections){
  const response=await page.goto(url(collection.originalSource),{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200);
  assert.equal(await page.locator('li a').count(),manifest.articles.concat(manifest.directoryArticles).filter(a=>a.originalSource===collection.originalSource).length);
 }
 console.log('Layout navigation: all eight directory counts and five legacy URLs passed.');
 if(directoriesOnly){
  await page.goto(new URL('布局棋理/定式/',base).href,{waitUntil:'domcontentloaded'});
  for(const category of ['定式','疑形']){
   await page.locator('.md-tabs').getByRole('link',{name:'布局棋理',exact:true}).click();
   assert.equal(page.url(),new URL('布局棋理/',base).href);
   await page.locator('article').getByRole('link',{name:category,exact:true}).click();
   assert.equal(page.url(),new URL('布局棋理/'+category+'/',base).href);
   assert.equal((await page.locator('article h1').innerText()).trim(),category);
  }
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth,{}, {timeout:2000});
  assert.deepEqual(errors,[]);
  console.log('Layout directory regression passed: distinct overview and section pages, clickable categories, counts, mobile and no script errors.');
  return;
 }
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const root=page.locator('#xiangqi-analysis'),lib=page.locator('[data-library]'),input=root.locator('textarea');
 await lib.locator('.xq-library-count').waitFor({state:'attached'});
 await root.locator('.xq-library-toggle > summary').click();await root.locator('.xq-fen summary').click();
 await root.locator('.xq-history-toggle > summary').click();
 const action=a=>root.locator(`[data-action="${a}"]`).click();
 const importFen=async value=>{await input.fill(value);await action('import');assert.equal(await input.inputValue(),value);};
 let games=0,lines=0,switches=0;
 for(const entry of entries.filter(e=>e.gameId)){
  const game=library.games.find(g=>g.source===entry.source);games++;
  const item=()=>lib.locator('.xq-library-match').filter({has:page.locator(`button[data-game="${game.id}"]`)});
  let shared;
  for(const line of game.lines){
   for(const state of replay(game,line.id).states){
    const hits=lookup(library,state).hits.filter(h=>h.gameId===game.id);
    if(new Set(hits.map(h=>h.lineId)).size>1){shared={state,hits};break;}
   }
   if(shared)break;
  }
  for(const line of game.lines){
   const {states}=replay(game,line.id),last=states.at(-1);
   const selectShared=shared?.hits.some(h=>h.lineId===line.id);
   await importFen(fen(selectShared?shared.state:last));
   assert.equal(await item().locator('.xq-library-title').innerText(),game.title);
   const link=item().getByRole('link',{name:'跳转文章'});
   assert.equal(await link.getAttribute('href'),new URL(game.url,base).href);
   if(line.id==='main'){
    const [article]=await Promise.all([context.waitForEvent('page'),link.click()]);watch(article);
    await article.waitForLoadState('domcontentloaded');
    assert.equal(article.url(),new URL(game.url,base).href);
    assert.equal((await context.request.get(article.url())).status(),200);
    assert.equal((await article.locator('article h1').textContent()).trim(),entry.headingTitle);
    await article.close();
   }
   const select=item().locator('select');
   if(selectShared){assert.ok(await select.locator('option').count()>1);switches++;}
   if(await select.count())await select.selectOption(line.id);
   await item().locator(`button[data-line="${line.id}"]`).click();
   assert.equal(await input.inputValue(),fen(last));
   assert.deepEqual(await root.locator('.xq-history button').evaluateAll(nodes=>nodes.map(n=>n.title)),line.moves);
   assert.equal(await root.locator('.fen-board-pieces [data-piece]').count(),last.board.filter(Boolean).length);
   const destination=line.moves.at(-1).slice(2);
   assert.equal(await root.locator(`.fen-board-pieces [data-square="${destination}"]`).getAttribute('data-piece'),last.board[index(destination)]);
   await action('undo');assert.equal(await input.inputValue(),fen(states.at(-2)));
   assert.equal(await root.locator('.xq-history button').count(),line.moves.length-1);
   await action('redo');assert.equal(await input.inputValue(),fen(last));
   await action('first');assert.equal(await input.inputValue(),game.startFen);
   for(let ply=1;ply<=line.fromPly+1;ply++){await action('next');assert.equal(await input.inputValue(),fen(states[ply]));}
   if(line.fromPly+1<line.moves.length)await action('last');
   else assert.ok(await root.locator('[data-action="last"]').isDisabled());
   assert.equal(await input.inputValue(),fen(last));lines++;
  }
  console.log(`Layout study room: ${games}/14 articles, ${lines}/78 lines`);
 }
 assert.equal(games,14);assert.equal(lines,78);assert.ok(switches>0);assert.deepEqual(errors,[]);
 writeFileSync(artifacts+'/results.json',JSON.stringify({pages:results,study:{games,lines,switches},errors},null,2));
 console.log('Layout study room: all article links, 78 line selections, fork replay, history, undo and FEN checks passed.');
}finally{await browser.close();}
}
await verify();
