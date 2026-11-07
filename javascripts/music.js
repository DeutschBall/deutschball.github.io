(() => {
  if (document.getElementById('blog-music')) return;
  // 音乐列表：添加网易云外链中 id= 后面的歌曲 ID，每首用引号包裹、逗号分隔。
  const tracks = ['3448038585', '1918901957'];
  if (!tracks.length) return;
  const track = tracks[Math.floor(Math.random() * tracks.length)];
  const root = document.createElement('aside');
  root.id = 'blog-music';
  root.setAttribute('aria-label', '背景音乐');
  root.innerHTML = `<button type="button" class="music-toggle" aria-expanded="true" aria-controls="music-panel">♫ 音乐</button>
    <div id="music-panel">
      <iframe title="网易云音乐播放器" width="330" height="86" frameborder="no" border="0" marginwidth="0" marginheight="0" allow="autoplay" src="https://music.163.com/outchain/player?type=2&id=${track}&auto=1&height=66"></iframe>
    </div>`;
  document.body.append(root);
  const toggle = root.querySelector('.music-toggle'), panel = root.querySelector('#music-panel');
  toggle.onclick = () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  };
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
  });
})();
