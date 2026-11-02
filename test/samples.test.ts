import { it, expect } from 'vitest';
import fs from 'fs';
import { parseFile } from '../src/parsers';
const load = (n: string) => ({ name: n, arrayBuffer: async () => { const b = fs.readFileSync('samples/' + n); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; } });
it('샘플 DOCX/EPUB이 3회차로 읽힌다', async () => {
  for (const n of ['샘플원고.docx', '샘플작품.epub']) {
    const b = await parseFile(load(n));
    expect(b.chapters.map(c => c.title)).toEqual(['1화 첫 만남', '2화 어긋난 약속', '3화 비 오는 밤']);
    expect(b.chapters[0].blocks.some(x => x.type === 'scene')).toBe(true);
  }
});
