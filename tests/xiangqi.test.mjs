import test from 'node:test';
import assert from 'node:assert/strict';
import {START,parseFen,fen,index,coord,pseudo,legal,inCheck,moves,play,notation} from '../docs/javascripts/xiangqi/rules.mjs';
import {Cloud,parseResponse} from '../docs/javascripts/xiangqi/cloud.mjs';
const start=()=>parseFen(START);
function position(pieces,turn='w') {const board=Array(90).fill(null);for(const [c,p] of Object.entries(pieces))board[index(c)]=p;return {board,turn,halfmove:0,fullmove:1};}
test('initial legal move counts (perft 1–3)',()=>{
 const perft=(s,d)=>d===0?1:moves(s).reduce((n,m)=>n+perft(play(s,m),d-1),0);
 assert.equal(perft(start(),1),44);assert.equal(perft(start(),2),1920);assert.equal(perft(start(),3),79666);
});
test('FEN roundtrip, aliases, counters and malformed positions',()=>{
 assert.equal(fen(start()),START);assert.equal(fen(parseFen(START.replaceAll('n','h').replaceAll('N','H'))),START);
 const next=play(play(start(),'h2e2'),'h7e7');assert.equal(fen(parseFen(fen(next))),fen(next));assert.equal(next.fullmove,2);
 for(const input of ['',START.replace(' w ',' x '),START.replace('rnbakabnr','9'),START.replace(' 0 1',' -1 1'),START.replace(' 0 1',' 0 0'),'4k4/9/9/9/9/9/9/9/9/4K4 w'])assert.throws(()=>parseFen(input));
});
test('coordinates and Chinese notation',()=>{
 for(let i=0;i<90;i++)assert.equal(index(coord(i)),i);
 assert.equal(notation(start(),'h2e2'),'炮二平五');assert.equal(notation(play(start(),'h2e2'),'h7e7'),'炮８平５');
 assert.equal(notation(start(),'h0g2'),'马二进三');
});
test('horse leg and elephant eye/river',()=>{
 let s=position({e0:'K',d9:'k',b0:'N',b1:'P'});assert.equal(pseudo(s.board,index('b0'),index('c2')),false);
 s.board[index('b1')]=null;assert.equal(pseudo(s.board,index('b0'),index('c2')),true);
 s=position({e0:'K',d9:'k',c0:'B',d1:'P'});assert.equal(pseudo(s.board,index('c0'),index('e2')),false);
 s.board[index('d1')]=null;assert.equal(pseudo(s.board,index('c0'),index('e2')),true);
 s=position({c4:'B'});assert.equal(pseudo(s.board,index('c4'),index('e6')),false);
});
test('cannon must use exactly one screen to capture',()=>{
 let s=position({a0:'C',a5:'r'});assert.equal(pseudo(s.board,index('a0'),index('a5')),false);
 s.board[index('a2')]='P';assert.equal(pseudo(s.board,index('a0'),index('a5')),true);
 assert.equal(pseudo(s.board,index('a0'),index('a4')),false);
 s.board[index('a3')]='p';assert.equal(pseudo(s.board,index('a0'),index('a5')),false);
});
test('palace, river and pawn direction',()=>{
 let s=position({e0:'K',d9:'k',d0:'A',a3:'P',c5:'P',i6:'p'});
 assert.equal(pseudo(s.board,index('e0'),index('e1')),true);
 assert.equal(pseudo(s.board,index('d0'),index('c1')),false);
 assert.equal(pseudo(s.board,index('a3'),index('b3')),false);
 assert.equal(pseudo(s.board,index('c5'),index('d5')),true);
 assert.equal(pseudo(s.board,index('c5'),index('c4')),false);
 assert.equal(pseudo(s.board,index('i6'),index('i5')),true);
});
test('flying generals, pins and responding to check',()=>{
 const s=position({e0:'K',e9:'k',e5:'R'});
 assert.equal(legal(s,index('e5'),index('d5')),false);
 assert.equal(legal(s,index('e5'),index('e6')),true);
 const checked=position({e0:'K',d9:'k',e7:'r',a0:'R'});
 assert.equal(inCheck(checked),true);assert.equal(legal(checked,index('a0'),index('a1')),false);
 assert.equal(legal(checked,index('a0'),index('e0')),false);
 assert.equal(legal(checked,index('e0'),index('f0')),true);
});
test('checkmate and stalemate have no legal moves',()=>{
 const mate=position({e0:'K',e9:'k',e1:'r',a0:'r'});
 assert.equal(inCheck(mate),true);assert.equal(moves(mate).length,0);
 const stale=position({e0:'K',d9:'k',d1:'r',f1:'r'});
 assert.equal(inCheck(stale),false);assert.equal(moves(stale).length,0);
});
test('cloud parser strips NUL and preserves unknown scores',()=>{
 const r=parseResponse('queryall','move:h2e2,score:??,rank:0,note:? (??-??)|move:c3c4,score:1,rank:2,winrate:50.08\0');
 assert.equal(r.moves[0].score,null);assert.equal(r.moves[1].score,1);
 assert.deepEqual(parseResponse('querypv','score:1,depth:2,pv:h2e2|h7e7\0').pv,['h2e2','h7e7']);
 for(const s of ['unknown','invalid board','checkmate','stalemate'])assert.equal(parseResponse('queryall',s+'\0').status,s);
 assert.throws(()=>parseResponse('queryall','<html>Error</html>'));
});
test('cloud caches, encodes FEN, disables learning and supports forced refresh',async()=>{
 let calls=0;const cloud=new Cloud(async url=>{calls++;const u=new URL(url);assert.equal(u.searchParams.get('learn'),'0');assert.equal(u.searchParams.get('board'),START.split(' ').slice(0,2).join(' '));return new Response('unknown\0');});
 await cloud.query('queryall',START);await cloud.query('queryall',START);assert.equal(calls,1);
 await cloud.query('queryall',START,undefined,true);assert.equal(calls,2);
});
test('cloud abort, timeout and HTTP errors are recoverable',async()=>{
 const fetcher=(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));
 const cloud=new Cloud(fetcher,10);await assert.rejects(cloud.query('queryall',START));
 const c=new AbortController();c.abort();await assert.rejects(cloud.query('queryall',START,c.signal));
 await assert.rejects(new Cloud(async()=>new Response('',{status:503})).query('queryall',START),/HTTP 503/);
});
