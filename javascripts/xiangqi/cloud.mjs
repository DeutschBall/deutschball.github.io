const ENDPOINT = 'https://www.chessdb.cn/chessdb.php';
const states = new Set(['unknown','invalid board','checkmate','stalemate','nobestmove']);
const numeric = value => /^-?\d+(\.\d+)?$/.test(value || '') && Number.isFinite(Number(value)) ? Number(value) : null;
const fields = text => Object.fromEntries(text.split(',').map(s => { const i=s.indexOf(':'); return i<0?[s,'']:[s.slice(0,i),s.slice(i+1)]; }));
export function parseResponse(action, raw) {
  const text=raw.replace(/\0/g,'').trim();
  if(states.has(text)) return {status:text};
  if(action==='queryall') {
    const entries=text.split('|').filter(Boolean).map(fields);
    if(!entries.length || entries.some(e=>!/^[a-i][0-9][a-i][0-9]$/.test(e.move))) throw Error('云库响应格式异常');
    return {status:'ok',moves:entries.map(e=>({move:e.move,score:numeric(e.score),rank:numeric(e.rank),winrate:numeric(e.winrate),note:e.note||''}))};
  }
  if(action==='querypv') {
    const match=text.match(/^score:([^,]+),depth:(\d+),pv:([a-i0-9|]+)$/);
    if(!match || match[3].split('|').some(m=>!/^[a-i][0-9][a-i][0-9]$/.test(m))) throw Error('云库主变化格式异常');
    return {status:'ok',score:numeric(match[1]),depth:Number(match[2]),pv:match[3].split('|')};
  }
  throw Error('不支持的云库查询');
}
export class Cloud {
  constructor(fetcher=globalThis.fetch.bind(globalThis), timeout=10000) { this.fetcher=fetcher;this.timeout=timeout;this.cache=new Map(); }
  async query(action, board, signal, refresh=false) {
    const position=board.split(' ').slice(0,2).join(' '), key=action+position,cached=this.cache.get(key);
    if(!refresh && cached && Date.now()-cached.time<60000) return cached.value;
    const controller=new AbortController(),abort=()=>controller.abort();
    if(signal?.aborted) throw new DOMException('Aborted','AbortError');
    signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,this.timeout);
    try {
      const response=await this.fetcher(ENDPOINT+'?'+new URLSearchParams({action,board:position,learn:'0',egtbmetric:'dtm'}),{signal:controller.signal,credentials:'omit'});
      if(!response.ok) throw Error(`云库 HTTP ${response.status}`);
      const value=parseResponse(action,await response.text());
      if(controller.signal.aborted) throw new DOMException('Aborted','AbortError');
      this.cache.set(key,{value,time:Date.now()});
      if(this.cache.size>128) this.cache.delete(this.cache.keys().next().value);
      return value;
    } finally { clearTimeout(timer);signal?.removeEventListener('abort',abort); }
  }
}
