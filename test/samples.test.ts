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

it('샘플 HWPX: spine 순서, "작품명 – 01" 회차 분할, 장면구분, 표/줄바꿈, 메타', async () => {
  const b = await parseFile(load('샘플원고.hwpx'));
  expect(b.title).toBe('샘플 HWPX 작품'); expect(b.author).toBe('테스트 작가');
  expect(b.chapters.map(c => c.title)).toEqual(['샘플 작품 – 01', '샘플 작품 – 02', '샘플 작품 – 03']);
  const all = b.chapters.flatMap(c => c.blocks);
  expect(all.some(x => x.type === 'scene')).toBe(true);
  expect(all.some(x => x.type === 'p' && x.text === '표 안의 문단')).toBe(true);
  expect(all.some(x => x.type === 'p' && x.text === '줄바꿈\n테스트')).toBe(true);
  expect(b.chapters.every(c => c.charCount > 100)).toBe(true);
});
