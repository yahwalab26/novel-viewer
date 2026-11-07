import { describe, it, expect } from 'vitest';
import { searchBook, filterBooks } from '../src/core/search';
import type { Book } from '../src/core/model';

const book: Book = { id: 'b', title: 't', format: 'docx', parserVersion: 1, addedAt: 0, chapters: [
  { id: 'c0', title: '1화', charCount: 0, blocks: [{ type: 'p', text: '수호는 문을 열었다. 수호는 말이 없었다.' }, { type: 'scene' }, { type: 'p', text: 'Hello hello HELLO' }] },
  { id: 'c1', title: '2화', charCount: 0, blocks: [{ type: 'h', text: '수호의 밤' }, { type: 'p', text: '아무 일도 없었다' }] },
] };

describe('본문 검색', () => {
  it('문단 안 여러 번·여러 회차의 위치(회차/문단)와 앞뒤 문맥을 돌려준다', () => {
    const r = searchBook(book, '수호');
    expect(r.total).toBe(3); expect(r.hits.map(h => [h.ci, h.bi])).toEqual([[0, 0], [0, 0], [1, 0]]);
    expect(r.hits[0]).toMatchObject({ before: '', match: '수호', after: '는 문을 열었다. 수호는 말이 없었다.' });
    expect(r.hits[1].before).toBe('수호는 문을 열었다. ');                       // 앞이 짧으면 말줄임 없이 그대로
    const long = searchBook({ ...book, chapters: [{ id: 'c', title: '', charCount: 0, blocks: [{ type: 'p', text: '가'.repeat(40) + '찾기' + '나'.repeat(40) }] }] }, '찾기');
    expect(long.hits[0].before.startsWith('…')).toBe(true); expect(long.hits[0].after.endsWith('…')).toBe(true);   // 길면 말줄임
  });
  it('대소문자 무시, 장면구분 블록은 건너뜀, 검색어 없으면 빈 결과', () => {
    expect(searchBook(book, 'hello').total).toBe(3);
    expect(searchBook(book, '  ').hits).toEqual([]);
    expect(searchBook(book, '없는말').total).toBe(0);
  });
  it('결과가 많으면 limit까지만 담고 truncated 표시, total 은 전체', () => {
    const r = searchBook(book, '수호', { limit: 2 }); expect(r.hits).toHaveLength(2); expect(r.total).toBe(3); expect(r.truncated).toBe(true);
  });
  it('서재 검색은 제목·작가명 부분 일치', () => {
    const list = [{ t: '달빛 아래서', a: '김작가' }, { t: '달의 정원', a: null }, { t: 'Moon', a: '박작가' }];
    expect(filterBooks(list, '정원', b => [b.t, b.a])).toHaveLength(1);
    expect(filterBooks(list, '작가', b => [b.t, b.a]).map(b => b.t)).toEqual(['달빛 아래서', 'Moon']);
    expect(filterBooks(list, 'moon', b => [b.t, b.a])).toHaveLength(1);
    expect(filterBooks(list, '', b => [b.t, b.a])).toHaveLength(3);
  });
});
