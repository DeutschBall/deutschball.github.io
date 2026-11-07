import assert from 'node:assert/strict';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({channel:'chrome'});
const base = process.env.BLOG_URL || 'http://127.0.0.1:8001/';
const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const requests = [], errors = [];
try {
  const context = await browser.newContext({viewport:{width:1440,height:1050}});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/javascripts/mathjax.js', route => route.fulfill({contentType:'text/javascript',body:''}));
  await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({contentType:'text/css',body:''}));
  await page.route('https://music.163.com/**', route => route.fulfill({contentType:'text/html',body:'<!doctype html><title>Music fixture</title>'}));
  await page.route('https://lichess.org/api/cloud-eval?**', route => {
    const fen = new URL(route.request().url()).searchParams.get('fen');
    requests.push(fen);
    const headers = {'Access-Control-Allow-Origin':'*'};
    return fen === start ? route.fulfill({headers, json:{depth:29,pvs:[{moves:'e2e4 e7e5 g1f3',cp:25}]}})
      : route.fulfill({headers,status:404});
  });
  await page.route('**/assets/chess/laboratory-games.json', route => route.fulfill({json:[{
    title:'博客棋谱测试', url:'chess-laboratory/', pgn:'1. d4 d5 (1... Nf6) *',
  }]}));
  await page.goto(base, {waitUntil:'domcontentloaded'});
  const tabs = page.locator('.md-tabs');
  assert.equal(await tabs.getByRole('link',{name:'Chess Laboratory',exact:true}).count(),0);
  const sidebar = page.locator('.md-nav--primary .md-nav__item--section > .md-nav');
  const home = sidebar.getByRole('link',{name:'棋局研究室',exact:true});
  await home.waitFor();
  const link = sidebar.getByRole('link',{name:'Chess Laboratory',exact:true});
  await link.click();
  await page.waitForURL('**/chess-laboratory/');
  assert.equal(await tabs.locator('.md-tabs__item--active a').innerText(),'棋局研究室');
  await home.waitFor();
  assert.match(await link.getAttribute('class'),/\bmd-nav__link--active\b/);

  const root = page.locator('#chess-analysis');
  const board = root.locator('.fen-board-figure');
  const action = name => root.locator(`button[data-action="${name}"]`);
  const square = name => board.locator(`button[data-square="${name}"]`);
  const piece = name => board.locator(`.fen-board-pieces [data-square="${name}"]`);
  const turn = root.locator('[data-xq-turn]');
  const currentFen = () => board.getAttribute('data-fen');
  const ready = () => square('a8').waitFor();
  const move = async (from,to) => { await square(from).press('Enter'); await square(to).press('Enter'); };
  const status = root.locator('[data-cloud]');
  const fenInput = root.locator('#chess-fen-input');
  const importFen = async value => { await fenInput.fill(value); await action('import').click(); await ready(); };
  const history = root.locator('.xq-history button');

  await ready();
  assert.equal(await currentFen(), start);
  assert.equal(await root.locator('.fen-board-title').textContent(),'Position');
  assert.equal(await action('undo').textContent(),'上一步');
  assert.equal(await action('redo').textContent(),'下一步');
  assert.equal(await board.locator('.fen-board-tile-dark').count(),32);
  assert.equal(await board.locator('button[data-square]').count(),64);
  await root.locator('.xq-history-toggle > summary').click();
  await root.locator('[data-fen-panel] > summary').click();
  await move('e2','e4');
  assert.match(await turn.textContent(),/黑方/);
  assert.equal(await history.first().textContent(),'1. e4');
  assert.deepEqual(requests,[]);
  await action('undo').click();await ready();assert.equal(await currentFen(),start);
  await action('redo').click();await ready();assert.equal(await piece('e4').getAttribute('data-piece'),'P');
  await action('first').click();await ready();assert.equal(await currentFen(),start);
  await action('export-fen').click();
  await board.locator('.fen-board-status').filter({hasText:/已复制 FEN|请手动复制 FEN/}).waitFor();

  await root.locator('.xq-cloud-toggle > summary').click();
  const candidate = root.locator('.xq-candidates button');
  await candidate.waitFor();
  assert.match(await status.textContent(),/深度 29/);
  assert.match(await root.locator('.xq-candidates tbody').innerText(),/e5 Nf3/);
  await candidate.hover();assert.equal(await root.locator('.xq-suggest').count(),2);
  await candidate.click();await ready();
  await root.getByText('Lichess 暂无此局面的缓存分析。',{exact:true}).waitFor();
  await root.locator('.xq-cloud-toggle > summary').click();

  await importFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  await move('e1','g1');
  assert.equal(await piece('f1').getAttribute('data-piece'),'R');
  assert.equal(await history.first().textContent(),'1. O-O');
  await importFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2');
  await move('e5','d6');assert.equal(await piece('d5').count(),0);
  assert.equal(await piece('d6').getAttribute('data-piece'),'P');
  await importFen('7k/P7/8/8/8/8/8/7K w - - 0 1');
  await move('a7','a8');
  await board.getByRole('button',{name:'马',exact:true}).click();
  assert.equal(await piece('a8').getAttribute('data-piece'),'N');
  assert.equal(await history.first().textContent(),'1. a8=N');
  await action('undo').click();await ready();assert.equal(await piece('a7').getAttribute('data-piece'),'P');
  await action('redo').click();await ready();assert.equal(await piece('a8').getAttribute('data-piece'),'N');

  await importFen(start);
  await root.locator('.xq-library-toggle > summary').click();
  const matches = root.locator('[data-library]');
  assert.match(await matches.getByRole('link',{name:'跳转文章'}).getAttribute('href'),/\/chess-laboratory\/$/);
  await root.locator('#chess-pgn-input').fill('[White "Alice"]\n[Black "Bob"]\n\n1.e4 e5 (1...c5 2.Nf3 (2.Nc3) Nc6) 2.Nf3 Nc6 *');
  await root.getByRole('button',{name:'导入 PGN',exact:true}).click();await ready();
  assert.equal(await history.count(),4);
  assert.match(await matches.innerText(),/Alice – Bob/);
  await action('first').click();await ready();
  const local = matches.locator('.xq-library-match').filter({hasText:'Alice – Bob'});
  await local.getByRole('combobox').selectOption({label:'分支 2'});
  await local.getByRole('button',{name:'摆上棋谱'}).click();await ready();
  assert.deepEqual(await history.allTextContents(),['1. e4','1... c5','2. Nc3']);
  await page.reload({waitUntil:'domcontentloaded'});await ready();
  await root.locator('.xq-library-toggle > summary').click();
  assert.match(await matches.innerText(),/Alice – Bob/);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log('Chess Laboratory: navigation, theme, board controls, special moves, cloud, FEN, PGN branches, storage and mobile passed.');
} finally { await browser.close(); }
