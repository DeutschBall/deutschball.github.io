import {mountBoardView} from '../xiangqi/board-view.mjs';
import {mountCloud} from './cloud.mjs';
import {moveEntry, playUci, readBoard, snapshot} from './game.mjs';
import {mountLibrary} from './library.mjs';

export function mount(root) {
  const block = root.querySelector('details.fen-board');
  let start = snapshot(readBoard(block.querySelector('figure').dataset.fen));
  let entries = [], cursor = 0, redo = [];
  let shown = start;
  const atCursor = () => entries[cursor - 1] ?? start;
  const $ = selector => root.querySelector(selector);

  root.innerHTML = `
    <div class="xq-heading"><p>走棋、分析和回放国际象棋棋谱。</p><a class="xq-source" href="https://lichess.org/api#tag/Analysis/operation/apiCloudEval" target="_blank" rel="noopener">Lichess 云端分析 ↗</a></div>
    <div class="xq-layout">
      <section class="xq-play" aria-label="国际象棋棋盘"></section>
      <section class="xq-panel"><details class="xq-cloud-toggle xq-panel-toggle">
        <summary>云端分析</summary>
        <div class="xq-panel-title"><span>当前局面分析</span><button type="button" data-action="retry">刷新分析</button></div>
        <p class="xq-cloud-status" data-cloud role="status"></p>
        <div class="xq-table-wrap"><table class="xq-candidates"><thead><tr><th>候选着法</th><th>分值</th><th>后续变化</th></tr></thead><tbody></tbody></table></div>
      </details></section>
      <section class="xq-panel"><details class="xq-history-toggle xq-panel-toggle">
        <summary>着法记录<span data-history-count>0 手</span></summary>
        <div class="xq-history-nav">
          <button type="button" data-action="first" aria-label="回到起始局面">⇤</button><button type="button" data-action="prev" aria-label="上一步">←</button>
          <button type="button" data-action="next" aria-label="下一步">→</button><button type="button" data-action="last" aria-label="最新局面">⇥</button>
        </div>
        <div class="xq-history" aria-label="着法历史"></div>
        <p class="xq-hint">回看后落子将从此处开始新的变化。</p>
      </details></section>
      <section class="xq-panel"><details class="xq-library-toggle xq-panel-toggle">
        <summary>我的博客棋谱 <span data-library-count></span></summary>
        <div data-library aria-live="polite"></div>
        <details data-local-games hidden><summary>本机棋谱</summary><div data-local-list></div></details>
        <form class="xq-fen">
          <label for="chess-pgn-input">PGN（每次导入一盘，支持分析分支）</label>
          <textarea id="chess-pgn-input" rows="4" spellcheck="false" maxlength="100000" required></textarea>
          <div class="xq-toolbar"><button type="submit">导入 PGN</button><button type="button" data-clear-pgn>清除本机棋谱</button></div>
          <p class="xq-message" data-pgn-message role="status"></p>
        </form>
      </details></section>
    </div>
    <details class="xq-fen" data-fen-panel><summary>FEN</summary>
      <label for="chess-fen-input">局面代码（w 白走 / b 黑走）</label>
      <textarea id="chess-fen-input" rows="3" spellcheck="false"></textarea>
      <div class="xq-toolbar"><button type="button" data-action="import">导入局面</button></div>
      <p>导入后从该局面开始新的着法记录。</p>
      <p class="xq-message" data-fen-message role="status"></p>
    </details>`;
  block.classList.add('xq-board-toggle', 'xq-panel-toggle');
  block.firstElementChild.insertAdjacentHTML('afterend', '<div class="xq-turnbar"><strong data-xq-turn></strong><span data-ply></span></div>');
  block.insertAdjacentHTML('beforeend', '<p class="xq-message" data-message role="status"></p>');
  $('.xq-play').append(block);
  block.open = true;
  const view = mountBoardView(block, makeMove, navigate);
  const cloud = mountCloud($('.xq-cloud-toggle'), () => shown, makeMove, view.suggest);
  const library = mountLibrary($('.xq-library-toggle'), atCursor, (game, line) => {
    start = game.start;
    entries = line.moves;
    cursor = entries.length;
    redo = [];
    refresh(true);
    $('[data-message]').textContent = `已载入 ${game.title} · ${line.label}`;
  });

  function drawHistory() {
    const history = $('.xq-history');
    history.replaceChildren();
    if (!entries.length) history.textContent = '尚未落子。';
    entries.forEach((move, index) => {
      const button = document.createElement('button');
      const white = move.color === 'w';
      const number = Number(move.fen.split(' ')[5]) - (white ? 0 : 1);
      button.type = 'button';
      button.textContent = `${number}${white ? '.' : '...'} ${move.san}`;
      button.title = move.uci;
      button.classList.toggle('xq-active', cursor === index + 1);
      button.setAttribute('aria-current', cursor === index + 1 ? 'step' : 'false');
      button.onclick = () => jump(index + 1);
      history.append(button);
    });
    $('[data-history-count]').textContent = `${entries.length} 手`;
    for (const action of ['first', 'prev']) $(`[data-action="${action}"]`).disabled = cursor === 0;
    for (const action of ['next', 'last']) $(`[data-action="${action}"]`).disabled = cursor === entries.length;
  }

  function refresh(reset = false) {
    const {fen, key} = atCursor();
    const board = readBoard(fen), turn = board.turn();
    const mate = board.isCheckmate(), stalemate = board.isStalemate();
    const material = board.isInsufficientMaterial(), check = board.isCheck();
    shown = {fen, key, ended: mate || stalemate || material};
    const repetitions = [start, ...entries.slice(0, cursor)].filter(position => position.key === key).length;
    $('#chess-fen-input').value = fen;
    $('[data-fen-message]').textContent = '';
    $('[data-xq-turn]').textContent = mate ? `${turn === 'w' ? '白方' : '黑方'}被将死`
      : stalemate ? '逼和' : material ? '和棋 · 子力不足'
        : `${turn === 'w' ? '白方' : '黑方'}走棋${check ? ' · 将军' : ''}`;
    $('[data-ply]').textContent = `第 ${fen.split(' ')[5]} 回合 · ${cursor} / ${entries.length} 手`;
    $('[data-message]').textContent = !shown.ended && repetitions >= 3 ? '局面已重复三次，可申请和棋。'
      : !shown.ended && board.isDrawByFiftyMoves() ? '已达五十回合，可申请和棋。' : '';
    view.update(fen, {lastMove: entries[cursor - 1]?.uci.slice(0, 4), checkSquare: check ? board.findPiece({type:'k', color:turn})[0] : null,
      canUndo: cursor > 0, canRedo: redo.length > 0, reset});
    drawHistory();
    library.update();
    cloud.update();
  }

  function makeMove(uci, expectedFen) {
    try {
      const board = readBoard(atCursor().fen);
      const entry = moveEntry(board, playUci(board, uci, expectedFen));
      if (expectedFen && entry.fen !== expectedFen) throw new Error('棋盘与研究室的局面不一致。');
      entries = [...entries.slice(0, cursor), entry];
      cursor = entries.length;
      redo = [];
      refresh();
      return true;
    } catch (error) {
      $('[data-message]').textContent = `着法无法执行。${error.message}`;
      return false;
    }
  }

  function jump(ply) {
    cursor = ply;
    redo = [];
    refresh();
  }

  function navigate(action) {
    if (action === 'undo' && cursor > 0) {
      redo.push({entries, cursor});
      cursor--;
      entries = entries.slice(0, cursor);
    } else if (action === 'redo' && redo.length) {
      ({entries, cursor} = redo.pop());
    }
    refresh();
  }
  const nav = {first: () => 0, prev: () => Math.max(0, cursor - 1),
    next: () => Math.min(entries.length, cursor + 1), last: () => entries.length};
  for (const [action, ply] of Object.entries(nav)) $(`[data-action="${action}"]`).onclick = () => jump(ply());
  $('[data-action="import"]').onclick = () => {
    try {
      start = snapshot(readBoard($('#chess-fen-input').value));
      entries = [];
      redo = [];
      cursor = 0;
      refresh(true);
      $('[data-fen-message]').textContent = '局面已导入。';
    } catch (error) { $('[data-fen-message]').textContent = `FEN 无效。${error.message}`; }
  };

  refresh();
  const observer = new MutationObserver(() => {
    if (root.isConnected) return;
    observer.disconnect();
    cloud.stop();
    view.disconnect();
  });
  observer.observe(document.body, {childList: true, subtree: true});
}
