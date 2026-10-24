(() => {
  if (document.getElementById('blog-music')) return;
  // Add NetEase song IDs here to extend the playlist.
  const tracks = ['3448038585', '1918901957'];
  let index = 0, request = 0;
  const root = document.createElement('aside');
  root.id = 'blog-music';
  root.setAttribute('aria-label', '背景音乐');
  root.innerHTML = `<button type="button" class="music-toggle" aria-expanded="true" aria-controls="music-panel">♫ 音乐</button>
    <div id="music-panel">
      <div class="music-actions">
        <button type="button" data-music-prev aria-label="上一曲">上一曲</button>
        <button type="button" data-music-play aria-label="播放">播放</button>
        <button type="button" data-music-next aria-label="下一曲">下一曲</button>
      </div>
      <p data-music-status role="status" hidden></p>
    </div>`;
  const audio = document.createElement('audio');
  audio.autoplay = true;
  audio.preload = 'auto';
  root.append(audio);
  document.body.append(root);
  const toggle = root.querySelector('.music-toggle'), panel = root.querySelector('#music-panel');
  const playButton = root.querySelector('[data-music-play]');
  const status = root.querySelector('[data-music-status]');
  const showStatus = text => { status.textContent = text; status.hidden = !text; };
  const syncButton = () => {
    playButton.textContent = audio.paused ? '播放' : '暂停';
    playButton.setAttribute('aria-label', playButton.textContent);
  };
  async function play() {
    const currentRequest = ++request;
    showStatus('');
    try { await audio.play(); }
    catch (error) {
      if (currentRequest !== request || error.name === 'AbortError') return;
      showStatus(error.name === 'NotAllowedError' ? '点击播放，开始听歌。' : '歌曲暂时无法播放，请重试或切换歌曲。');
    }
    if (currentRequest === request) syncButton();
  }
  function changeTrack(step) {
    ++request;
    audio.pause();
    index = (index + step + tracks.length) % tracks.length;
    audio.src = `https://music.163.com/song/media/outer/url?id=${tracks[index]}.mp3`;
    audio.load();
    void play();
  }
  toggle.onclick = () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  };
  playButton.onclick = () => {
    if (audio.paused) {
      if (audio.error) audio.load();
      void play();
    } else { ++request; audio.pause(); showStatus(''); }
  };
  root.querySelector('[data-music-prev]').onclick = () => changeTrack(-1);
  root.querySelector('[data-music-next]').onclick = () => changeTrack(1);
  audio.addEventListener('play', syncButton);
  audio.addEventListener('pause', syncButton);
  audio.addEventListener('playing', () => showStatus(''));
  audio.addEventListener('error', () => { syncButton(); showStatus('歌曲暂时无法播放，请重试或切换歌曲。'); });
  audio.addEventListener('ended', () => changeTrack(1));
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
  });
  changeTrack(0);
})();
