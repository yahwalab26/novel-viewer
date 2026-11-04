import type { Book } from './model';

export interface Hit { ci: number; bi: number; before: string; match: string; after: string }
export interface SearchResult { hits: Hit[]; total: number; truncated: boolean }

/** 본문 전체 검색(대소문자 무시). 한 문단에 여러 번 나오면 각각 결과로 센다. */
export function searchBook(book: Book, query: string, opts: { limit?: number; context?: number } = {}): SearchResult {
  const q = query.trim().toLowerCase(), limit = opts.limit ?? 200, ctx = opts.context ?? 22;
  if (!q) return { hits: [], total: 0, truncated: false };
  const hits: Hit[] = []; let total = 0;
  book.chapters.forEach((c, ci) => c.blocks.forEach((b, bi) => {
    if (b.type !== 'p' && b.type !== 'h') return;
    const text = b.text, low = text.toLowerCase();
    for (let i = low.indexOf(q); i >= 0; i = low.indexOf(q, i + q.length)) {
      total++;
      if (hits.length < limit) hits.push({ ci, bi, before: (i > ctx ? '…' : '') + text.slice(Math.max(0, i - ctx), i), match: text.slice(i, i + q.length), after: text.slice(i + q.length, i + q.length + ctx) + (i + q.length + ctx < text.length ? '…' : '') });
    }
  }));
  return { hits, total, truncated: total > hits.length };
}

/** 서재 목록 검색: 제목·작가명에 검색어가 들어 있는 항목만 */
export function filterBooks<T>(list: T[], query: string, fields: (b: T) => (string | null | undefined)[]): T[] {
  const q = query.trim().toLowerCase();
  return q ? list.filter(b => fields(b).some(f => (f ?? '').toLowerCase().includes(q))) : list;
}
