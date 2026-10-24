(() => {
  if (document.getElementById('blog-music')) return;
  const playerUrl = new URL('../music/player.html', document.currentScript.src);
  const root = document.createElement('aside');
  root.id = 'blog-music';
  root.setAttribute('aria-label', '背景音乐');
  root.innerHTML = `<button type="button" class="music-toggle" aria-expanded="false" aria-controls="music-panel">♫ 音乐</button>
    <div id="music-panel" hidden>
      <strong>背景音乐 · 网易云</strong>
      <iframe title="博客音乐播放器" class="music-frame" allow="autoplay"></iframe>
      <div class="music-actions"><button type="button" data-music-window>独立窗口播放</button><button type="button" data-music-stop>停止播放</button></div>
      <p>切换文章会中断本页播放；独立窗口可持续播放。</p>
    </div>`;
  document.body.append(root);
  const toggle = root.querySelector('.music-toggle'), panel = root.querySelector('#music-panel');
  const frame = root.querySelector('iframe');
  toggle.onclick = () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden && !frame.hasAttribute('src')) frame.src = playerUrl.href;
  };
  root.querySelector('[data-music-stop]').onclick = () => frame.removeAttribute('src');
  root.querySelector('[data-music-window]').onclick = () => {
    const popup = window.open(playerUrl.href, 'dustland-music', 'popup,width=380,height=310');
    if (popup) { frame.removeAttribute('src'); panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); popup.focus(); }
  };
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
  });
})();
