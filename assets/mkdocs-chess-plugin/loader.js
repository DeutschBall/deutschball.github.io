(() => {
  const moduleUrl = new URL('board.mjs', document.currentScript.src);

  function loadBoards() {
    if (document.querySelector('.fen-board-figure')) {
      import(moduleUrl.href).then(({mountBoards}) => mountBoards()).catch(console.error);
    }
  }

  if (typeof document$ !== 'undefined') document$.subscribe(loadBoards);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadBoards);
  else loadBoards();
})();
