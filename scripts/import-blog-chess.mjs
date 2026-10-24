/** Conservative full-site import: only numbered, legally replayable, source-backed lines. */
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {START,parseFen,play} from '../docs/javascripts/xiangqi/rules.mjs';
import {parseMoveRow,convertRows} from './build-chess-library.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),docs=resolve(root,'docs');
const manifest=resolve(root,'data/chess/games.json');
const reviewed=JSON.parse(readFileSync(manifest,'utf8')).filter(g=>g.importMethod!=='numbered-source');
const covered=new Set(reviewed.map(g=>g.source)),generated=[],audit=[];
const paths=[];
function scan(dir){for(const f of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,f.name);if(f.isDirectory())scan(p);else if(f.name.endsWith('.md')&&!['index.md','tags.md'].includes(f.name))paths.push(p);}}
scan(docs);paths.sort();
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
function prefixRows(rows,count) {
 const result=[];let left=count;
 for(const row of rows){if(!left)break;const length=row.take??parseMoveRow(row.text).tokens.length;const take=Math.min(left,length);result.push(take<length?{...row,take}:row);left-=take;}
 return result;
}
function samePrefix(a,b){return a.every((m,i)=>m===b[i]);}
for(const filename of paths) {
 const source=relative(docs,filename),text=readFileSync(filename,'utf8'),lines=text.split(/\r?\n/);
 const entry={source,sourceHash:hash(text),status:'pending',games:0,acceptedRows:[],issues:[]};audit.push(entry);
 if(covered.has(source)){entry.status='reviewed';entry.games=reviewed.filter(g=>g.source===source).length;continue;}
 const monthly=/复盘-\d{4}\.\d+\.md$/.test(source);
 let headings=[],callouts=[],quoteId=null,groups=[],group;
 const newGroup=title=>{const g={title,ordinal:groups.length,paths:[],contexts:new Map(),primary:null,main:null};groups.push(g);return g;};
 group=newGroup(filename.split('/').at(-1).replace(/\.md$/,''));
 let inFrontMatter=false;
 for(let i=0;i<lines.length;i++) {
  const raw=lines[i],n=i+1,expanded=raw.replace(/\t/g,'    '),trim=raw.trim();
  if(i===0&&trim==='---'){inFrontMatter=true;continue;}if(inFrontMatter){if(trim==='---')inFrontMatter=false;continue;}
  if(!trim)continue;
  const indent=expanded.match(/^ */)[0].length,quoted=/^\s*>/.test(raw);
  const heading=trim.match(/^(#{1,6})\s+(.+)$/);
  if(heading){const level=heading[1].length;headings=headings.filter(h=>h.level<level);headings.push({level,id:`h${n}`,title:heading[2]});callouts=[];quoteId=null;
   if(monthly&&level===2)group=newGroup(heading[2]);continue;}
  while(callouts.length&&callouts.at(-1).indent>=indent)callouts.pop();
  if(/^\?\?\?[+]?\s/.test(trim)){callouts.push({indent,id:`a${n}`,title:trim});continue;}
  if(quoted){quoteId??=`q${n}`;}else quoteId=null;
  let parsed;
  try{parsed=parseMoveRow(raw);}catch(e){entry.issues.push({line:n,text:trim,reason:e.message});continue;}
  if(!parsed)continue;
  const scope=[...headings.map(h=>h.id),...callouts.map(c=>c.id),...(quoteId?[quoteId]:[])];
  const key=scope.join('/'),target=(parsed.round-1)*2+(parsed.turn==='b'?1:0);
  let parent;
  for(let len=scope.length;len>=0;len--){parent=group.contexts.get(scope.slice(0,len).join('/'));if(parent)break;}
  // An explicit new opening needs no inferred position; other lines require a documented prefix.
  if(target>0&&(!parent||parent.moves.length<target)) {
   entry.issues.push({line:n,text:trim,reason:`缺少第 ${target} 手之前的连续来源，未补棋`});continue;
  }
  const prefix=target?parent.moves.slice(0,target):[],rows=target?prefixRows(parent.rows,target):[];
  let state=prefix.reduce((s,m)=>play(s,m),parseFen(START));
  const row={line:n,text:trim};let converted;
  try{converted=convertRows(lines,[row],state).converted;}catch(e){entry.issues.push({line:n,text:trim,reason:e.message});group.contexts.set(key,{moves:prefix,rows});continue;}
  const path={moves:[...prefix,...converted.map(m=>m.move)],rows:[...rows,row],scope:key,line:n,title:callouts.at(-1)?.title||headings.at(-1)?.title||'分析变着'};
  group.contexts.set(key,path);group.paths.push(path);entry.acceptedRows.push(n);
  if(group.primary===null&&target===0)group.primary=key;
  if(group.primary===key)group.main=path;
 }
 for(const g of groups) {
  if(!g.paths.length)continue;
  const main=g.main||g.paths[0];
  const unique=g.paths.filter((p,i,all)=>!all.some((other,j)=>j!==i&&other.moves.length>=p.moves.length&&samePrefix(p.moves,other.moves)&&(other.moves.length>p.moves.length||j<i)));
  const id='blog-'+hash(source+'#'+g.title+'#'+g.ordinal);
  const variations=[];
  for(const path of unique) {
   if(samePrefix(path.moves,main.moves))continue;
   let common=0;while(common<path.moves.length&&common<main.moves.length&&path.moves[common]===main.moves[common])common++;
   // A split inside a two-ply source row must retain that row's red move too.
   let fork=common,consumed=0;
   for(const row of path.rows){const len=row.take??parseMoveRow(row.text).tokens.length;if(consumed+len>common){fork=consumed;break;}consumed+=len;}
   const prefixCount=prefixRows(path.rows,fork).length;
   variations.push({id:`line-${path.line}`,title:`${path.title.replace(/^\?\?\?[+]?\s+\S+\s*/, '').replace(/^"|"$/g,'')} · L${path.line}（分析变着）`,fromPly:fork,branchPly:common,rows:path.rows.slice(prefixCount)});
  }
  generated.push({id,title:monthly?`${filename.split('/').at(-1).replace(/\.md$/,'')} · ${g.title}`:g.title,source,date:text.match(/^date:\s*(\d{4}-\d\d-\d\d)/m)?.[1]||null,kind:'article-mainline',completeness:'fragment',provenance:'按原文编号、层级与合法走法转换；缺失或歧义处已停止，详见导入审计。',importMethod:'numbered-source',mainline:main.rows,variations});entry.games++;
 }
 entry.status=entry.games?(entry.issues.length?'partial':'converted'):'needs-source';
 if(!entry.games&&!entry.issues.length)entry.issues.push({reason:'未发现可从初始局面连续还原的编号棋谱；可能为图片、文字讲解或链接汇总。'});
}
writeFileSync(manifest,JSON.stringify([...reviewed,...generated],null,2)+'\n');
writeFileSync(resolve(root,'data/chess/import-audit.json'),JSON.stringify({articles:audit},null,2)+'\n');
const statusLabels={reviewed:'已核对样例',converted:'编号着法转换完成',partial:'已收录连续片段，部分待核对','needs-source':'缺少可还原棋谱'};
let report='# 博客棋谱全站导入报告\n\n所有内容文章均已扫描。收录依据为编号、文档层级和合法走法；未从图片或散文猜测补棋。主线片段不代表完整实战。文章内可回放前缀已保留，失败行及依赖其后续的行不进入索引。\n\n| 文章 | 状态 | 记录数 | 待核对行/项 |\n| --- | --- | ---: | ---: |\n';
for(const e of audit)report+=`| ${e.source} | ${statusLabels[e.status]} | ${e.games} | ${e.issues.length} |\n`;
for(const e of audit.filter(e=>e.issues.length)){report+=`\n## ${e.source}\n\n`;for(const issue of e.issues)report+=`- ${issue.line?'第 '+issue.line+' 行：':''}${issue.text||''} — ${issue.reason}\n`;}
writeFileSync(resolve(root,'CHESS_IMPORT_REPORT.md'),report);

console.log(JSON.stringify({articles:audit.length,indexed:audit.filter(a=>a.games).length,games:reviewed.length+generated.length,issues:audit.reduce((n,a)=>n+a.issues.length,0)}));
for(const e of audit)console.log(e.status,e.games,e.acceptedRows.length,e.issues.length,e.source);
