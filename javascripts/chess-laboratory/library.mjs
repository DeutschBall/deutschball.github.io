import {parsePgn} from './game.mjs';

const storageKey = 'dustland.chess-laboratory.pgn';
const siteRoot = new URL('../../', import.meta.url);
const make = (tag, text, className) => {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
};

function record(pgn, title, url) {
  const game = parsePgn(pgn);
  if (typeof title === 'string' && title.trim()) game.title = title;
  if (url) {
    const link = new URL(url, siteRoot);
    if (link.origin !== siteRoot.origin || !link.pathname.startsWith(siteRoot.pathname)) throw new Error('棋谱来源必须在本站。');
    game.url = link.href;
  }
  for (const line of game.lines) line.keys = new Set([game.start.key, ...line.moves.map(move => move.key)]);
  return {...game, pgn};
}

export function mountLibrary(panel, current, loadLine) {
  const count = panel.querySelector('[data-library-count]');
  const output = panel.querySelector('[data-library]');
  const localList = panel.querySelector('[data-local-games]');
  const editor = panel.querySelector('form'), input = editor.querySelector('textarea');
  const feedback = panel.querySelector('[data-pgn-message]');
  const clear = panel.querySelector('[data-clear-pgn]');
  let blog = [], local = [], loadMessage = '正在加载博客棋谱…';

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    for (const pgn of saved) local.push(record(pgn));
  } catch { feedback.textContent = '部分本机棋谱无法读取。'; }

  function item(game, lines) {
    const row = make('div', '', 'xq-library-match');
    row.append(make('span', game.title, 'xq-library-title'));
    const actions = make('div', '', 'xq-library-actions');
    if (game.url) {
      const link = make('a', '跳转文章', 'xq-library-button');
      link.href = game.url;
      actions.append(link);
    }
    let selection;
    if (lines.length > 1) {
      selection = make('select', '', 'xq-library-lines');
      selection.setAttribute('aria-label', `${game.title}的棋谱分支`);
      selection.append(...lines.map((line, i) => new Option(line.label, i)));
      actions.append(selection);
    }
    const play = make('button', '摆上棋谱', 'xq-library-button');
    play.onclick = () => loadLine(game, lines[selection?.selectedIndex ?? 0]);
    actions.append(play);
    row.append(actions);
    return row;
  }

  function update() {
    const key = current().key;
    const matches = [...blog, ...local].flatMap(game => {
      const lines = game.lines.filter(line => line.keys.has(key));
      return lines.length ? [item(game, lines)] : [];
    });
    count.textContent = `${matches.length} 局匹配`;
    output.replaceChildren(make('p', loadMessage || `博客 ${blog.length} 局 · 本机 ${local.length} 局`, 'xq-hint'));
    output.append(...(matches.length ? matches : [make('p', '已收录棋谱中暂无此局面。', 'xq-hint')]));
    localList.hidden = local.length === 0;
    localList.querySelector('[data-local-list]').replaceChildren(...local.map(game => item(game, game.lines)));
    clear.disabled = local.length === 0;
  }

  function save(message) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(local.map(game => game.pgn)));
      feedback.textContent = message;
    } catch { feedback.textContent = `${message} 浏览器存储不可用，本次变动仅在当前页面有效。`; }
  }

  editor.addEventListener('submit', event => {
    event.preventDefault();
    const pgn = input.value.trim();
    if (!pgn || pgn.length > input.maxLength) return;
    try {
      const existing = local.find(game => game.pgn === pgn);
      const game = existing ?? record(pgn);
      if (!existing) local.push(game);
      save(existing ? '这盘棋已收录。' : 'PGN 已导入本机棋谱。');
      input.value = '';
      loadLine(game, game.lines[0]);
    } catch (error) { feedback.textContent = error.message; }
  });
  clear.addEventListener('click', () => {
    local = [];
    save('已清除本机棋谱。');
    update();
  });

  fetch(new URL('assets/chess/laboratory-games.json', siteRoot))
    .then(response => {
      if (!response.ok) throw new Error('Library unavailable');
      return response.json();
    })
    .then(entries => {
      blog = entries.map(({pgn, title, url}) => record(pgn, title, url));
      loadMessage = '';
    })
    .catch(() => { loadMessage = '博客棋谱暂时无法加载。'; })
    .finally(() => { if (panel.isConnected) update(); });
  return {update};
}
