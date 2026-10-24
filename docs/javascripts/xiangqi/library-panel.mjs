import {lookup,replay} from './library.mjs';
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
export function mountLibrary(root,current,onLoad) {
  let data=null,failed=false,loading=false;
  const siteRoot=new URL('../../',import.meta.url);
  function loadLine(game,lineId,ply) {
    try{const result=replay(game,lineId);onLoad(result.states,result.line.moves,ply??result.line.moves.length,game.title+' · '+result.line.title);}
    catch{root.append(node('p','xq-hint','棋谱数据异常，无法载入。'));}
  }
  function update() {
    root.replaceChildren();
    root.append(node('h3','','我的博客棋谱'));
    if(!data) {
      root.append(node('p','xq-hint',failed?'棋谱库加载失败，不能判断命中数量。':'正在加载博客棋谱…'));
      if(failed){const b=node('button','xq-library-button','重试加载');b.onclick=load;root.append(b);}
      return;
    }
    const result=lookup(data,current());
    const coverage=node('p','xq-hint',`已收录 ${data.coverage.indexedArticles} / ${data.coverage.totalArticles} 篇 · ${data.coverage.games} 局主线（片段）`);
    root.append(coverage,node('p','xq-library-count',`${result.mainlineCount} 局主线到过此局面 · ${result.variationCount} 个分析分支命中`));
    root.append(node('p','xq-hint','按棋局去重，区分行棋方；主线记录不等同于已确认实战。未收录文章不参与统计。'));
    const matches=node('div','xq-library-matches');
    const gameIds=[...new Set(result.hits.map(h=>h.gameId))];
    for(const id of gameIds) {
      const game=data.games.find(g=>g.id===id);if(!game)continue;
      const item=node('div','xq-library-match'),a=node('a','',game.title);
      a.href=new URL(game.url,siteRoot).href;a.target='_blank';a.rel='noopener';item.append(a);
      for(const hit of result.hits.filter(h=>h.gameId===id)) {
        const line=game.lines.find(l=>l.id===hit.lineId);if(!line)continue;
        const b=node('button','xq-library-button',`${line.title} · 第 ${hit.plies.join('、')} 手 · 回放`);
        b.onclick=()=>loadLine(game,line.id,hit.plies[0]);item.append(b);
      }
      item.append(node('p','xq-hint',game.provenance));matches.append(item);
    }
    if(!gameIds.length)matches.append(node('p','xq-hint','已收录棋谱中暂无匹配；不代表其他博客或实际对局从未出现。'));
    root.append(matches);
    const details=node('details','xq-library-catalog');details.append(node('summary','',`打开已收录棋谱（${data.games.length} 局）`));
    for(const game of data.games) {
      details.append(node('p','xq-hint',game.title));
      for(const line of game.lines) {
        const b=node('button','xq-library-button',`载入${line.title}（${line.moves.length} 手）`);
        b.dataset.game=game.id;b.dataset.line=line.id;b.onclick=()=>loadLine(game,line.id);details.append(b);
      }
    }
    root.append(details);
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
