import { describe, it, expect } from 'vitest';
import { chapterIndexOf, progressOf, byRecentRead } from '../src/core/progress';

describe('읽기 진행', () => {
  it('회차 id → 번호, 범위를 벗어나거나 형식이 다르면 null', () => {
    expect(chapterIndexOf('c0')).toBe(0); expect(chapterIndexOf('c12')).toBe(12); expect(chapterIndexOf('x1')).toBeNull(); expect(chapterIndexOf('c')).toBeNull();
    expect(progressOf({ chapterId: 'c9', updatedAt: 1 }, 5)).toBeNull(); expect(progressOf(undefined, 5)).toBeNull(); expect(progressOf({ chapterId: 'c0', updatedAt: 1 }, 0)).toBeNull();
  });
  it('진행률은 (읽는 회차 번호 / 전체 회차), 라벨은 사람이 읽는 번호', () => {
    expect(progressOf({ chapterId: 'c0', updatedAt: 1 }, 4)).toEqual({ index: 0, ratio: 0.25, label: '1회차 읽는 중' });
    expect(progressOf({ chapterId: 'c3', updatedAt: 1 }, 4)).toMatchObject({ ratio: 1, label: '4회차 읽는 중' });
  });
  it('최근에 읽은 순으로 정렬하고, 안 읽은 것은 원래 순서 유지', () => {
    const st = new Map([['b', { chapterId: 'c0', updatedAt: 20 }], ['c', { chapterId: 'c0', updatedAt: 10 }]]);
    expect(byRecentRead([{ id: 'a' }, { id: 'c' }, { id: 'b' }, { id: 'd' }], st).map(x => x.id)).toEqual(['b', 'c', 'a', 'd']);
  });
});
