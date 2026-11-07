import {locales} from './locales.mjs';

const SVG = 'http://www.w3.org/2000/svg';
const mounted = new WeakSet();
const arrowDirections = {ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0]};
const pointerMoved = (event, gesture) => Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) >= 5;
const pieceSide = piece => piece === piece.toUpperCase() ? 'w' : 'b';

async function xiangEngine(position, language) {
  const rules = await import('./xiangqi-rules.mjs');
  const copy = locales[language];
  let initial;
  try { initial = rules.parseFen(position); }
  catch (error) {
    if (language === 'zh') throw error;
    throw new Error(copy.invalidXiang, {cause: error});
  }
  const states = [initial];
  const current = () => states.at(-1);
  return {
    turn: () => current().turn,
    position: () => rules.fen(current()),
    board: () => current().board,
    name: piece => copy.xiangPieces?.[piece.toLowerCase()] ?? rules.names[piece],
    square: rules.coord,
    candidates: from => rules.moves(current(), rules.index(from)).map(move => ({from, to: move.slice(2)})),
    play: ({from, to}) => {
      const move = from + to;
      const label = language === 'zh' ? rules.notation(current(), move) : `${from}–${to}`;
      const capture = Boolean(current().board[rules.index(to)]);
      states.push(rules.play(current(), move));
      return {label, capture};
    },
    undo: () => states.pop(),
    status: () => {
      if (rules.moves(current()).length === 0) return rules.inCheck(current()) ? 'checkmate' : 'xiangStalemate';
      return rules.inCheck(current()) ? 'check' : '';
    },
  };
}

async function chessEngine(position, language) {
  const {Chess} = await import('./vendor/chess-1.4.0.mjs');
  const copy = locales[language];
  let game;
  try { game = new Chess(position); }
  catch (error) { throw new Error(copy.invalidChess, {cause: error}); }
  const turn = game.turn();
  const opposingKing = game.findPiece({type: 'k', color: turn === 'w' ? 'b' : 'w'})[0];
  if (game.isAttacked(opposingKing, turn)) throw new Error(copy.opposingKingInCheck);
  const [, , rights, ep] = position.split(' ');
  for (const [flag, color, rank, rook] of [['K', 'w', 1, 'h'], ['Q', 'w', 1, 'a'], ['k', 'b', 8, 'h'], ['q', 'b', 8, 'a']]) {
    if (!rights.includes(flag)) continue;
    const king = game.get('e' + rank);
    const piece = game.get(rook + rank);
    if (king?.type !== 'k' || king.color !== color || piece?.type !== 'r' || piece.color !== color) {
      throw new Error(copy.castling);
    }
  }
  if (ep !== '-') {
    const pawn = game.get(ep[0] + (turn === 'w' ? '5' : '4'));
    const origin = ep[0] + (turn === 'w' ? '7' : '2');
    if (game.get(ep) || game.get(origin) || pawn?.type !== 'p' || pawn.color === turn) {
      throw new Error(copy.enPassant);
    }
  }
  return {
    turn: () => game.turn(),
    position: () => game.fen({forceEnpassantSquare: true}),
    board: () => game.board().flat().map(piece => piece?.color === 'w' ? piece.type.toUpperCase() : piece?.type),
    name: piece => copy.chessPieces[piece.toLowerCase()],
    square: i => String.fromCharCode(97 + i % 8) + (8 - Math.floor(i / 8)),
    candidates: square => game.moves({square, verbose: true}),
    play: ({from, to, promotion}) => {
      const {san, captured} = game.move({from, to, promotion});
      return {label: san, capture: Boolean(captured)};
    },
    undo: () => game.undo(),
    status: () => {
      if (game.isCheckmate()) return 'checkmate';
      if (game.isStalemate()) return 'stalemate';
      return game.isCheck() ? 'check' : '';
    },
  };
}

const engines = {xiang: xiangEngine, chess: chessEngine};

function makeButton(text) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  return button;
}

function makeSvg(tag, attributes) {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

function addFenExport(controls, figure, copy) {
  const button = makeButton(copy.exportFen);
  button.dataset.action = 'export-fen';
  const feedback = document.createElement('span');
  feedback.className = 'fen-board-status';
  feedback.setAttribute('role', 'status');
  const field = document.createElement('input');
  field.type = 'text';
  field.className = 'fen-board-fen-export';
  field.readOnly = true;
  field.hidden = true;
  field.setAttribute('aria-label', copy.exportedFen);
  controls.append(button, feedback, field);
  button.addEventListener('click', async () => {
    const position = figure.dataset.fen;
    try {
      await navigator.clipboard.writeText(position);
      field.hidden = true;
      feedback.textContent = copy.copiedFen;
    } catch {
      field.value = position;
      field.hidden = false;
      field.focus();
      field.select();
      feedback.textContent = copy.copyFenManually;
    }
  });
}

function showUnavailable(figure, copy, error) {
  const message = document.createElement('p');
  message.className = 'fen-board-status';
  message.textContent = `${copy.unavailable}${figure.lang === 'zh' ? '' : ' '}${error.message}`;
  figure.append(message);
}

async function mount(figure) {
  const {game, fen, prefix, grid, label, light, dark = '黑', turnW = `${light}方走棋`, turnB = '黑方走棋'} = figure.dataset;
  const language = Object.hasOwn(locales, figure.lang) ? figure.lang : 'zh';
  const copy = locales[language];
  const controls = document.createElement('div');
  controls.className = 'fen-board-controls';
  let engine;
  try {
    engine = await engines[game](fen, language);
  } catch (error) {
    if (figure.isConnected) {
      showUnavailable(figure, copy, error);
      addFenExport(controls, figure, copy);
      figure.append(controls);
    }
    return;
  }
  if (!figure.isConnected) return;

  const block = figure.parentElement;
  const heading = block.firstElementChild.querySelector('.fen-board-title');
  const surface = figure.querySelector('.fen-board-surface');
  const svg = surface.querySelector('svg');
  const svgPoint = event => new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
  const pieces = svg.querySelector('.fen-board-pieces');
  const desc = svg.querySelector('desc');
  const [columns, rows, x, y, dx, dy, width, height] = grid.split(' ').map(Number);
  const center = index => ({x: x + index % columns * dx, y: y + Math.floor(index / columns) * dy});
  const cell = Math.min(dx, dy);
  const history = [];
  const future = [];
  const arrows = new Map();
  const sounds = new Map();
  const arrowLayer = makeSvg('g', {class: 'fen-board-arrows', 'aria-hidden': 'true'});
  const draftLayer = makeSvg('g', {class: 'fen-board-arrow-draft', 'aria-hidden': 'true'});
  svg.append(arrowLayer, draftLayer);
  let selection = -1;
  let targets = [];
  let tabStop = 0;
  let drag = null;
  let drawing = null;
  let suppressClick = false;

  const undo = makeButton(copy.previous);
  undo.dataset.action = 'undo';
  const redo = makeButton(copy.next);
  redo.dataset.action = 'redo';
  const clearArrows = makeButton(copy.clearArrows);
  clearArrows.dataset.action = 'clear-arrows';
  const status = document.createElement('span');
  status.className = 'fen-board-status';
  status.setAttribute('role', 'status');
  controls.append(undo, redo, clearArrows);
  addFenExport(controls, figure, copy);
  controls.append(status);
  const promotion = document.createElement('div');
  promotion.className = 'fen-board-controls fen-board-promotion';
  promotion.hidden = true;
  figure.append(controls, promotion);

  const buttons = Array.from({length: columns * rows}, (_, i) => {
    const button = makeButton('');
    button.className = 'fen-board-square';
    button.dataset.square = engine.square(i);
    const point = center(i);
    button.style.left = point.x / width * 100 + '%';
    button.style.top = point.y / height * 100 + '%';
    button.style.width = dx / width * 100 + '%';
    button.style.height = dy / height * 100 + '%';
    button.tabIndex = i === tabStop ? 0 : -1;
    surface.append(button);
    button.addEventListener('focus', () => {
      buttons[tabStop].tabIndex = -1;
      tabStop = i;
      button.tabIndex = 0;
    });
    button.addEventListener('keydown', event => {
      const direction = arrowDirections[event.key];
      if (!direction) return;
      event.preventDefault();
      const col = i % columns + direction[0];
      const row = Math.floor(i / columns) + direction[1];
      if (col >= 0 && col < columns && row >= 0 && row < rows) buttons[row * columns + col].focus();
    });
    button.addEventListener('click', event => {
      if (drawing || drag?.ghost || (suppressClick && event.detail)) return;
      select(i);
    });
    return button;
  });

  function pieceLabel(piece) {
    const side = pieceSide(piece) === 'w' ? light : dark;
    const name = engine.name(piece);
    if (language === 'zh') return side + name;
    if (language === 'en') return `${side} ${name}`;
    return `${name} (${side})`;
  }

  function resetAfterMove() {
    endDrag();
    endDrawing();
    arrows.clear();
    selection = -1;
    targets = [];
    promotion.hidden = true;
    promotion.replaceChildren();
  }

  function drawSelection() {
    const destinations = new Set(targets.map(move => move.to));
    buttons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(i === selection));
      button.classList.toggle('fen-board-target', destinations.has(button.dataset.square));
    });
  }

  function pick(index) {
    selection = index;
    targets = index === -1 ? [] : engine.candidates(buttons[index].dataset.square);
    drawSelection();
  }

  function makeArrow({from, to, side, occupied}, number) {
    const a = center(from);
    const b = center(to);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / length;
    const uy = (b.y - a.y) / length;
    // The reference board has a 67.5 px intersection spacing.
    const scale = cell / 67.5;
    const radius = 31.5 * scale;
    const headLength = (occupied ? 24 : 32) * scale;
    const head = {x: b.x - ux * headLength, y: b.y - uy * headLength};
    const halfHead = (occupied ? 18 : 24) * scale;
    const start = occupied ? radius : 0;
    const badgeOffset = 22.5 * scale;
    const badge = {x: b.x - ux * badgeOffset, y: b.y - uy * badgeOffset};
    const group = makeSvg('g', {class: 'fen-board-arrow', 'data-side': side});
    const ink = makeSvg('g', {class: 'fen-board-arrow-ink'});
    ink.append(
      makeSvg('line', {
        class: 'fen-board-arrow-shaft', x1: a.x + ux * start, y1: a.y + uy * start,
        x2: head.x, y2: head.y, 'stroke-width': 12 * scale,
      }),
      makeSvg('polygon', {
        class: 'fen-board-arrow-head',
        points: `${b.x},${b.y} ${head.x - uy * halfHead},${head.y + ux * halfHead} ${head.x + uy * halfHead},${head.y - ux * halfHead}`,
      }),
      occupied
        ? makeSvg('circle', {class: 'fen-board-arrow-origin', cx: a.x, cy: a.y, r: radius, 'stroke-width': 4 * scale})
        : makeSvg('circle', {cx: a.x, cy: a.y, r: 11 * scale}),
    );
    const numberBadge = makeSvg('circle', {class: 'fen-board-arrow-badge', cx: badge.x, cy: badge.y, r: 12 * scale});
    const text = makeSvg('text', {x: badge.x, y: badge.y, 'font-size': (number < 10 ? 20 : 15.5) * scale});
    text.textContent = number;
    group.append(ink, numberBadge, text);
    return group;
  }

  function renderArrows() {
    const marks = [...arrows].map(([key, arrow], index) => {
      const mark = makeArrow(arrow, index + 1);
      mark.dataset.arrowKey = key;
      return mark;
    });
    arrowLayer.replaceChildren(...marks);
    clearArrows.disabled = arrows.size === 0;
  }

  function removeArrowAt(event) {
    if (!arrows.size) return;
    const point = svgPoint(event);
    // Match the visible head or badge, from the topmost arrow down.
    for (const mark of Array.from(arrowLayer.children).reverse()) {
      const head = mark.querySelector('.fen-board-arrow-head');
      const badge = mark.querySelector('.fen-board-arrow-badge');
      if (!head.isPointInFill(point) && !badge.isPointInFill(point)) continue;
      arrows.delete(mark.dataset.arrowKey);
      renderArrows();
      return;
    }
  }

  function render() {
    const turn = engine.turn();
    const title = `${label} · ${turn === 'w' ? turnW : turnB}`;
    if (block.tagName !== 'DETAILS') heading.textContent = title;
    block.dataset.turn = turn;
    svg.setAttribute('aria-label', title);
    figure.dataset.fen = engine.position();
    desc.textContent = 'FEN: ' + figure.dataset.fen;
    const layer = document.createDocumentFragment();
    const last = history.at(-1);
    const board = engine.board();
    board.forEach((piece, i) => {
      const button = buttons[i];
      const square = button.dataset.square;
      const side = piece && pieceSide(piece);
      const name = piece ? pieceLabel(piece) : copy.empty;
      button.setAttribute('aria-label', square + ' ' + name);
      button.classList.toggle('fen-board-draggable', side === turn);
      const from = last?.move.from === square;
      const to = last?.move.to === square;
      button.classList.toggle('fen-board-last', from || to);
      button.classList.toggle('fen-board-last-from', from);
      button.classList.toggle('fen-board-last-to', to);
      if (!piece) return;
      const group = document.createElementNS(SVG, 'g');
      group.dataset.square = square;
      group.dataset.piece = piece;
      const point = center(i);
      group.setAttribute('transform', `translate(${point.x} ${point.y})`);
      const shape = document.createElementNS(SVG, 'use');
      shape.setAttribute('href', `#${prefix}-${piece}`);
      group.append(shape);
      layer.append(group);
    });
    pieces.replaceChildren(layer);
    drawSelection();
    renderArrows();
    undo.disabled = history.length === 0;
    redo.disabled = future.length === 0;
    status.textContent = [last?.label, copy[engine.status()]].filter(Boolean).join(' · ') || copy.start;
  }

  function playSound(capture) {
    const file = capture ? figure.dataset.soundCapture : figure.dataset.soundMove;
    if (!file) return;
    if (!sounds.has(file)) sounds.set(file, new Audio(new URL('sounds/' + file, import.meta.url)));
    const sound = sounds.get(file);
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  function play(move, restoring = false) {
    const {label, capture} = engine.play(move);
    history.push({move, label});
    if (restoring) future.pop();
    else future.length = 0;
    resetAfterMove();
    render();
    playSound(capture);
  }

  function choosePromotion(candidates, index) {
    promotion.hidden = false;
    const label = document.createElement('span');
    label.textContent = copy.promote;
    promotion.append(label);
    for (const move of candidates) {
      const name = copy.chessPieces[move.promotion];
      const button = makeButton(name[0].toUpperCase() + name.slice(1));
      button.addEventListener('click', () => {
        play(move);
        buttons[index].focus();
      });
      promotion.append(button);
    }
    const cancel = makeButton(copy.cancel);
    cancel.addEventListener('click', () => {
      promotion.hidden = true;
      promotion.replaceChildren();
      buttons[selection].focus();
    });
    promotion.append(cancel);
    promotion.querySelector('button').focus();
  }

  function tryDestination(index) {
    const square = buttons[index].dataset.square;
    const candidates = targets.filter(move => move.to === square);
    if (candidates.length > 1) {
      choosePromotion(candidates, index);
    } else if (candidates.length === 1) {
      play(candidates[0]);
    } else {
      return false;
    }
    return true;
  }

  function select(index) {
    if (!promotion.hidden || tryDestination(index)) return;
    const ownPiece = buttons[index].classList.contains('fen-board-draggable');
    pick(ownPiece && selection !== index ? index : -1);
  }

  function endDrag() {
    if (!drag) return;
    const {button, pointerId, source, ghost} = drag;
    drag = null;
    if (ghost) {
      ghost.remove();
      source.removeAttribute('visibility');
      surface.classList.remove('fen-board-dragging');
      // Pointer capture can still produce a click on the source button.
      suppressClick = true;
    }
    if (button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId);
  }

  function squareFrom(element) {
    const hit = element?.closest('.fen-board-square');
    return hit?.parentElement === surface ? buttons.indexOf(hit) : -1;
  }

  function squareAt(event) {
    return squareFrom(document.elementFromPoint(event.clientX, event.clientY));
  }

  function endDrawing() {
    if (!drawing) return;
    const {pointerId} = drawing;
    drawing = null;
    draftLayer.replaceChildren();
    if (surface.hasPointerCapture(pointerId)) surface.releasePointerCapture(pointerId);
  }

  surface.addEventListener('contextmenu', event => {
    if (event.button === 2) event.preventDefault();
  });

  surface.addEventListener('pointerdown', event => {
    if (drag || drawing || !event.isPrimary) return;
    if (event.button === 2) {
      const from = squareFrom(event.target);
      event.preventDefault();
      surface.setPointerCapture(event.pointerId);
      const piece = engine.board()[from];
      drawing = {
        from, to: -1, pointerId: event.pointerId,
        side: piece ? pieceSide(piece) : engine.turn(), occupied: Boolean(piece),
        startX: event.clientX, startY: event.clientY, moved: false,
      };
      return;
    }
    if (event.button !== 0) return;
    suppressClick = false;
    const button = event.target.closest('.fen-board-draggable');
    if (!button || !promotion.hidden) return;
    const source = pieces.querySelector(`[data-square="${button.dataset.square}"]`);
    if (!source) return;
    button.setPointerCapture(event.pointerId);
    drag = {
      button, source, pointerId: event.pointerId, index: buttons.indexOf(button),
      startX: event.clientX, startY: event.clientY, ghost: null,
    };
  });

  surface.addEventListener('pointermove', event => {
    if (drawing?.pointerId === event.pointerId) {
      drawing.moved ||= pointerMoved(event, drawing);
      const to = squareAt(event);
      if (to === drawing.to) return;
      drawing.to = to;
      const {from} = drawing;
      draftLayer.replaceChildren();
      if (from !== -1 && to !== -1 && to !== from) {
        draftLayer.append(makeArrow(drawing, arrows.size + 1));
      }
      return;
    }
    if (drag?.pointerId !== event.pointerId) return;
    if (!drag.ghost) {
      if (!pointerMoved(event, drag)) return;
      const ghost = drag.source.firstElementChild.cloneNode(true);
      ghost.setAttribute('class', 'fen-board-drag-piece');
      ghost.setAttribute('aria-hidden', 'true');
      svg.append(ghost);
      drag.ghost = ghost;
      drag.source.setAttribute('visibility', 'hidden');
      surface.classList.add('fen-board-dragging');
      pick(drag.index);
    }
    const point = svgPoint(event);
    drag.ghost.setAttribute('transform', `translate(${point.x} ${point.y})`);
  });

  surface.addEventListener('pointerup', event => {
    if (drawing?.pointerId === event.pointerId) {
      const {from, side, occupied} = drawing;
      const moved = drawing.moved || pointerMoved(event, drawing);
      const to = squareAt(event);
      endDrawing();
      if (event.button !== 2) return;
      if (!moved) {
        removeArrowAt(event);
        return;
      }
      if (from === -1 || to === -1 || to === from) return;
      const key = `${from}:${to}`;
      if (!arrows.delete(key)) arrows.set(key, {from, to, side, occupied});
      renderArrows();
      return;
    }
    if (drag?.pointerId !== event.pointerId) return;
    const moved = Boolean(drag.ghost);
    endDrag();
    if (!moved) return;
    const to = squareAt(event);
    if (to !== -1 && tryDestination(to)) return;
    pick(-1);
  });

  function cancelPointer(event) {
    if (drawing?.pointerId === event.pointerId) endDrawing();
    if (drag?.pointerId !== event.pointerId) return;
    const moved = Boolean(drag.ghost);
    endDrag();
    if (moved) pick(-1);
  }
  surface.addEventListener('pointercancel', cancelPointer);
  surface.addEventListener('lostpointercapture', cancelPointer);

  clearArrows.addEventListener('click', () => {
    endDrawing();
    arrows.clear();
    renderArrows();
  });

  undo.addEventListener('click', () => {
    if (history.length === 0) return;
    engine.undo();
    future.push(history.pop().move);
    resetAfterMove();
    render();
  });
  redo.addEventListener('click', () => {
    if (future.length) play(future.at(-1), true);
  });
  render();
}

export function mountBoards() {
  for (const figure of document.querySelectorAll('.fen-board-figure')) {
    if (mounted.has(figure) || figure.closest('details:not([open])')) continue;
    mounted.add(figure);
    mount(figure);
  }
}

document.addEventListener('toggle', event => {
  if (event.target.tagName === 'DETAILS' && event.target.open) mountBoards();
}, true);
