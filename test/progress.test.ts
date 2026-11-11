import { describe, it, expect } from 'vitest';
import { chapterIndexOf, progressOf, byRecentRead, readingProgress } from '../src/core/progress';
import type { Chapter } from '../src/core/model';

const ch = (n: number, texts: string[]): Chapter => ({ id: `c${n}`, title: `${n + 1}화`, charCount: texts.join('').replace(/\s/g, '').length, blocks: texts.map(text => ({ type: 'p' as const, text })) });

describe('읽기 진행 표시(서재)', () => {
  it('회차 id → 번호, 범위를 벗어나거나 형식이 다르면 null', () => {
    expect(chapterIndexOf('c0')).toBe(0); expect(chapterIndexOf('c12')).toBe(12); expect(chapterIndexOf('x1')).toBeNull();
    expect(progressOf({ chapterId: 'c9', updatedAt: 1, progress: .5 }, 5)).toBeNull(); expect(progressOf(undefined, 5)).toBeNull(); expect(progressOf({ chapterId: 'c0', updatedAt: 1 }, 0)).toBeNull();
  });
  it('저장된 진행률(0~1)을 그대로 쓰고 문구는 회차 수에 따라 다르다', () => {
    expect(progressOf({ chapterId: 'c2', updatedAt: 1, progress: 0.25 }, 12)).toMatchObject({ ratio: 0.25, label: '3회차 읽는 중 (25%)', done: false });
    expect(progressOf({ chapterId: 'c0', updatedAt: 1, progress: 0.4 }, 1)).toMatchObject({ ratio: 0.4, label: '40% 읽는 중' });          // 1회차 단편
    expect(progressOf({ chapterId: 'c11', updatedAt: 1, progress: 1 }, 12)).toMatchObject({ done: true, label: '다 읽음' });
  });
  it('버그 재현: 1회차 단편을 열기만 하면(진행 0) 100%가 아니라 표시하지 않는다', () => {
    expect(progressOf({ chapterId: 'c0', updatedAt: 1, progress: 0 }, 1)).toBeNull();
    expect(progressOf({ chapterId: 'c0', updatedAt: 1 }, 1)).toBeNull();                       // 진행값 없는 옛 기록도 마찬가지
  });
  it('진행값이 없는 옛 기록은 앞선 회차까지만 읽은 것으로 계산(마지막 회차를 열어도 100% 아님)', () => {
    expect(progressOf({ chapterId: 'c3', updatedAt: 1 }, 4)).toMatchObject({ ratio: 0.75, done: false });
    expect(progressOf({ chapterId: 'c0', updatedAt: 1 }, 4)).toBeNull();
  });
  it('최근에 읽은 순으로 정렬하고, 안 읽은 것은 원래 순서 유지', () => {
    const st = new Map([['b', { chapterId: 'c0', updatedAt: 20 }], ['c', { chapterId: 'c0', updatedAt: 10 }]]);
    expect(byRecentRead([{ id: 'a' }, { id: 'c' }, { id: 'b' }, { id: 'd' }], st).map(x => x.id)).toEqual(['b', 'c', 'a', 'd']);
  });
});

describe('읽는 위치 → 진행률(저장할 값)', () => {
  const chapters = [ch(0, ['가나다라마', '바사아자차']), ch(1, ['카타파하', '가나'])];     // 10자 + 6자 = 16자
  it('처음에는 0, 회차 안에서는 앞선 글자 수 비율', () => {
    expect(readingProgress(chapters, 0, 0)).toBe(0);
    expect(readingProgress(chapters, 0, 1)).toBeCloseTo(5 / 16);
    expect(readingProgress(chapters, 1, 0)).toBeCloseTo(10 / 16);
    expect(readingProgress(chapters, 1, 1)).toBeCloseTo(14 / 16);
  });
  it('1회차 단편: 열기만 하면 0, 중간 위치는 중간 값(100%가 아님)', () => {
    const one = [ch(0, ['a'.repeat(100), 'b'.repeat(100), 'c'.repeat(100)])];
    expect(readingProgress(one, 0, 0)).toBe(0); expect(readingProgress(one, 0, 1)).toBeCloseTo(1 / 3); expect(readingProgress(one, 0, 2)).toBeCloseTo(2 / 3);
  });
  it('범위를 벗어난 값·빈 원고에도 0~1 안에 머문다', () => {
    expect(readingProgress(chapters, 1, 99)).toBe(1); expect(readingProgress([], 0, 0)).toBe(0); expect(readingProgress(chapters, 9, 0)).toBeLessThanOrEqual(1);
  });
});
