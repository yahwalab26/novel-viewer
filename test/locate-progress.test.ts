import { describe, it, expect } from 'vitest';
import { locateProgress, readingProgress } from '../src/core/progress';
import type { Chapter } from '../src/core/model';

const p = (t: string) => ({ type: 'p' as const, text: t });
const mk = (id: string, texts: string[]): Chapter => ({ id, title: id, charCount: texts.join('').replace(/\s/g, '').length, blocks: texts.map(p) } as Chapter);
const book = [mk('c0', ['aaaaaaaaaa', 'bbbbbbbbbb']), mk('c1', ['cccccccccc', 'dddddddddd', 'eeeeeeeeee']), mk('c2', ['ffffffffff'])];   // 글자 20 / 30 / 10 = 60

describe('locateProgress (슬라이더 위치 → 회차·문단)', () => {
  it('처음·끝', () => {
    expect(locateProgress(book, 0)).toEqual({ ci: 0, blockIndex: 0 });
    expect(locateProgress(book, 1)).toEqual({ ci: 2, blockIndex: 0 });
  });
  it('중간 위치가 알맞은 회차·문단으로 간다', () => {
    expect(locateProgress(book, 0.25)).toEqual({ ci: 0, blockIndex: 1 });   // 15자째 = 0회차 두 번째 문단
    expect(locateProgress(book, 0.5)).toEqual({ ci: 1, blockIndex: 0 });    // 30자째 = 1회차 첫 문단
    expect(locateProgress(book, 0.75)).toEqual({ ci: 1, blockIndex: 2 });   // 45자째 = 1회차 세 번째 문단
  });
  it('readingProgress 와 왕복해도 같은 회차를 가리키고, 진행률은 줄어들지 않는다', () => {
    for (const f of [0.1, 0.34, 0.5, 0.66, 0.9]) {
      const { ci, blockIndex } = locateProgress(book, f); const back = readingProgress(book, ci, blockIndex);
      expect(back).toBeLessThanOrEqual(f + 1e-9); expect(f - back).toBeLessThan(0.34);
    }
  });
  it('빈 책은 0번', () => { expect(locateProgress([], 0.5)).toEqual({ ci: 0, blockIndex: 0 }); });
});
