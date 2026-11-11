// 로컬 저장소(IndexedDB). 서버 단계에서 같은 인터페이스의 RemoteRepository로 교체한다.
import { get, set, del, keys } from 'idb-keyval';
import { migrateSettings } from '../core/settings';
import type { Annotation, Book, BookSummary, LibraryRepository, ReadingState, Bookmark } from '../core/model';

export const localRepo: LibraryRepository = {
  async saveBook(b: Book, source: Blob) {
    const { chapters, ...m } = b;
    const sum: BookSummary = { ...m, chapterCount: chapters.length, charCount: chapters.reduce((n, c) => n + c.charCount, 0) };
    await set('book:' + b.id, b); await set('meta:' + b.id, sum); await set('src:' + b.id, source);
  },
  async listBooks() {
    const ks = (await keys()).filter(k => String(k).startsWith('meta:'));
    return ((await Promise.all(ks.map(k => get(k)))) as BookSummary[]).sort((a, b) => b.addedAt - a.addedAt);
  },
  async getBook(id) { return ((await get('book:' + id)) as Book) ?? null; },
  async deleteBook(id) { await Promise.all(['book:', 'meta:', 'src:', 'state:', 'ann:', 'bm:'].map(p => del(p + id))); },
  async getState(id) { return ((await get('state:' + id)) as ReadingState) ?? null; },
  async saveState(s) { await set('state:' + s.bookId, s); },
  async listBookmarks(id) { return ((await get('bm:' + id)) as Bookmark[]) ?? []; },
  async deleteBookmark(bookId, id) { const l = await this.listBookmarks(bookId); await set('bm:' + bookId, l.filter(x => x.id !== id)); },
  async listAnnotations(id) { return ((await get('ann:' + id)) as Annotation[]) ?? []; },
  async saveAnnotation(a) { const l = await this.listAnnotations(a.bookId); await set('ann:' + a.bookId, [...l.filter(x => x.id !== a.id), a]); },
  async deleteAnnotation(bookId, id) { const l = await this.listAnnotations(bookId); await set('ann:' + bookId, l.filter(x => x.id !== id)); },
  async saveBookmark(b) { const l = await this.listBookmarks(b.bookId); await set('bm:' + b.bookId, [...l.filter(x => x.id !== b.id), b]); },
};
export const loadSettings = (def: any) => { try { return { ...def, ...migrateSettings(JSON.parse(localStorage.getItem('nv.settings') || '{}')) }; } catch { return def; } };
export const persistSettings = (s: unknown) => { try { localStorage.setItem('nv.settings', JSON.stringify(s)); } catch {} };
