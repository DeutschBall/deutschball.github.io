import {START,names,side,coord,index,parseFen,fen,legal,moves,play,inCheck,notation} from './rules.mjs';
import {Cloud} from './cloud.mjs';
import {mountLibrary} from './library-panel.mjs';
const statusText = {unknown:'云库暂无此局面数据，可继续走棋探索。','invalid board':'云库不接受此局面，请检查 FEN。',checkmate:'将死：行棋方负。',stalemate:'困毙：行棋方负。',nobestmove:'暂无推荐着法。'};
const scoreText = n => n === null ? '未知' : (n>0?'+':'')+n;
const el = (tag,cls,text) => {const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
export function mount(root) {
  root.innerHTML = `<div class="xq-heading"><div><span class="xq-eyebrow">DUSTLAND · XIANGQI</span><h2>棋局研究室</h2><p>落子之间，探寻更好的下一步。</p></div><a class="xq-source" href="https://www.chessdb.cn/" target="_blank" rel="noopener">中国象棋云库 ↗</a></div>
  <div class="xq-layout"><section class="xq-play" aria-label="象棋棋盘"><div class="xq-turnbar"><strong data-turn></strong><span data-ply></span></div><div class="xq-board" role="group" aria-label="象棋棋盘，点击棋子后点击目标位置"></div><div class="xq-toolbar"><button data-action="undo">悔棋</button><button data-action="flip">翻转棋盘</button><button data-action="reset">重新开局</button></div><p class="xq-message" data-message role="status" aria-live="polite">点击棋子，选择落点。</p></section>
  <section class="xq-panel"><details class="xq-cloud-toggle"><summary><span>云库分析</span><span class="xq-cloud-expand">展开后查询 ▾</span><span class="xq-cloud-collapse">收起 ▴</span></summary><div class="xq-panel-title"><span>当前局面分析</span><button data-action="retry">刷新分析</button></div><p class="xq-perspective" data-perspective></p><p class="xq-cloud-status" data-cloud role="status" aria-live="polite"></p><div class="xq-table-wrap"><table class="xq-candidates"><thead><tr><th>候选着法</th><th>分值</th><th>评估胜率</th></tr></thead><tbody></tbody></table></div><details class="xq-pv"><summary>主变化</summary><p data-pv>等待分析</p></details></details></section>
  <section class="xq-panel"><div class="xq-panel-title"><h3>着法记录</h3><span data-history-count>0 手</span></div><div class="xq-history-nav"><button data-action="first" aria-label="回到起始局面">⇤</button><button data-action="prev" aria-label="上一步">←</button><button data-action="next" aria-label="下一步">→</button><button data-action="last" aria-label="最新局面">⇥</button></div><div class="xq-history" aria-label="着法历史"></div><p class="xq-hint">回看后落子将从此处开始新的变化。</p></section>
  <section class="xq-panel xq-library" data-library aria-label="博客棋谱局面检索" aria-live="polite"></section></div>
  <details class="xq-fen"><summary>FEN · 导入与导出局面</summary><label for="xq-fen-input">局面代码（w 红走 / b 黑走）</label><textarea id="xq-fen-input" rows="3" spellcheck="false"></textarea><div class="xq-toolbar"><button data-action="import">导入局面</button><button data-action="export">导出当前局面</button></div><p>导入会清空当前着法记录；导出会将当前局面填入文本框并尝试复制。</p></details><p class="xq-footnote">云库评估仅供研究，未知分值不代表均势。支持基本走子规则；长将、长捉及重复局面不作自动裁定。</p>`;
  const $=s=>root.querySelector(s), boardNode=$('.xq-board'),cloud=new Cloud();
  let states=[parseFen(START)],history=[],cursor=0,flipped=false,selected=null,legalTargets=[],hoverMove=null;
  let timer,controller,version=0,ended=false,libraryPanel;
  const current=()=>states[cursor];
  const message=text=>{$('[data-message]').textContent=text;};
  function svgBoard() {
    let lines='';
    for(let y=0;y<10;y++) lines+=`<path d="M 40 ${40+y*50} H 440"/>`;
    for(let x=0;x<9;x++) lines+=`<path d="M ${40+x*50} 40 V ${x===0||x===8?490:240}${x===0||x===8?'':` M ${40+x*50} 290 V 490`}"/>`;
    lines+='<path d="M190 40 L290 140 M290 40 L190 140 M190 390 L290 490 M290 390 L190 490"/>';
    let labels='';
    for(let x=0;x<9;x++) labels+=`<text x="${40+x*50}" y="518">${String.fromCharCode(97+(flipped?8-x:x))}</text>`;
    for(let y=0;y<10;y++) labels+=`<text x="12" y="${44+y*50}">${flipped?y:9-y}</text>`;
    return `<svg viewBox="0 0 480 530" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.2">${lines}<rect x="34" y="34" width="412" height="462"/></g><g fill="currentColor" text-anchor="middle" font-size="21" font-family="serif"><text x="140" y="273">楚 河</text><text x="340" y="273">汉 界</text></g><g fill="currentColor" text-anchor="middle" font-size="11">${labels}</g></svg>`;
  }
  function drawBoard() {
    boardNode.innerHTML=svgBoard();
    const state=current(),last=cursor?history[cursor-1].move:null,checking=inCheck(state);
    const hints=hoverMove?[index(hoverMove.slice(0,2)),index(hoverMove.slice(2))]:[];
    for(let display=0;display<90;display++) {
      const i=flipped?89-display:display,p=state.board[i],button=el('button','xq-square');
      button.type='button';button.dataset.square=coord(i);button.style.left=`${(40+(display%9)*50)/480*100}%`;button.style.top=`${(40+Math.floor(display/9)*50)/530*100}%`;
      button.setAttribute('aria-label',`${coord(i)} ${p?(side(p)==='w'?'红':'黑')+names[p]:'空位'}`);
      button.setAttribute('aria-pressed',String(i===selected));
      if(p) {button.append(el('span','xq-piece '+(side(p)==='w'?'xq-red':'xq-black'),names[p]));}
      if(i===selected)button.classList.add('xq-selected');
      if(legalTargets.includes(i))button.classList.add('xq-target');
      if(last&&(coord(i)===last.slice(0,2)||coord(i)===last.slice(2)))button.classList.add('xq-last');
      if(hints.includes(i))button.classList.add('xq-suggest');
      if(checking&&p===(state.turn==='w'?'K':'k'))button.classList.add('xq-check');
      button.addEventListener('click',()=>select(i));boardNode.append(button);
    }
  }
  function select(i) {
    if(ended){message('此局面已结束，可悔棋或重新开局。');return;}
    if(selected!==null && legal(current(),selected,i)){makeMove(coord(selected)+coord(i));return;}
    if(side(current().board[i])===current().turn) {
      selected=selected===i?null:i;legalTargets=selected===null?[]:moves(current(),selected).map(m=>index(m.slice(2)));message('已标出可走位置。');
    } else {message(selected===null?'请选择行棋方的棋子。':'这步棋不合法，请选择标记位置。');}
    drawBoard();
  }
  function makeMove(move) {
    try {
      const before=current(),next=play(before,move);
      history=history.slice(0,cursor);states=states.slice(0,cursor+1);
      history.push({move,label:notation(before,move),side:before.turn});states.push(next);cursor++;
      refresh();
    }catch(e){message(e.message);}
  }
  function drawHistory() {
    const container=$('.xq-history');container.replaceChildren();
    if(!history.length)container.append(el('span','xq-hint','尚未落子。试试走出你的第一步。'));
    history.forEach((entry,i)=>{
      const b=el('button',(i+1===cursor?'xq-active ':'')+(entry.side==='w'?'xq-red-text':''),`${i+1}. ${entry.label}`);
      b.title=entry.move;b.setAttribute('aria-current',i+1===cursor?'step':'false');b.onclick=()=>{cursor=i+1;refresh();};container.append(b);
    });
    $('[data-history-count]').textContent=`${history.length} 手`;
    for(const a of ['first','prev','undo'])$(`[data-action="${a}"]`).disabled=cursor===0;
    for(const a of ['next','last'])$(`[data-action="${a}"]`).disabled=cursor===history.length;
  }
  function refresh() {
    selected=null;legalTargets=[];hoverMove=null;
    const state=current(),checking=inCheck(state),available=moves(state);ended=available.length===0;
    $('[data-turn]').textContent=`${state.turn==='w'?'红方':'黑方'}${ended?(checking?'被将死':'被困毙'):'走棋'+(checking?' · 将军':'')}`;
    $('[data-ply]').textContent=`第 ${state.fullmove} 回合 · ${cursor} / ${history.length} 手`;
    $('[data-perspective]').textContent=`分值与评估胜率均为当前行棋方（${state.turn==='w'?'红方':'黑方'}）视角。`;
    message(ended?'此局面已结束，行棋方负。':checking?'正在被将军，请先应将。':'点击棋子，选择落点。');
    const repetitions=states.slice(0,cursor+1).filter(s=>fen(s).split(' ').slice(0,2).join(' ')===fen(state).split(' ').slice(0,2).join(' ')).length;
    if(repetitions>=3)message('此局面已重复三次；长将、长捉请按实际棋规判断。');
    drawBoard();drawHistory();$('[data-action="retry"]').disabled=ended;
    libraryPanel?.update();
    schedule();
  }
  function schedule(force=false) {
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
          const highlight=()=>{hoverMove=item.move;drawBoard();},clear=()=>{hoverMove=null;drawBoard();};
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
  root.addEventListener('click',async e=>{
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(!action)return;
    if(action==='flip'){flipped=!flipped;drawBoard();return;}
    if(action==='retry'){schedule(true);return;}
    if(action==='export') {
      const value=fen(current());$('textarea').value=value;
      try{await navigator.clipboard.writeText(value);message('当前 FEN 已复制。');}catch{$('textarea').focus();$('textarea').select();message('当前 FEN 已填入文本框，可手动复制。');}return;
    }
    if(action==='import') {
      try {const s=parseFen($('textarea').value);states=[s];history=[];cursor=0;refresh();message('局面已导入。');}
      catch(e){message(e.message);}return;
    }
    if(action==='reset'){states=[parseFen(START)];history=[];cursor=0;}
    if(action==='undo'&&cursor>0){cursor--;history=history.slice(0,cursor);states=states.slice(0,cursor+1);}
    if(action==='first')cursor=0;
    if(action==='last')cursor=history.length;
    if(action==='prev')cursor=Math.max(0,cursor-1);
    if(action==='next')cursor=Math.min(history.length,cursor+1);
    refresh();
  });
  libraryPanel=mountLibrary($('[data-library]'),current,(loaded,lineMoves,ply,title)=>{
    states=loaded;
    history=lineMoves.map((move,i)=>({move,label:notation(states[i],move),side:states[i].turn}));
    cursor=Math.max(0,Math.min(ply,history.length));
    refresh();message('已载入：'+title+'；使用历史按钮逐步回放。');
  });
  $('.xq-cloud-toggle').addEventListener('toggle',e=>{if(e.target===$('.xq-cloud-toggle'))schedule();});
  $('textarea').value=START;refresh();
  // Material instant navigation can remove this root while requests are pending.
  const observer=new MutationObserver(()=>{if(!root.isConnected){clearTimeout(timer);controller?.abort();observer.disconnect();}});
  observer.observe(document.body,{childList:true,subtree:true});
}
