import {lookup,replay} from './library.mjs';
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
export function mountLibrary(root,current,onLoad,countNode) {
  let data=null,failed=false,loading=false;
  const siteRoot=new URL('../../',import.meta.url);
  function loadLine(game,lineId,ply) {
    try{const result=replay(game,lineId);onLoad(result.states,result.line.moves,ply??result.line.moves.length,game.title+' · '+result.line.title);}
    catch{root.append(node('p','xq-hint','棋谱数据异常，无法载入。'));}
  }
  function update() {
    root.replaceChildren();
    if(!data) {
      if(countNode)countNode.textContent=failed?'加载失败':'加载中…';
      root.append(node('p','xq-hint',failed?'棋谱库加载失败，不能判断命中数量。':'正在加载博客棋谱…'));
      if(failed){const b=node('button','xq-library-button','重试加载');b.onclick=load;root.append(b);}
      return;
    }
    const result=lookup(data,current());
    const gameIds=[...new Set(result.hits.map(h=>h.gameId))];
    if(countNode)countNode.textContent=`${gameIds.length} 局匹配`;
    const coverage=node('p','xq-hint',`已收录 ${data.coverage.indexedArticles} / ${data.coverage.totalArticles} 篇 · ${data.coverage.games} 局主线（片段）`);
    root.append(coverage,node('p','xq-library-count',`${result.mainlineCount} 局主线到过此局面 · ${result.variationCount} 个分析分支命中`));
    const matches=node('div','xq-library-matches');
    for(const id of gameIds) {
      const game=data.games.find(g=>g.id===id);if(!game)continue;
      const item=node('div','xq-library-match');
      item.append(node('span','xq-library-title',game.title));
      const actions=node('div','xq-library-actions'),a=node('a','xq-library-button','跳转文章');
      a.href=new URL(game.url,siteRoot).href;a.target='_blank';a.rel='noopener';
      const lines=game.lines.filter(l=>result.hits.some(h=>h.gameId===game.id&&h.lineId===l.id));
      const b=node('button','xq-library-button','摆上棋谱');
      b.dataset.game=game.id;b.dataset.line=lines[0].id;
      if(lines.length>1) {
        const select=node('select','xq-library-lines');
        select.setAttribute('aria-label',game.title+'的匹配棋谱');select.dataset.game=game.id;
        for(const line of lines){const option=node('option','',line.title);option.value=line.id;select.append(option);}
        select.onchange=()=>{b.dataset.line=select.value;};actions.append(select);
      }
      b.onclick=()=>loadLine(game,b.dataset.line);
      actions.append(a,b);item.append(actions);matches.append(item);
    }
    if(!gameIds.length)matches.append(node('p','xq-hint','已收录棋谱中暂无匹配；不代表其他博客或实际对局从未出现。'));
    root.append(matches);
  }
  async function load() {
    if(loading)return;loading=true;failed=false;update();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try {
      const response=await fetch(new URL('../../assets/xiangqi/library.json',import.meta.url),{signal:controller.signal});
      if(!response.ok)throw Error('HTTP '+response.status);
      const candidate=await response.json();
      if(candidate.schemaVersion!==1||!Array.isArray(candidate.games)||!candidate.positions||!candidate.coverage)throw Error('Invalid library');
      data=candidate;
    }catch{failed=true;}finally{clearTimeout(timer);loading=false;if(root.isConnected)update();}
  }
  load();return {update};
}
