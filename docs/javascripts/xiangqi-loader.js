(() => {
  const base = new URL('xiangqi/app.mjs', document.currentScript.src);
  function init() {
    const root = document.getElementById('xiangqi-analysis');
    if (!root || root.dataset.loaded) return;
    root.dataset.loaded = 'true';
    import(base.href).then(({mount}) => mount(root)).catch(() => {
      root.textContent = '棋盘加载失败，请刷新页面重试。';
      delete root.dataset.loaded;
    });
  }
  if (typeof document$ !== 'undefined') document$.subscribe(init);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
