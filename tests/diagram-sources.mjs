import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration = JSON.parse(readFileSync(new URL('../data/chess/diagram-sources.json', import.meta.url)));

export function restoreDiagramSources(source, markdown) {
  const lines = markdown.split(/(\r?\n)/);
  for (const {line, fen, image, headingLine, heading, wrapper, boards} of migration[source] ?? []) {
    const imageIndex = 2 * (line - 1);
    for (const diagram of boards ?? [{line: headingLine ?? line, fen}]) {
      const boardIndex = 2 * (diagram.line - 1);
      assert.match(lines[boardIndex].trim(), /^\?\?\?\+? xiang ".+"$/, `${source}:${diagram.line}`);
      assert.equal(lines[boardIndex].trim().split('"')[1], diagram.fen, `${source}:${diagram.line}`);
    }
    if (headingLine) {
      assert.equal(lines[imageIndex]?.trim() ?? '', '', `${source}:${line}`);
      lines[2 * (headingLine - 1)] = heading;
    }
    while (lines.length <= imageIndex) lines.push(lines.length % 2 ? '\n' : '');
    lines[imageIndex] = image;
    for (const [number, original] of wrapper ?? []) lines[2 * (number - 1)] = original;
  }
  return lines.join('');
}

export function remainingImages({source, images}) {
  const removed = new Map();
  for (const {url} of migration[source] ?? []) removed.set(url, (removed.get(url) ?? 0) + 1);
  return images.filter(url => {
    if (!removed.get(url)) return true;
    removed.set(url, removed.get(url) - 1);
    return false;
  });
}

export async function verifyDiagrams(article, source) {
  const expected = (migration[source] ?? []).flatMap(entry => entry.boards?.map(board => board.fen) ?? [entry.fen]);
  const rendered = await article.locator('details.fen-board').evaluateAll(blocks => blocks.map(block => ({
    fen: block.querySelector(':scope > figure')?.dataset.fen,
    contents: [...block.children].map(child => child.tagName),
  })));
  assert.deepEqual(rendered.map(({fen}) => fen), expected, source);
  for (const {contents} of rendered) assert.deepEqual(contents, ['SUMMARY', 'FIGURE'], source);
}
