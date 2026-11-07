import {playUci, readBoard} from './game.mjs';

const endpoint = 'https://lichess.org/api/cloud-eval';
const signed = value => `${value > 0 ? '+' : ''}${(value / 100).toFixed(2)}`;

function readLines(position, result) {
  if (!Number.isInteger(result.depth) || !Array.isArray(result.pvs)) throw new Error('Invalid cloud evaluation');
  const lines = [];
  for (const pv of result.pvs.slice(0, 3)) {
    const board = readBoard(position);
    const sequence = [];
    for (const uci of String(pv.moves ?? '').trim().split(/\s+/)) {
      try { sequence.push(playUci(board, uci)); }
      catch { break; }
    }
    if (sequence.length) lines.push({
      move: sequence[0],
      continuation: sequence.slice(1).map(move => move.san).join(' '),
      score: Number.isInteger(pv.mate) ? `M${pv.mate > 0 ? '+' : ''}${pv.mate}` : Number.isInteger(pv.cp) ? signed(pv.cp) : '—',
    });
  }
  return {depth: result.depth, lines};
}

export function mountCloud(panel, current, onMove, onSuggest) {
  const status = panel.querySelector('[data-cloud]');
  const body = panel.querySelector('tbody');
  const retry = panel.querySelector('[data-action="retry"]');
  const cache = new Map();
  let active, wait, blockedUntil = 0;

  function render(result) {
    if (!result?.lines.length) {
      status.textContent = 'Lichess 暂无此局面的缓存分析。';
      return;
    }
    status.textContent = `深度 ${result.depth} · 评估分以白方为正 · 点击候选着法可落子`;
    for (const {move, continuation, score} of result.lines) {
      const row = body.insertRow(), button = document.createElement('button');
      button.className = 'xq-move';
      button.textContent = move.san;
      button.onclick = () => onMove(move.lan);
      button.onmouseenter = button.onfocus = () => onSuggest(move.lan);
      button.onmouseleave = button.onblur = () => onSuggest(null);
      row.insertCell().append(button);
      row.insertCell().textContent = score;
      row.insertCell().textContent = continuation || '—';
    }
  }

  function stop() {
    clearTimeout(wait);
    active?.abort();
    active = null;
  }

  function update(force = false) {
    stop();
    onSuggest(null);
    body.replaceChildren();
    const {fen, key, ended} = current();
    retry.disabled = ended;
    if (!panel.open || ended) {
      status.textContent = ended ? '此局面已结束。' : '展开后查询当前局面。';
      return;
    }
    if (!force && cache.has(key)) {
      render(cache.get(key));
      return;
    }
    if (Date.now() < blockedUntil) {
      status.textContent = 'Lichess 请求过于频繁，请稍后重试。';
      return;
    }
    status.textContent = '正在查询 Lichess 云端分析…';
    const controller = new AbortController();
    active = controller;
    wait = setTimeout(async () => {
      const timeout = AbortSignal.timeout(10000);
      try {
        const query = new URLSearchParams({fen, multiPv: '3'});
        const response = await fetch(`${endpoint}?${query}`, {
          signal: AbortSignal.any([controller.signal, timeout]), credentials: 'omit',
        });
        if (response.status === 429) blockedUntil = Date.now() + 60000;
        if (response.status !== 404 && !response.ok) throw new Error(`HTTP ${response.status}`);
        const result = response.status === 404 ? null : readLines(fen, await response.json());
        if (controller.signal.aborted || !panel.isConnected) return;
        cache.set(key, result);
        if (cache.size > 64) cache.delete(cache.keys().next().value);
        render(result);
      } catch {
        if (controller.signal.aborted || !panel.isConnected) return;
        status.textContent = Date.now() < blockedUntil
          ? 'Lichess 请求过于频繁，请稍后重试。' : '暂时无法连接 Lichess，可以继续离线走棋。';
      }
    }, force ? 0 : 300);
  }

  panel.addEventListener('toggle', () => update());
  retry.addEventListener('click', () => update(true));
  return {update, stop};
}
