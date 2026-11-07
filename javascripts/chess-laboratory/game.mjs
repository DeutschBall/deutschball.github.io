import {Chess, DEFAULT_POSITION} from '../../assets/mkdocs-chess-plugin/vendor/chess-1.4.0.mjs';

export const positionKey = fen => fen.split(' ').slice(0, 4).join(' ');
export const snapshot = board => ({
  fen: board.fen({forceEnpassantSquare: true}), key: positionKey(board.fen()),
});

export function readBoard(value = DEFAULT_POSITION) {
  const fen = value.trim().split(/\s+/).join(' ');
  const fields = fen.split(' ');
  if (fields.length !== 6 || !fields.slice(4).every(n => /^\d+$/.test(n) && Number.isSafeInteger(Number(n)))) {
    throw new Error('FEN 需要六个字段和有效的回合数。');
  }
  const board = new Chess(fen);
  const turn = board.turn();
  const otherKing = board.findPiece({type: 'k', color: turn === 'w' ? 'b' : 'w'})[0];
  if (board.isAttacked(otherKing, turn)) throw new Error('非行棋方处于被将军状态。');
  for (const [flag, color, rank, file] of [['K','w',1,'h'], ['Q','w',1,'a'], ['k','b',8,'h'], ['q','b',8,'a']]) {
    if (!fields[2].includes(flag)) continue;
    const king = board.get('e' + rank), rook = board.get(file + rank);
    if (king?.type !== 'k' || king.color !== color || rook?.type !== 'r' || rook.color !== color) {
      throw new Error('易位权与王、车的位置不符。');
    }
  }
  const ep = fields[3];
  if (ep !== '-') {
    const pawn = board.get(ep[0] + (turn === 'w' ? '5' : '4'));
    if (board.get(ep) || board.get(ep[0] + (turn === 'w' ? '7' : '2')) || pawn?.type !== 'p' || pawn.color === turn) {
      throw new Error('吃过路兵的目标格与兵的位置不符。');
    }
  }
  return board;
}

export function playUci(board, uci, expectedFen) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('坐标着法无效。');
  const from = uci.slice(0, 2);
  let to = uci.slice(2, 4), promotion = uci[4];
  const piece = board.get(from), target = board.get(to);
  // Lichess cloud lines encode castling as a king move to its own rook.
  if (/^e([18])[ah]\1$/.test(uci) && piece?.type === 'k' && target?.type === 'r' && piece.color === target.color) {
    to = (to[0] === 'h' ? 'g' : 'c') + from[1];
  }
  if (expectedFen && piece?.type === 'p' && ['1', '8'].includes(to[1])) {
    promotion = new Chess(expectedFen).get(to)?.type;
  }
  return board.move({from, to, promotion});
}

export function moveEntry(board, move) {
  return {...snapshot(board), uci: move.lan, san: move.san, color: move.color};
}

export function parsePgn(pgn) {
  let text = pgn.replace(/^%[^\r\n]*/gm, '').trimStart();
  const headers = new Map();
  const tag = /^\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\\r\n]|\\["\\])*)"\s*\]\s*/;
  for (let match; (match = text.match(tag)); text = text.slice(match[0].length)) {
    headers.set(match[1].toLowerCase(), match[2].replace(/\\(["\\])/g, '$1'));
  }
  if (headers.has('variant') && !/^(standard|chess)$/i.test(headers.get('variant'))) throw new Error('仅支持标准国际象棋 PGN。');
  if (headers.get('setup') === '1' && !headers.has('fen')) throw new Error('PGN 的 SetUp 缺少 FEN。');
  const board = readBoard(headers.get('fen'));
  const start = snapshot(board);
  const main = {board, moves: [], fork: 0, label: '主线'};
  const stack = [main], lines = [main];
  const tokens = /\{[^}]*\}|;[^\r\n]*|\$\d+|\d+\.+|\.\.\.|[()]|[^\s{}();$]+|[^\s]/g;
  let finished = false;
  for (const [token] of text.matchAll(tokens)) {
    if (/^(?:\{|;|\$|\d+\.+|\.\.\.$|[!?]+$|e\.p\.$)/.test(token)) {
      if (token !== '{' && token !== '$') continue;
    }
    if (finished) throw new Error('每次请导入一盘 PGN。');
    const current = stack.at(-1);
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) {
      if (stack.length !== 1) throw new Error('PGN 分支内出现对局结果。');
      finished = true;
    } else if (token === '(') {
      if (current.moves.length === current.fork) throw new Error('PGN 分支缺少分叉着法。');
      const moves = current.moves.slice(0, -1);
      const branch = {board: new Chess(moves.at(-1)?.fen ?? start.fen), moves, fork: moves.length, label: `分支 ${lines.length}`};
      stack.push(branch);
      lines.push(branch);
    } else if (token === ')') {
      if (stack.length === 1 || current.moves.length === current.fork) throw new Error('PGN 分支括号无效。');
      stack.pop();
    } else {
      let move;
      try { move = current.board.move(token); }
      catch { throw new Error(`PGN 中的着法无法执行（${token}）。`); }
      current.moves.push(moveEntry(current.board, move));
    }
  }
  if (stack.length !== 1 || !main.moves.length) throw new Error('PGN 分支未闭合或缺少着法。');
  const players = [headers.get('white'), headers.get('black')].filter(name => name && name !== '?');
  const title = players.length ? players.join(' – ') : headers.get('event') || '导入的棋谱';
  return {title, start, lines: lines.map(({moves, fork, label}) => ({moves, fork, label}))};
}
