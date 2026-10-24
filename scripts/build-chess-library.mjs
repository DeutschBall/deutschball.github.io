import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {START,parseFen,fen,moves,play,notation} from '../docs/javascripts/xiangqi/rules.mjs';
import {createIndex} from '../docs/javascripts/xiangqi/library.mjs';
export const normalize = text=>text.normalize('NFKC').replace(/仕/g,'士').replace(/馬/g,'马').replace(/相/g,'象').replace(/帅/g,'将').replace(/兵/g,'卒').replace(/[一二三四五六七八九]/g,c=>String('一二三四五六七八九'.indexOf(c)+1));
export function parseMoveRow(raw) {
  const text=raw.replace(/^\s*(?:>\s*)+/, '').trim().normalize('NFKC');
  const match=text.match(/^(?:\((\d+)\)|(\d+)[、.]|(\d+)\s+(?=\.\.\.))\s*(.*)$/);
  if(!match)return null;
  const body=match[4], tokens=body.match(/[车馬马炮兵卒相象仕士帅将前中后][一二三四五六七八九1-9车馬马炮兵卒][进退平][一二三四五六七八九1-9]/g)||[];
  if(!tokens.length)return null;
  // Accept Unicode punctuation/symbols between moves, but never discard prose or numbers.
  const remainder=tokens.reduce((s,t)=>s.replace(t,''),body).replace(/[\s\p{P}\p{S}]/gu,'');
  if(remainder||tokens.length>2)throw Error('编号行含说明或不支持的着法格式');
  const black=/^(?:\.{3}|…)/.test(body)||/[1-9]/.test(tokens[0]);
  if(black&&tokens.length>1)throw Error('黑方起始行只能包含一个着法');
  return {round:Number(match[1]||match[2]||match[3]),turn:black?'b':'w',tokens};
}
export function convertRows(source,rows,startState) {
  let state=startState;const converted=[];
  for(const row of rows) {
    if(source[row.line-1]?.trim()!==row.text)throw Error(`来源第 ${row.line} 行已改变，请复核棋谱映射`);
    const parsed=parseMoveRow(row.text);
    if(!parsed)throw Error(`第 ${row.line} 行格式需要人工复核`);
    if(parsed.round!==state.fullmove)throw Error(`第 ${row.line} 行回合号不连续`);
    if(parsed.turn!==state.turn)throw Error(`第 ${row.line} 行行棋方不一致`);
    const count=row.take??parsed.tokens.length;
    if(!Number.isInteger(count)||count<1||count>parsed.tokens.length)throw Error('无效的来源着法范围');
    for(const token of parsed.tokens.slice(0,count)) {
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
    if(!main.converted.length)throw Error('空棋谱不能计入对局数量');
    const lines=[{id:'main',title:'文章主线',kind:'mainline',fromPly:0,moves:main.converted.map(m=>m.move),sources:main.converted}];
    for(const variation of input.variations||[]) {
      if(!Number.isInteger(variation.fromPly)||variation.fromPly<0||variation.fromPly>lines[0].moves.length)throw Error('分支起点越界');
      const prefix=lines[0].moves.slice(0,variation.fromPly);
      const fork=prefix.reduce((state,m)=>play(state,m),parseFen(startFen));
      const branch=convertRows(source,variation.rows,fork);
      const branchPly=variation.branchPly??variation.fromPly;
      const fullMoves=[...prefix,...branch.converted.map(m=>m.move)];
      if(!Number.isInteger(branchPly)||branchPly<variation.fromPly||branchPly>fullMoves.length||fullMoves.slice(0,branchPly).some((m,i)=>m!==lines[0].moves[i]))throw Error('变着共享前缀不一致');
      lines.push({id:variation.id,title:variation.title,kind:'variation',fromPly:variation.branchPly??variation.fromPly,moves:[...prefix,...branch.converted.map(m=>m.move)],sources:[...main.converted.slice(0,variation.fromPly),...branch.converted]});
    }
    if(new Set(lines.map(l=>l.id)).size!==lines.length)throw Error('重复分支 ID');
    return {id:input.id,title:input.title,source:input.source,url:input.source.replace(/\.md$/,'/').split('/').map(encodeURIComponent).join('/'),date:input.date,kind:input.kind,completeness:input.completeness,provenance:input.provenance,startFen:fen(parseFen(startFen)),lines};
  });
  const articles=[];
  function scan(dir){for(const f of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,f.name);if(f.isDirectory())scan(p);else if(f.name.endsWith('.md')&&!['index.md','tags.md'].includes(f.name))articles.push(relative(docs,p).split(sep).join('/'));}}
  scan(docs);
  const covered=new Set(games.map(g=>g.source));
  const audit=JSON.parse(readFileSync(resolve(root,'data/chess/import-audit.json'),'utf8')).articles;
  if(audit.length!==articles.length||new Set(audit.map(a=>a.source)).size!==articles.length)throw Error('文章审计清单不完整，请重新导入');
  for(const article of articles) {
    const item=audit.find(a=>a.source===article);
    const hash=createHash('sha256').update(readFileSync(resolve(docs,article),'utf8')).digest('hex').slice(0,12);
    if(!item||item.sourceHash!==hash)throw Error(`文章审计已过期：${article}`);
  }
  return {schemaVersion:1,coverage:{totalArticles:articles.length,processedArticles:audit.length,indexedArticles:covered.size,games:games.length,scope:'全站编号着法导入；仅索引可按来源连续合法回放的片段。',pendingArticles:articles.filter(a=>!covered.has(a)).sort(),partialArticles:audit.filter(a=>a.status==='partial').map(a=>a.source).sort()},games,positions:createIndex(games)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),output=resolve(root,'docs/assets/xiangqi/library.json');
  const content=JSON.stringify(build(root),null,2)+'\n';
  if(process.argv.includes('--check')) {
    if(readFileSync(output,'utf8')!==content)throw Error('棋谱索引已过期，请执行 node scripts/build-chess-library.mjs');
  }else{mkdirSync(dirname(output),{recursive:true});writeFileSync(output,content);}
  const result=JSON.parse(content);console.log(`${result.games.length} 局，${Object.keys(result.positions).length} 个局面；${result.coverage.indexedArticles}/${result.coverage.totalArticles} 篇文章已收录`);
}
