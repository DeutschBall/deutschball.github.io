import {parseFen,fen,play} from './rules.mjs';
/** Compare exact position and side to move; clocks, history and orientation are irrelevant. */
export function positionKey(state) { return fen(typeof state==='string'?parseFen(state):state).split(' ').slice(0,2).join(' '); }
export function createIndex(games) {
  const positions=Object.create(null), ids=new Set();
  for(const game of games) {
    if(ids.has(game.id))throw Error(`重复棋局 ID：${game.id}`);ids.add(game.id);
    for(const line of game.lines) {
      let state=parseFen(game.startFen);
      const visit=ply=>{
        const key=positionKey(state);positions[key]??=[];
        // A game/line may revisit a position: keep all plies but only one index entry.
        let hit=positions[key].find(h=>h.gameId===game.id&&h.lineId===line.id);
        if(!hit){hit={gameId:game.id,lineId:line.id,kind:line.kind,plies:[]};positions[key].push(hit);}
        hit.plies.push(ply);
      };
      // Variations include a mainline prefix for replay, but index only positions after the fork.
      if(line.kind==='mainline')visit(0);
      line.moves.forEach((move,i)=>{state=play(state,move);if(line.kind==='mainline'||i+1>line.fromPly)visit(i+1);});
    }
  }
  return positions;
}
export function lookup(library,state) {
  const hits=library.positions[positionKey(state)]||[];
  return {hits,mainlineCount:new Set(hits.filter(h=>h.kind==='mainline').map(h=>h.gameId)).size,
    variationCount:new Set(hits.filter(h=>h.kind==='variation').map(h=>`${h.gameId}:${h.lineId}`)).size};
}
export function replay(game,lineId) {
  const line=game.lines.find(l=>l.id===lineId);if(!line)throw Error('棋谱分支不存在');
  const states=[parseFen(game.startFen)];for(const move of line.moves)states.push(play(states.at(-1),move));
  return {line,states};
}
