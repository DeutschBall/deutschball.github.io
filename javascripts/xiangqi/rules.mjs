/** Board indices run from a9 (0) to i0 (89), independent of display orientation. */
export const START = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
export const names = { K:'帅', A:'仕', B:'相', N:'马', R:'车', C:'炮', P:'兵', k:'将', a:'士', b:'象', n:'马', r:'车', c:'炮', p:'卒' };
export const side = p => p ? (p === p.toUpperCase() ? 'w' : 'b') : null;
export const opposite = s => s === 'w' ? 'b' : 'w';
export const coord = i => String.fromCharCode(97 + i % 9) + (9 - Math.floor(i / 9));
export const index = s => /^[a-i][0-9]$/.test(s) ? (9 - Number(s[1])) * 9 + s.charCodeAt(0) - 97 : -1;
const palace = (x,y,s) => x >= 3 && x <= 5 && (s === 'w' ? y >= 7 && y <= 9 : y >= 0 && y <= 2);
const elephants = new Set(['2,0','6,0','0,2','4,2','8,2','2,4','6,4']);
const advisors = new Set(['3,0','5,0','4,1','3,2','5,2']);

export function parseFen(input) {
  const f = input.trim().split(/\s+/);
  if (![2,6].includes(f.length) || !/^[wb]$/.test(f[1])) throw Error('FEN 需包含十行棋盘及行棋方 w（红）或 b（黑）。');
  if (f.length === 6 && (f[2] !== '-' || f[3] !== '-' || !/^\d+$/.test(f[4]) || !/^[1-9]\d*$/.test(f[5]) || !Number.isSafeInteger(+f[4]) || !Number.isSafeInteger(+f[5]))) throw Error('FEN 计数或占位字段无效。');
  const rows = f[0].split('/'), board = [];
  if (rows.length !== 10) throw Error('棋盘必须有十行。');
  for (const row of rows) {
    const cells = [];
    for (let c of row) {
      if (/^[1-9]$/.test(c)) cells.push(...Array(+c).fill(null));
      else {
        c = ({h:'n',H:'N',e:'b',E:'B'})[c] || c;
        if (!names[c]) throw Error('FEN 包含未知棋子。');
        cells.push(c);
      }
    }
    if (cells.length !== 9) throw Error('棋盘每行必须有九个位置。');
    board.push(...cells);
  }
  const counts = {};
  board.forEach((p,i) => {
    if (!p) return;
    counts[p] = (counts[p] || 0) + 1;
    const s = side(p), t = p.toLowerCase(), x = i % 9, y = Math.floor(i/9), homeY = s === 'b' ? y : 9-y;
    if (t === 'k' && !palace(x,y,s)) throw Error('将帅必须位于九宫。');
    if (t === 'a' && !advisors.has(`${x},${homeY}`)) throw Error('仕士位置无效。');
    if (t === 'b' && !elephants.has(`${x},${homeY}`)) throw Error('相象位置无效。');
    if (t === 'p' && (homeY < 3 || (homeY < 5 && x % 2))) throw Error('兵卒位置无效。');
  });
  for (const s of ['w','b']) {
    for (const [type,limit] of Object.entries({k:1,a:2,b:2,n:2,r:2,c:2,p:5})) {
      const key = s === 'w' ? type.toUpperCase() : type;
      if ((counts[key] || 0) > limit || (type === 'k' && counts[key] !== 1)) throw Error('棋子数量无效，双方须各有一枚将帅。');
    }
  }
  const state = {board, turn:f[1], halfmove:+(f[4] || 0), fullmove:+(f[5] || 1)};
  if (inCheck(state, opposite(state.turn))) throw Error('非行棋方处于被将军状态，或将帅照面；请检查行棋方和局面。');
  return state;
}
export function fen(state) {
  const rows = [];
  for (let y=0;y<10;y++) {
    let row='', empty=0;
    for (const p of state.board.slice(y*9,y*9+9)) {
      if (!p) empty++;
      else { if (empty) row+=empty; empty=0; row+=p; }
    }
    if (empty) row+=empty;
    rows.push(row);
  }
  return `${rows.join('/')} ${state.turn} - - ${state.halfmove} ${state.fullmove}`;
}
export function pseudo(board, from, to) {
  const p=board[from], target=board[to];
  if (!p || from===to || to<0 || to>=90 || side(p)===side(target)) return false;
  const x=from%9,y=Math.floor(from/9),tx=to%9,ty=Math.floor(to/9),dx=tx-x,dy=ty-y,ax=Math.abs(dx),ay=Math.abs(dy),s=side(p);
  const type=p.toLowerCase();
  if (type==='n') return ax===2 && ay===1 ? !board[from+Math.sign(dx)] : ax===1 && ay===2 && !board[from+9*Math.sign(dy)];
  if (type==='b') return ax===2 && ay===2 && (s==='w'?ty>=5:ty<=4) && !board[from+dx/2+9*dy/2];
  if (type==='a') return ax===1 && ay===1 && palace(tx,ty,s);
  if (type==='p') return (dx===0 && dy===(s==='w'?-1:1)) || (ay===0 && ax===1 && (s==='w'?y<=4:y>=5));
  if (type==='k' && ax+ay===1 && palace(tx,ty,s)) return true;
  if (dx!==0 && dy!==0) return false;
  const step=dx===0?9*Math.sign(dy):Math.sign(dx);
  let screens=0;
  for(let i=from+step;i!==to;i+=step) if(board[i]) screens++;
  if(type==='r') return screens===0;
  if(type==='c') return screens===(target?1:0);
  return type==='k' && target?.toLowerCase()==='k' && dx===0 && screens===0;
}
export function inCheck(state, who=state.turn) {
  const king=state.board.indexOf(who==='w'?'K':'k');
  return king<0 || state.board.some((p,i)=>side(p)===opposite(who) && pseudo(state.board,i,king));
}
export function legal(state, from, to) {
  if (side(state.board[from])!==state.turn || state.board[to]?.toLowerCase()==='k' || !pseudo(state.board,from,to)) return false;
  const board=state.board.slice(); board[to]=board[from]; board[from]=null;
  return !inCheck({...state,board});
}
export function moves(state, from=null) {
  const result=[];
  for(let i=0;i<90;i++) if ((from===null || i===from) && side(state.board[i])===state.turn)
    for(let j=0;j<90;j++) if(legal(state,i,j)) result.push(coord(i)+coord(j));
  return result;
}
export function play(state, move) {
  if (!/^[a-i][0-9][a-i][0-9]$/.test(move)) throw Error('着法坐标无效。');
  const from=index(move.slice(0,2)),to=index(move.slice(2));
  if (!legal(state,from,to)) throw Error('这步棋不合法，请重新选择。');
  const board=state.board.slice(),p=board[from],capture=!!board[to]; board[to]=p; board[from]=null;
  return {board,turn:opposite(state.turn),halfmove:capture||p.toLowerCase()==='p'?0:state.halfmove+1,fullmove:state.fullmove+(state.turn==='b'?1:0)};
}
export function notation(state, move) {
  const from=index(move.slice(0,2)),to=index(move.slice(2)),p=state.board[from];
  if(!p || to<0) return move;
  const red=side(p)==='w',x=from%9,y=Math.floor(from/9),tx=to%9,ty=Math.floor(to/9);
  const number=n=>(red?'〇一二三四五六七八九':'０１２３４５６７８９')[n];
  const file=n=>number(red?9-n:n+1),type=p.toLowerCase();
  let prefix=names[p]+file(x);
  let peers=state.board.map((q,i)=>q===p&&i%9===x?i:-1).filter(i=>i>=0).sort((a,b)=>red?a-b:b-a);
  if (type==='p') {
    const groups=Array.from({length:9},(_,col)=>state.board.map((q,i)=>q===p&&i%9===col?i:-1).filter(i=>i>=0)).filter(g=>g.length>1);
    if(groups.length>1 && peers.length>1) {
      const all=groups.sort((a,b)=>red?b[0]%9-a[0]%9:a[0]%9-b[0]%9).flatMap(g=>g.sort((a,b)=>red?a-b:b-a));
      prefix='一二三四五'[all.indexOf(from)]+names[p];
    } else if(peers.length>1) prefix=(peers.length===2?'前后':peers.length===3?'前中后':'一二三四五')[peers.indexOf(from)]+names[p];
  } else if(peers.length>1 && !['a','b','k'].includes(type)) prefix=(peers[0]===from?'前':'后')+names[p];
  if(ty===y) return prefix+'平'+file(tx);
  const direction=(red?ty<y:ty>y)?'进':'退';
  return prefix+direction+(['n','b','a'].includes(type)?file(tx):number(Math.abs(ty-y)));
}
