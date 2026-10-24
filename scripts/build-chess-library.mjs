import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {START,parseFen,fen,moves,play,notation} from '../docs/javascripts/xiangqi/rules.mjs';
import {createIndex} from '../docs/javascripts/xiangqi/library.mjs';
export const normalize = text=>text.normalize('NFKC').replace(/仕/g,'士').replace(/馬/g,'马').replace(/[一二三四五六七八九]/g,c=>String('一二三四五六七八九'.indexOf(c)+1));
export function convertRows(source,rows,startState) {
  let state=startState;const converted=[];
  for(const row of rows) {
    if(source[row.line-1]?.trim()!==row.text)throw Error(`来源第 ${row.line} 行已改变，请复核棋谱映射`);
    const numbered=row.text.match(/^(\d+)[、.．]\s*(.*)$/);
    if(!numbered || +numbered[1]!==state.fullmove)throw Error(`第 ${row.line} 行回合号不连续`);
    const blackStart=/^(?:\.{3}|…)/.test(numbered[2]);
    if(blackStart!==(state.turn==='b'))throw Error(`第 ${row.line} 行行棋方不一致`);
    const text=numbered[2].replace(/^(?:\.{3}|…)+\s*/,'');
    const tokens=text.match(/[车馬马炮兵卒相象仕士帅将前中后][一二三四五六七八九１-９1-9车馬马炮兵卒][进退平][一二三四五六七八九１-９1-9]/g)||[];
    const remainder=tokens.reduce((s,t)=>s.replace(t,''),text).replace(/[\s!?！？]/g,'');
    if(!tokens.length || remainder || tokens.length>(blackStart?1:2))throw Error(`第 ${row.line} 行格式需要人工复核`);
    for(const token of tokens) {
      const matches=moves(state).filter(m=>normalize(notation(state,m))===normalize(token));
      if(matches.length!==1)throw Error(`第 ${row.line} 行 ${token}：匹配 ${matches.length} 个合法着法，禁止猜测`);
      const move=matches[0];converted.push({move,chinese:token,sourceLine:row.line});state=play(state,move);
    }
  }
  return {state,converted};
}
export function build(root) {
  const raw=JSON.parse(readFileSync(resolve(root,'data/chess/games.json'),'utf8'));
  const docs=resolve(root,'docs');
  const games=raw.map(input=>{
    const sourcePath=resolve(docs,input.source);
    if(!sourcePath.startsWith(docs+sep)||!input.source.endsWith('.md'))throw Error('文章来源路径无效');
    const source=readFileSync(sourcePath,'utf8').split(/\r?\n/),startFen=input.startFen||START;
    const main=convertRows(source,input.mainline,parseFen(startFen));
    const lines=[{id:'main',title:'文章主线',kind:'mainline',fromPly:0,moves:main.converted.map(m=>m.move),sources:main.converted}];
    for(const variation of input.variations||[]) {
      if(!Number.isInteger(variation.fromPly)||variation.fromPly<0||variation.fromPly>lines[0].moves.length)throw Error('分支起点越界');
      const prefix=lines[0].moves.slice(0,variation.fromPly);
      const fork=prefix.reduce((state,m)=>play(state,m),parseFen(startFen));
      const branch=convertRows(source,variation.rows,fork);
      lines.push({id:variation.id,title:variation.title,kind:'variation',fromPly:variation.fromPly,moves:[...prefix,...branch.converted.map(m=>m.move)],sources:[...main.converted.slice(0,variation.fromPly),...branch.converted]});
    }
    if(new Set(lines.map(l=>l.id)).size!==lines.length)throw Error('重复分支 ID');
    return {id:input.id,title:input.title,source:input.source,url:input.source.replace(/\.md$/,'/').split('/').map(encodeURIComponent).join('/'),date:input.date,kind:input.kind,completeness:input.completeness,provenance:input.provenance,startFen:fen(parseFen(startFen)),lines};
  });
  const articles=[];
  function scan(dir){for(const f of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,f.name);if(f.isDirectory())scan(p);else if(f.name.endsWith('.md')&&!['index.md','tags.md'].includes(f.name))articles.push(relative(docs,p).split(sep).join('/'));}}
  scan(docs);
  const covered=new Set(games.map(g=>g.source));
  return {schemaVersion:1,coverage:{totalArticles:articles.length,indexedArticles:covered.size,games:games.length,scope:'试点仅收录已核对的编号着法；未收录文章不参与计数。',pendingArticles:articles.filter(a=>!covered.has(a)).sort()},games,positions:createIndex(games)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),output=resolve(root,'docs/assets/xiangqi/library.json');
  const content=JSON.stringify(build(root),null,2)+'\n';
  if(process.argv.includes('--check')) {
    if(readFileSync(output,'utf8')!==content)throw Error('棋谱索引已过期，请执行 node scripts/build-chess-library.mjs');
  }else{mkdirSync(dirname(output),{recursive:true});writeFileSync(output,content);}
  const result=JSON.parse(content);console.log(`${result.games.length} 局，${Object.keys(result.positions).length} 个局面；${result.coverage.indexedArticles}/${result.coverage.totalArticles} 篇文章已收录`);
}
