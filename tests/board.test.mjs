import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('MkDocs plugin recognizes both FEN syntaxes, SVG coordinates, nesting and invalid input',()=>{
  const result=spawnSync(process.env.PYTHON||(process.platform==='win32'?'python':'python3'),
    ['-m','unittest','discover','-s','tests','-p','test_xiangqi_board.py','-v'],
    {cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'}});
  assert.equal(result.status,0,result.error?.message||result.stderr||result.stdout);
});
