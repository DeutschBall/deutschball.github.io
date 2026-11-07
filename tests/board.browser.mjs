import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {basename, dirname, extname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {START, coord, fen, parseFen, play} from '../docs/javascripts/xiangqi/rules.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const tempParent=await realpath(tmpdir());
const temp=await mkdtemp(join(tempParent,'blog-boards-'));
const docs=join(temp,'docs'), site=join(temp,'site');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.wav':'audio/wav'};
const server=createServer(async(req,res)=>{
  try {
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(site,'.'+path+(path.endsWith('/')?'index.html':''));
    assert.ok(file.startsWith(site+sep));
    const data=await readFile(file);
    res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
let browser;
try {
  await mkdir(join(docs,'nested'),{recursive:true});
  const theme=join(temp,'theme');
  await mkdir(theme);
  const iconSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#82181a"/></svg>';
  const position='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';
  // A 100 ms, 8 kHz PCM WAV fixture for testing playback without external media.
  const wav=Buffer.alloc(844,128);
  wav.write('RIFF',0);
  wav.writeUInt32LE(wav.length-8,4);
  wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16);
  wav.writeUInt16LE(1,20);
  wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(8000,24);
  wav.writeUInt32LE(8000,28);
  wav.writeUInt16LE(1,32);
  wav.writeUInt16LE(8,34);
  wav.write('data',36);
  wav.writeUInt32LE(wav.length-44,40);
  await Promise.all([
    copyFile(join(root,'tests','fixtures','boards.md'),join(docs,'index.md')),
    writeFile(join(temp,'mkdocs.yml'),`site_name: FEN boards
theme: {name: mkdocs, highlightjs: false}
plugins:
  - search
  - chess:
      themes: {test: theme/theme.json}
      defaults: {chess: {pieces: test}}
      sounds: {move: tone.wav, capture: tone.wav}
`),
    writeFile(join(temp,'tone.wav'),wav),
    writeFile(join(theme,'piece.svg'),iconSvg),
    writeFile(join(theme,'board.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="480"><rect width="400" height="480" fill="#856443"/></svg>'),
    writeFile(join(theme,'theme.json'),JSON.stringify({
      game:'chess',
      board:{image:'board.svg',size:[400,480],origin:[25,30],step:[50,60]},
      pieces:{images:Object.fromEntries(Array.from('KQRBNPkqrbnp',piece=>[piece,'piece.svg']))},
    })),
    writeFile(join(docs,'nested','game.md'),`???+ chess board-test "${position}"\n\n!!! chess pieces-default "${position}"\n`),
  ]);
  const build=spawnSync(process.env.PYTHON||(process.platform==='win32'?'python':'python3'),
    ['-m','mkdocs','build','--strict'],{cwd:temp,encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'}});
  assert.equal(build.status,0,build.error?.message||build.stderr||build.stdout);

  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({channel:'chrome'});
  const offline=page=>page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const noJs=await browser.newPage({javaScriptEnabled:false});
  await offline(noJs);
  assert.equal((await noJs.goto(origin)).status(),200);
  assert.equal(await noJs.locator('figure[data-game="xiang"] .fen-board-pieces [data-piece]').count(),96);
  assert.equal(await noJs.locator('figure[data-game="chess"]').count(),4);
  assert.equal(await noJs.locator('.fen-board-controls').count(),0);
  assert.equal(await noJs.locator('details.xiang .fen-board-title').first().textContent(),'局面');
  assert.equal(await noJs.locator('details.chess .fen-board-title').first().textContent(),'Position');
  await noJs.close();

  const page=await browser.newPage({viewport:{width:1280,height:920}});
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.addInitScript(() => {
    window.playedSounds=[];
    window.Audio=class extends window.Audio {
      constructor(url) {
        super(url);
        this.addEventListener('playing',() => window.playedSounds.push(new URL(this.src).pathname.split('/').at(-1)));
      }
    };
  });
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await offline(page);
  assert.equal((await page.goto(origin)).status(),200);
  assert.equal(await page.locator('link[href$="mkdocs-chess-plugin/board.css"]').count(),1);
  const xiang=page.locator('details.xiang.fen-board').first();
  const chess=page.locator('details.chess.fen-board').first();
  const button=(board,square)=>board.locator(`button[data-square="${square}"]`);
  const piece=(board,square)=>board.locator(`g[data-square="${square}"][data-piece]`);
  const action=(board,name)=>board.locator(`[data-action="${name}"]`);
  const title=board=>board.locator('summary .fen-board-title').textContent();
  const exportFen=async(board,expected)=>{
    await action(board,'export-fen').click();
    await board.getByText('已复制 FEN',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected);
  };
  const center=async locator=>{
    const bounds=await locator.boundingBox();
    assert.ok(bounds);
    return {x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
  };
  const move=async(board,from,to)=>{
    await button(board,from).click();
    assert.equal(await button(board,to).evaluate(el=>el.classList.contains('fen-board-target')),true);
    await button(board,to).click();
  };
  const drag=async(board,from,to)=>{
    const surface=board.locator('.fen-board-surface');
    await surface.scrollIntoViewIfNeeded();
    const start=await center(button(board,from));
    const end=to ? await center(button(board,to)) : {x:(await surface.boundingBox()).x-12,y:start.y};
    await page.mouse.move(start.x,start.y);
    await page.mouse.down();
    await page.mouse.move(end.x,end.y,{steps:8});
    const ghost=surface.locator('.fen-board-drag-piece');
    assert.equal(await ghost.count(),1);
    assert.equal(await piece(board,from).getAttribute('visibility'),'hidden');
    await page.mouse.up();
    assert.equal(await ghost.count(),0);
  };
  const drawArrow=async(board,from,to,side)=>{
    await board.locator('.fen-board-surface').scrollIntoViewIfNeeded();
    const start=await center(button(board,from));
    const end=await center(button(board,to));
    await page.mouse.move(start.x,start.y);
    await page.mouse.down({button:'right'});
    await page.mouse.move(end.x,end.y,{steps:8});
    const draft=board.locator('.fen-board-arrow-draft .fen-board-arrow');
    assert.equal(await draft.count(),1);
    if (side) assert.equal(await draft.getAttribute('data-side'),side);
    await page.mouse.up({button:'right'});
    assert.equal(await draft.count(),0);
  };
  const icon=async(board,color)=>{
    assert.equal(await board.getAttribute('data-turn'),color);
    assert.equal(await board.locator(`.fen-board-icon[data-color="${color}"]`).isVisible(),true);
    assert.equal(await board.locator(`.fen-board-icon[data-color="${color==='w'?'b':'w'}"]`).isVisible(),false);
  };
  const open=board=>board.locator('summary').click();
  assert.equal(await xiang.evaluate(el=>el.open),false);
  assert.equal(await chess.evaluate(el=>el.open),true);
  assert.equal(await button(xiang,'h2').count(),0);
  await xiang.locator('summary').press('Enter');
  await icon(xiang,'w');
  const annotations=xiang.locator('.fen-board-arrows');
  await drawArrow(xiang,'h2','e2','w');
  await drawArrow(xiang,'h7','e7','b');
  await drawArrow(xiang,'e4','e2','w');
  assert.deepEqual(await annotations.locator('text').allTextContents(),['1','2','3']);
  assert.deepEqual(await annotations.locator('.fen-board-arrow-ink').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).color)),
    ['rgb(0, 200, 61)','rgb(142, 61, 204)','rgb(0, 200, 61)']);
  assert.equal(await annotations.locator('.fen-board-arrow-origin').count(),2);
  assert.equal(await xiang.locator('figure').getAttribute('data-fen'),START);
  assert.equal(await action(xiang,'undo').isDisabled(),true);
  assert.equal(await chess.locator('.fen-board-arrows .fen-board-arrow').count(),0);
  const firstBadge=await center(annotations.locator('.fen-board-arrow-badge').first());
  await page.mouse.click(firstBadge.x,firstBadge.y,{button:'right'});
  assert.deepEqual(await annotations.locator('text').allTextContents(),['1','2']);
  assert.equal(await annotations.locator('.fen-board-arrow-origin').count(),1);
  await drag(xiang,'h2','g3');
  assert.equal(await annotations.locator('.fen-board-arrow').count(),2);
  assert.deepEqual(await page.evaluate(()=>window.playedSounds),[]);
  await drag(xiang,'h2','e2');
  await icon(xiang,'b');
  assert.equal(await annotations.locator('.fen-board-arrow').count(),0);
  const after=play(parseFen(START),'h2e2');
  const ring=square=>button(xiang,square).evaluate(node=>{
    const style=getComputedStyle(node,'::before');
    return style.content==='none'?0:parseFloat(style.width);
  });
  assert.equal(await xiang.locator('figure').getAttribute('data-fen'),fen(after));
  assert.equal(await title(xiang),'局面');
  await page.waitForFunction(()=>window.playedSounds.includes('move.wav'));
  await exportFen(xiang,fen(after));
  assert.equal(await piece(xiang,'e2').getAttribute('data-piece'),'C');
  const fromRing=await ring('h2');
  const toRing=await ring('e2');
  assert.ok(fromRing>0&&toRing>fromRing);
  await drawArrow(xiang,'d5','f1','b');
  await action(xiang,'undo').click();
  await icon(xiang,'w');
  assert.equal(await xiang.locator('figure').getAttribute('data-fen'),START);
  assert.equal(await title(xiang),'局面');
  await exportFen(xiang,START);
  assert.equal(await ring('h2'),0);
  assert.equal(await ring('e2'),0);
  assert.equal(await annotations.locator('.fen-board-arrow').count(),0);
  await drawArrow(xiang,'d5','f1');
  await action(xiang,'redo').click();
  await icon(xiang,'b');
  assert.equal(await title(xiang),'局面');
  assert.equal(await ring('h2'),fromRing);
  assert.equal(await ring('e2'),toRing);
  assert.equal(await annotations.locator('.fen-board-arrow').count(),0);
  await drawArrow(xiang,'d5','f1');
  await action(xiang,'clear-arrows').click();
  assert.equal(await annotations.locator('.fen-board-arrow').count(),0);
  assert.equal(await action(xiang,'clear-arrows').isDisabled(),true);

  await icon(chess,'w');
  const startFen=await chess.locator('figure').getAttribute('data-fen');
  for (const target of ['e5',null]) {
    await drag(chess,'e2',target);
    assert.equal(await chess.locator('figure').getAttribute('data-fen'),startFen);
    assert.equal(await piece(chess,'e2').getAttribute('visibility'),null);
    assert.equal(await button(chess,'e2').getAttribute('aria-pressed'),'false');
    assert.equal(await action(chess,'undo').isDisabled(),true);
  }
  await button(chess,'e2').click();
  await button(chess,'e5').click();
  assert.equal(await piece(chess,'e2').getAttribute('data-piece'),'P');
  await drag(chess,'e2','e4');
  await icon(chess,'b');
  assert.equal(await button(chess,'e4').evaluate(node=>getComputedStyle(node,'::before').content),'none');
  await move(chess,'e7','e5');
  assert.equal(await title(chess),'Position');
  await action(chess,'undo').click();
  await action(chess,'undo').click();
  await icon(chess,'w');
  await action(chess,'redo').click();
  await action(chess,'redo').click();
  assert.equal(await piece(chess,'e5').getAttribute('data-piece'),'p');
  await action(chess,'undo').click();
  await move(chess,'c7','c5');
  assert.equal(await action(chess,'redo').isDisabled(),true);
  assert.equal(await xiang.locator('figure').getAttribute('data-fen'),fen(after));

  const [castling,ep,promotion]=await page.locator('details.chess.fen-board').all().then(boards=>boards.slice(1));
  await open(castling);
  await move(castling,'e1','g1');
  assert.equal(await piece(castling,'f1').getAttribute('data-piece'),'R');
  await action(castling,'undo').click();
  assert.equal(await piece(castling,'h1').getAttribute('data-piece'),'R');
  await action(castling,'redo').click();
  assert.equal(await piece(castling,'g1').getAttribute('data-piece'),'K');
  await open(ep);
  await move(ep,'e5','d6');
  await page.waitForFunction(()=>window.playedSounds.includes('capture.wav'));
  assert.equal(await piece(ep,'d6').getAttribute('data-piece'),'P');
  assert.equal(await piece(ep,'d5').count(),0);
  await action(ep,'undo').click();
  assert.equal(await piece(ep,'d5').getAttribute('data-piece'),'p');
  await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'writeText',{value:async()=>{throw new Error('blocked');}}));
  await action(ep,'export-fen').click();
  const exported=ep.getByRole('textbox',{name:'导出的 FEN'});
  await exported.waitFor();
  const epFen=await ep.locator('figure').getAttribute('data-fen');
  assert.equal(await exported.inputValue(),epFen);
  assert.equal(await exported.evaluate(input=>input.value.slice(input.selectionStart,input.selectionEnd)),epFen);
  await open(promotion);
  await drag(promotion,'a7','a8');
  await promotion.getByRole('button',{name:'马',exact:true}).click();
  assert.equal(await piece(promotion,'a8').getAttribute('data-piece'),'N');
  await action(promotion,'undo').click();
  assert.equal(await piece(promotion,'a7').getAttribute('data-piece'),'P');
  await action(promotion,'redo').click();
  assert.equal(await piece(promotion,'a8').getAttribute('data-piece'),'N');

  const diagram=page.locator('div.xiang.fen-board');
  assert.equal(await diagram.locator('.fen-board-title').textContent(),'局面图 · 黑方走棋');
  assert.equal(await diagram.locator('strong').textContent(),'炮二平五');
  assert.equal(await diagram.locator('figure').getAttribute('data-fen'),fen(after));
  assert.deepEqual(await diagram.locator('[data-piece]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.square,n.dataset.piece])),
    after.board.flatMap((piece,i)=>piece?[[coord(i),piece]]:[]));
  assert.match(await page.locator('pre code').textContent(),/\?\?\? chess/);

  const svg=diagram.locator('.fen-board-surface > svg');
  assert.equal(Math.round((await svg.boundingBox()).width),480);
  if(process.env.BOARD_SCREENSHOT) {
    await mkdir(dirname(process.env.BOARD_SCREENSHOT),{recursive:true});
    await chess.screenshot({path:process.env.BOARD_SCREENSHOT});
  }
  await page.setViewportSize({width:390,height:844});
  const mobile=await svg.boundingBox();
  assert.ok(mobile.width>240&&mobile.width<390&&mobile.x+mobile.width<=390);
  const touchPage=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  touchPage.on('pageerror',error=>errors.push(error.message));
  await offline(touchPage);
  const boardImage=touchPage.waitForResponse(r=>r.url().endsWith('/themes/test/board.svg')&&r.status()===200);
  assert.equal((await touchPage.goto(origin+'/nested/game/')).status(),200);
  await boardImage;
  const nested=touchPage.locator('details.chess.fen-board');
  await button(nested,'e7').waitFor();
  assert.equal(await nested.locator('.fen-board-surface > svg').getAttribute('viewBox'),'0 0 400 480');
  assert.equal(await nested.locator('defs image').count(),12);
  assert.equal(await touchPage.locator('div.chess.fen-board defs image').count(),0);
  await icon(nested,'b');
  await nested.locator('.fen-board-surface').scrollIntoViewIfNeeded();
  const touchStart=await center(button(nested,'e7'));
  const touchEnd=await center(button(nested,'e5'));
  const cdp=await touchPage.context().newCDPSession(touchPage);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchStart]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchEnd]});
  await nested.locator('.fen-board-drag-piece').waitFor({state:'attached'});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.equal(await nested.locator('.fen-board-drag-piece').count(),0);
  assert.equal(await piece(nested,'e7').getAttribute('data-piece'),'p');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchStart]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchEnd]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await piece(nested,'e5').getAttribute('transform'),'translate(225 210)');
  assert.deepEqual(errors,[]);
  console.log('Installed MkDocs plugin passed: colored arrows, FEN export, move and capture audio, move controls and themed boards.');
} finally {
  await browser?.close();
  if(server.listening) await new Promise(resolve=>server.close(resolve));
  const builtTemp=await realpath(temp);
  assert.equal(dirname(builtTemp),tempParent);
  assert.ok(basename(builtTemp).startsWith('blog-boards-'));
  await rm(builtTemp,{recursive:true,force:true});
}
