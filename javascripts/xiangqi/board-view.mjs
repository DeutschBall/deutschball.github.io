import {mountBoards} from '../../assets/mkdocs-chess-plugin/board.mjs';

// The published plugin renders a new FEN into the figure when a move is made.
// The research room owns the full timeline and supplies a fresh figure on a jump.
export function mountBoardView(block, onMove, onNavigate) {
  let figure = block.querySelector('.fen-board-figure');
  figure.querySelector('.fen-board-surface').classList.add('xq-board');
  const template = figure.cloneNode(true);
  let position = figure.dataset.fen;
  let state = {};
  let suggestion;

  function markSquares() {
    for (const button of figure.querySelectorAll('button[data-square]')) {
      const square = button.dataset.square;
      const from = square === state.lastMove?.slice(0, 2);
      const to = square === state.lastMove?.slice(2);
      button.classList.toggle('fen-board-last', from || to);
      button.classList.toggle('fen-board-last-from', from);
      button.classList.toggle('fen-board-last-to', to);
      button.classList.toggle('xq-check', square === state.checkSquare);
      button.classList.toggle('xq-suggest', square === suggestion?.slice(0, 2) || square === suggestion?.slice(2));
    }
  }

  function syncControls() {
    const undo = figure.querySelector('[data-action="undo"]');
    const redo = figure.querySelector('[data-action="redo"]');
    if (undo) undo.disabled = !state.canUndo;
    if (redo) redo.disabled = !state.canRedo;
  }

  const observer = new MutationObserver(() => {
    const next = figure.dataset.fen;
    if (next !== position) {
      const from = figure.querySelector('.fen-board-last-from')?.dataset.square;
      const to = figure.querySelector('.fen-board-last-to')?.dataset.square;
      if (!from || !to || !onMove(from + to, next)) replaceFigure();
    }
    markSquares();
    syncControls();
  });
  const observe = () => observer.observe(figure, {attributes: true, attributeFilter: ['data-fen']});

  function replaceFigure() {
    observer.disconnect();
    const replacement = template.cloneNode(true);
    replacement.dataset.fen = position;
    figure.replaceWith(replacement);
    figure = replacement;
    observe();
    mountBoards();
  }

  // Use the plugin's controls with the research timeline, which can load whole branches.
  block.addEventListener('click', event => {
    const action = event.target.closest('.fen-board-controls > button')?.dataset.action;
    if (action === 'undo' || action === 'redo') {
      event.stopPropagation();
      onNavigate(action);
    }
  }, true);
  observe();
  mountBoards();
  return {
    update(next, options) {
      position = next;
      state = options;
      suggestion = null;
      if (options.reset || figure.dataset.fen !== position) replaceFigure();
      markSquares();
      syncControls();
    },
    suggest(move) {
      suggestion = move;
      markSquares();
    },
    disconnect() {
      observer.disconnect();
    },
  };
}
