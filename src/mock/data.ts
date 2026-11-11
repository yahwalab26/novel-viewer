// 개발 전용 가짜 데이터(모두 지어낸 내용). 서버 없이 화면 모양을 확인할 때만 쓴다.
import type { Book } from '../core/model';
import type { BookRow } from '../server/books';

const row = (o: Partial<BookRow> & Pick<BookRow, 'id' | 'title'>): BookRow => ({ author_name: null, format: 'hwpx', chapter_count: 12, char_count: 40000, current_revision: 1, created_at: '2026-01-01T00:00:00Z', assignments: [], ...o });
export const mockBooks: BookRow[] = [
  row({ id: 'b1', title: '달빛 아래서', author_name: '이서연', format: 'hwpx', chapter_count: 24, char_count: 98400, assignments: [{ author_id: 'a1', enabled: true }, { author_id: 'a2', enabled: true }] }),
  row({ id: 'b2', title: '겨울 편지', author_name: '박민준', format: 'docx', chapter_count: 12, char_count: 41250, current_revision: 2, assignments: [{ author_id: 'a1', enabled: false }] }),
  row({ id: 'b3', title: '유리 정원의 밤', author_name: '이서연', format: 'epub', chapter_count: 36, char_count: 152300 }),
  row({ id: 'b4', title: '서랍 속의 계절과 아주 긴 제목이 두 줄로 넘어갈 때의 모습', format: 'hwp', chapter_count: 8, char_count: 22800 }),
];
export const mockStates = [
  { bookId: 'b3', chapterId: 'c34', blockIndex: 0, updatedAt: Date.parse('2026-03-02T10:00:00Z'), progress: 0.96 },
  { bookId: 'b1', chapterId: 'c7', blockIndex: 0, updatedAt: Date.parse('2026-03-01T10:00:00Z'), progress: 0.33 },
];
export const mockAuthors = [{ id: 'a1', name: '이서연', email: 'seoyeon@example.com' }, { id: 'a2', name: '박민준', email: 'minjun@example.com' }];
const p = (text: string) => ({ type: 'p' as const, text });
export const mockBook = (id: string): Book => ({
  id, title: mockBooks.find(b => b.id === id)?.title ?? '샘플', format: 'hwpx', parserVersion: 1, addedAt: 0,
  chapters: [1, 2, 3].map(n => ({ id: `c${n - 1}`, title: `${n}화`, charCount: 300, blocks: [
    p('비가 그친 골목에는 젖은 흙냄새가 남아 있었다.'), p('“늦었네. 오래 기다렸는데.”'), p('수호는 대답 대신 우산을 접어 문 옆에 세워 두었다. 창밖으로 가로등이 하나둘 켜지기 시작했다.'),
    { type: 'scene' as const }, p('찻잔에서 올라온 김이 둘 사이에서 천천히 흩어졌다.'), p('“괜찮아. 이야기는 천천히 해도 되니까.”')] })),
});
