(() => {
  const select = document.getElementById('music-tracks');
  const container = document.getElementById('netease-player');
  const source = document.getElementById('music-source');
  function load() {
    const id = select.value;
    const frame = document.createElement('iframe');
    frame.title = `网易云音乐 · ${select.selectedOptions[0].textContent}`;
    frame.allow = 'autoplay';
    frame.src = `https://music.163.com/outchain/player?type=2&id=${id}&auto=1&height=66`;
    container.replaceChildren(frame);
    source.href = `https://music.163.com/#/song?id=${id}`;
  }
  select.onchange = load;
  document.getElementById('music-start').onclick = load;
  document.getElementById('music-stop').onclick = () => container.replaceChildren();
  load();
})();
