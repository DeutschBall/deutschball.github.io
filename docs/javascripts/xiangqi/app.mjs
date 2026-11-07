import {START,coord,index,parseFen,fen,legal,moves,play,inCheck,notation} from './rules.mjs';
import {mountBoardView} from './board-view.mjs';
import {Cloud} from './cloud.mjs';
import {mountLibrary} from './library-panel.mjs';
const statusText = {unknown:'云库暂无此局面数据，可继续走棋探索。','invalid board':'云库不接受此局面，请检查 FEN。',checkmate:'将死：行棋方负。',stalemate:'困毙：行棋方负。',nobestmove:'暂无推荐着法。'};
const scoreText = n => n === null ? '未知' : (n>0?'+':'')+n;
const el = (tag,cls,text) => {const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
export function mount(root) {
  const quotesEnabled=root.dataset.quotes!=='false', cloudEnabled=root.dataset.cloudAnalysis!=='false', libraryEnabled=root.dataset.chessLibrary!=='false';
  const boardBlock=root.querySelector('details.fen-board');
  if(!boardBlock)throw new Error('研究室缺少插件棋盘');
  root.innerHTML = `<div class="xq-heading"><div><p data-quote>有棋友问，没根是谁</p></div><a class="xq-source" href="https://www.chessdb.cn/" target="_blank" rel="noopener">中国象棋云库 ↗</a></div>
  <div class="xq-layout"><section class="xq-play" aria-label="象棋棋盘"></section>
  <section class="xq-panel"><details class="xq-cloud-toggle xq-panel-toggle"><summary><span>云库分析</span></summary><div class="xq-panel-title"><span>当前局面分析</span><button data-action="retry">刷新分析</button></div><p class="xq-perspective" data-perspective></p><p class="xq-cloud-status" data-cloud role="status" aria-live="polite"></p><div class="xq-table-wrap"><table class="xq-candidates"><thead><tr><th>候选着法</th><th>分值</th><th>评估胜率</th></tr></thead><tbody></tbody></table></div><details class="xq-pv"><summary>主变化</summary><p data-pv>等待分析</p></details></details></section>
  <section class="xq-panel"><details class="xq-history-toggle xq-panel-toggle"><summary><span>着法记录</span><span data-history-count>0 手</span></summary><div class="xq-history-nav"><button data-action="first" aria-label="回到起始局面">⇤</button><button data-action="prev" aria-label="上一步">←</button><button data-action="next" aria-label="下一步">→</button><button data-action="last" aria-label="最新局面">⇥</button></div><div class="xq-history" aria-label="着法历史"></div><p class="xq-hint">回看后落子将从此处开始新的变化。</p></details></section>
  <section class="xq-panel xq-library" aria-label="博客棋谱局面检索"><details class="xq-library-toggle xq-panel-toggle"><summary><span>我的博客棋谱</span><span data-library-count aria-live="polite">加载中…</span></summary><div data-library aria-live="polite"></div></details></section></div>
  <details class="xq-fen"><summary>FEN</summary><label for="xq-fen-input">局面代码（w 红走 / b 黑走）</label><textarea id="xq-fen-input" rows="3" spellcheck="false"></textarea><div class="xq-toolbar"><button data-action="import">导入局面</button><button data-action="export">导出当前局面</button></div><p>导入会清空当前着法记录；导出会将当前局面填入文本框并尝试复制。</p></details>`;
  const $=s=>root.querySelector(s),cloud=cloudEnabled?new Cloud():null;
  boardBlock.classList.add('xq-board-toggle','xq-panel-toggle');
  boardBlock.firstElementChild.insertAdjacentHTML('afterend','<div class="xq-turnbar"><strong data-xq-turn></strong><span data-ply></span></div>');
  boardBlock.insertAdjacentHTML('beforeend','<p class="xq-message" data-message role="status" aria-live="polite"></p>');
  $('.xq-play').append(boardBlock);
  boardBlock.open=true;
  const board=mountBoardView(boardBlock,makeMove,navigate);
  if(!cloudEnabled) $('.xq-cloud-toggle').closest('section').remove();
  if(!libraryEnabled) $('.xq-library').remove();
  const quoteNode = $('[data-quote]');
  if(!quotesEnabled) quoteNode.remove();
  if(quotesEnabled) fetch(new URL('../../assets/xiangqi/quotes.txt', import.meta.url))
    .then(response => {
      if (!response.ok) throw new Error('名言表加载失败');
      return response.text();
    })
    .then(text => {
      const quotes = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (quotes.length) quoteNode.textContent = quotes[Math.floor(Math.random() * quotes.length)];
    })
    .catch(() => {}); // 加载失败时保留默认名言，不影响棋盘。

  let states=[parseFen(START)],history=[],redoStack=[],cursor=0;
  let timer,controller,version=0,ended=false,libraryPanel;
  const current=()=>states[cursor];
  const message=text=>{$('[data-message]').textContent=text;};
  function makeMove(move, expectedFen) {
    try {
      const before=current(),next=play(before,move);
      if(expectedFen && fen(next)!==expectedFen)throw new Error('棋盘与研究室的局面不一致。');
      redoStack=[];
      history=history.slice(0,cursor);states=states.slice(0,cursor+1);
      history.push({move,label:notation(before,move),side:before.turn});states.push(next);cursor++;
      refresh();
      return true;
    }catch(e){message(e.message);return false;}
  }
  function drawHistory() {
    const container=$('.xq-history');container.replaceChildren();
    if(!history.length)container.append(el('span','xq-hint','尚未落子。试试走出你的第一步。'));
    history.forEach((entry,i)=>{
      const b=el('button',(i+1===cursor?'xq-active ':'')+(entry.side==='w'?'xq-red-text':''),`${i+1}. ${entry.label}`);
      b.title=entry.move;b.setAttribute('aria-current',i+1===cursor?'step':'false');b.onclick=()=>{redoStack=[];cursor=i+1;refresh();};container.append(b);
    });
    $('[data-history-count]').textContent=`${history.length} 手`;
    for(const a of ['first','prev'])$(`[data-action="${a}"]`).disabled=cursor===0;
    for(const a of ['next','last'])$(`[data-action="${a}"]`).disabled=cursor===history.length;
  }
  function refresh(resetBoard=false) {
    const state=current(),checking=inCheck(state),available=moves(state);ended=available.length===0;
    const position=fen(state);
    $('textarea').value=position;
    $('[data-xq-turn]').textContent=`${state.turn==='w'?'红方':'黑方'}${ended?(checking?'被将死':'被困毙'):'走棋'+(checking?' · 将军':'')}`;
    $('[data-ply]').textContent=`第 ${state.fullmove} 回合 · ${cursor} / ${history.length} 手`;
    if(cloudEnabled) $('[data-perspective]').textContent=`分值与评估胜率均为当前行棋方（${state.turn==='w'?'红方':'黑方'}）视角。`;
    message(ended?'此局面已结束，行棋方负。':checking?'正在被将军，请先应将。':'');
    const repetitions=states.slice(0,cursor+1).filter(s=>fen(s).split(' ').slice(0,2).join(' ')===position.split(' ').slice(0,2).join(' ')).length;
    if(repetitions>=3)message('此局面已重复三次；长将、长捉请按实际棋规判断。');
    board.update(position,{
      lastMove:history[cursor-1]?.move,
      checkSquare:checking?coord(state.board.indexOf(state.turn==='w'?'K':'k')):null,
      canUndo:cursor>0, canRedo:redoStack.length>0, reset:resetBoard,
    });
    drawHistory();if(cloudEnabled) $('[data-action="retry"]').disabled=ended;
    libraryPanel?.update();
    schedule();
  }
  function schedule(force=false) {
    if(!cloudEnabled)return;
    clearTimeout(timer);controller?.abort();version++;
    $('tbody').replaceChildren();$('[data-pv]').textContent='等待分析';
    if(!$('.xq-cloud-toggle').open){$('[data-cloud]').textContent='展开后查询当前局面。';return;}
    if(ended){$('[data-cloud]').textContent='局面已结束。';$('[data-pv]').textContent='无后续着法。';return;}
    $('[data-cloud]').textContent='正在查询云库…';
    const request=version,state=current(),position=fen(state);
    controller=new AbortController();const signal=controller.signal;
    timer=setTimeout(async()=>{
      if(signal.aborted || !$('.xq-cloud-toggle').open || !root.isConnected)return;
      const results=await Promise.allSettled([cloud.query('queryall',position,signal,force),cloud.query('querypv',position,signal,force)]);
      if(request!==version||signal.aborted||!root.isConnected||!$('.xq-cloud-toggle').open)return;
      const [all,pv]=results;
      if(all.status==='rejected')$('[data-cloud]').textContent='云库暂时无法连接或请求超时。可继续走棋，稍后点击刷新分析。';
      else if(all.value.status!=='ok')$('[data-cloud]').textContent=statusText[all.value.status]||'暂无数据';
      else {
        let count=0;
        for(const item of all.value.moves) {
          if(!legal(state,index(item.move.slice(0,2)),index(item.move.slice(2))))continue;
          count++;
          const row=el('tr'),cell=el('td'),b=el('button','xq-move',notation(state,item.move));
          b.title=item.move+' · '+item.note;b.onclick=()=>makeMove(item.move);
          const highlight=()=>board.suggest(item.move),clear=()=>board.suggest(null);
          b.onmouseenter=highlight;b.onmouseleave=clear;b.onfocus=highlight;b.onblur=clear;cell.append(b);
          if(item.rank===2 && item.score!==null)cell.append(el('span','xq-best','最佳'));
          row.append(cell,el('td',item.score>0?'xq-red-text':'',scoreText(item.score)),el('td','',item.winrate===null?'—':`${item.winrate}%`));
          $('tbody').append(row);
        }
        $('[data-cloud]').textContent=count?`${count} 个候选着法 · 点击着法落子`:'云库未返回可用着法。';
      }
      if(pv.status==='rejected')$('[data-pv]').textContent='主变化暂时不可用，可刷新重试。';
      else if(pv.value.status!=='ok')$('[data-pv]').textContent=statusText[pv.value.status]||'暂无主变化。';
      else {
        let position=state;const labels=[];
        for(const move of pv.value.pv) {
          try{const next=play(position,move);labels.push(notation(position,move));position=next;}catch{break;}
        }
        $('[data-pv]').textContent=labels.length?`云库深度 ${pv.value.depth} · 分值 ${scoreText(pv.value.score)}\n${labels.join(' → ')}`:'暂无可用主变化。';
      }
    },force?0:300);
  }
  function navigate(action) {
    if(action==='undo'&&cursor>0){redoStack.push({states,history,cursor});cursor--;history=history.slice(0,cursor);states=states.slice(0,cursor+1);}
    if(action==='redo'&&redoStack.length){({states,history,cursor}=redoStack.pop());}
    if(['first','last','prev','next'].includes(action))redoStack=[];
    if(action==='first')cursor=0;
    if(action==='last')cursor=history.length;
    if(action==='prev')cursor=Math.max(0,cursor-1);
    if(action==='next')cursor=Math.min(history.length,cursor+1);
    refresh();
  }
  root.addEventListener('click',async e=>{
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(!action||e.target.closest('.fen-board-figure'))return;
    if(action==='retry'){schedule(true);return;}
    if(action==='export') {
      const value=fen(current());$('textarea').value=value;
      try{await navigator.clipboard.writeText(value);message('当前 FEN 已复制。');}catch{$('textarea').focus();$('textarea').select();message('当前 FEN 已填入文本框，可手动复制。');}return;
    }
    if(action==='import') {
      try {const s=parseFen($('textarea').value);states=[s];history=[];redoStack=[];cursor=0;refresh(true);message('局面已导入。');}
      catch(e){message(e.message);}return;
    }
    navigate(action);
  });
  if(libraryEnabled) libraryPanel=mountLibrary($('[data-library]'),current,(loaded,lineMoves,ply,title)=>{
    redoStack=[];states=loaded;
    history=lineMoves.map((move,i)=>({move,label:notation(states[i],move),side:states[i].turn}));
    cursor=Math.max(0,Math.min(ply,history.length));
    refresh(true);message('已载入：'+title+'；使用历史按钮逐步回放。');
  },$('[data-library-count]'));
  $('.xq-cloud-toggle')?.addEventListener('toggle',e=>{if(e.target===$('.xq-cloud-toggle'))schedule();});
  refresh();
  // Material instant navigation can remove this root while requests are pending.
  const observer=new MutationObserver(()=>{if(!root.isConnected){clearTimeout(timer);controller?.abort();board.disconnect();observer.disconnect();}});
  observer.observe(document.body,{childList:true,subtree:true});
}
