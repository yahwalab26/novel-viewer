import { it, expect } from 'vitest';
import { resolve, segments } from '../src/viewer/anchor';
import type { Annotation } from '../src/core/model';
const A = (o: Partial<Annotation>): Annotation => ({ id: 'a', bookId: 'b', authorId: 'u', chapterId: 'c0', blockIndex: 0, start: 0, end: 0, quote: '', color: 'yellow', createdAt: 1, updatedAt: 1, ...o });
it('위치가 맞으면 그대로, 원고가 개정되면 quote로 재탐색, 없으면 null', () => {
  const a = A({ start: 2, end: 4, quote: '다라' });
  expect(resolve('가나다라마', a)).toEqual([2, 4]);
  const t2 = '새로 추가된 가나다라마'; const i = t2.indexOf('다라');
  expect(resolve(t2, a)).toEqual([i, i + 2]);
  expect(resolve('전혀 다른 문장', a)).toBeNull();
});
it('겹치는 형광펜은 나중 것이 위, 텍스트는 보존', () => {
  const segs = segments('가나다라마바', [A({ id: '1', start: 1, end: 4, quote: '나다라', createdAt: 1 }), A({ id: '2', start: 3, end: 5, quote: '라마', color: 'pink', createdAt: 2 })]);
  expect(segs.map(s => s.text).join('')).toBe('가나다라마바');
  expect(segs.map(s => s.ann?.id)).toEqual([undefined, '1', '2', undefined]);
});
