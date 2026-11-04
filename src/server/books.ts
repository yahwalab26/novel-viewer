import type { SupabaseClient } from '@supabase/supabase-js';
import type { Annotation, Book, Chapter, Format, ReadingState, AnnotationStore } from '../core/model';

export type Sb = SupabaseClient<any, 'viewer'>;
export const BUCKET = 'viewer-manuscripts';

export interface BookRow { id: string; title: string; author_name: string | null; format: Format; chapter_count: number; char_count: number; current_revision: number; created_at: string; assignments?: { author_id: string; enabled: boolean }[] }
export interface AuthorRow { id: string; name: string; email: string }
export interface AssignRow { author_id: string; enabled: boolean; allow_copy: boolean }

const friendly = (m: string) => /duplicate key|unique constraint/i.test(m) ? '이미 등록된 원고입니다' : /row-level security|permission denied/i.test(m) ? '권한이 없습니다' : /payload too large|too large|413/i.test(m) ? '파일이 너무 큽니다' : m;
function fail(err: { message: string } | null, ctx: string) { if (err) throw new Error(`${ctx}: ${friendly(err.message)}`); }

/** 편집자용 원고 관리. 모든 권한 검사는 서버(RLS)가 하며, 여기서는 순서와 실패 시 정리만 책임진다. */
export function createBooksApi(sb: Sb) {
  const storage = () => sb.storage.from(BUCKET);
  const meta = (b: Book) => ({ chapter_count: b.chapters.length, char_count: b.chapters.reduce((n, c) => n + c.charCount, 0), parser_version: b.parserVersion });
  const cleanup = async (bookId: string, rev: number, format: string, dropBook: boolean) => {
    await storage().remove([`${bookId}/r${rev}.${format}`]).catch(() => {});
    if (dropBook) await sb.from('books').delete().eq('id', bookId); else await sb.from('book_contents').delete().eq('book_id', bookId).eq('revision', rev);
  };
  return {
    async list(): Promise<BookRow[]> {
      const { data, error } = await sb.from('books').select('id,title,author_name,format,chapter_count,char_count,current_revision,created_at,assignments(author_id,enabled)').order('created_at', { ascending: false });
      fail(error, '목록 조회'); return (data ?? []) as BookRow[];
    },
    async get(id: string): Promise<Book> {
      const b = await sb.from('books').select('id,title,author_name,format,parser_version,current_revision,created_at').eq('id', id).single(); fail(b.error, '원고 조회');
      const c = await sb.from('book_contents').select('content').eq('book_id', id).eq('revision', b.data!.current_revision).single(); fail(c.error, '본문 조회');
      return { id, title: b.data!.title, author: b.data!.author_name ?? undefined, format: b.data!.format, parserVersion: b.data!.parser_version, chapters: c.data!.content as Chapter[], addedAt: Date.parse(b.data!.created_at) };
    },
    /** 새 원고 등록: 중복 확인 → 책 → 본문 → 원본 파일. 중간에 실패하면 만든 것을 지운다. */
    async upload(book: Book, file: Blob): Promise<string> {
      const dup = await sb.from('books').select('id,title').eq('file_hash', book.id).maybeSingle();
      if (dup.data) throw new Error(`이미 등록된 원고입니다 (${dup.data.title})`);
      const ins = await sb.from('books').insert({ title: book.title, author_name: book.author ?? null, format: book.format, file_hash: book.id, ...meta(book) }).select('id').single();
      fail(ins.error, '원고 등록'); const id = ins.data!.id as string;
      try {
        fail((await sb.from('book_contents').insert({ book_id: id, revision: 1, content: book.chapters })).error, '본문 저장');
        const path = `${id}/r1.${book.format}`;
        fail((await storage().upload(path, file, { contentType: 'application/octet-stream' })).error, '원본 파일 저장');
        fail((await sb.from('books').update({ source_path: path }).eq('id', id)).error, '원본 경로 저장');
        return id;
      } catch (e) { await cleanup(id, 1, book.format, true); throw e; }
    },
    /** 개정본 업로드: revision +1. 이전 개정본 본문은 보존, 작가에게는 최신본이 보인다. */
    async uploadRevision(bookId: string, book: Book, file: Blob): Promise<number> {
      const cur = await sb.from('books').select('current_revision,file_hash').eq('id', bookId).single(); fail(cur.error, '원고 조회');
      if (cur.data!.file_hash === book.id) throw new Error('현재 등록된 파일과 같은 파일입니다');
      const dup = await sb.from('books').select('id,title').eq('file_hash', book.id).neq('id', bookId).maybeSingle();
      if (dup.data) throw new Error(`다른 원고로 이미 등록된 파일입니다 (${dup.data.title})`);
      const rev = (cur.data!.current_revision as number) + 1;
      try {
        fail((await sb.from('book_contents').insert({ book_id: bookId, revision: rev, content: book.chapters })).error, '본문 저장');
        const path = `${bookId}/r${rev}.${book.format}`;
        fail((await storage().upload(path, file, { contentType: 'application/octet-stream' })).error, '원본 파일 저장');
        fail((await sb.from('books').update({ current_revision: rev, file_hash: book.id, format: book.format, source_path: path, updated_at: new Date().toISOString(), ...meta(book) }).eq('id', bookId)).error, '개정 반영');
        return rev;
      } catch (e) { await cleanup(bookId, rev, book.format, false); throw e; }
    },
    async remove(id: string) {
      const files = await storage().list(id).catch(() => ({ data: null }));
      if (files.data?.length) await storage().remove(files.data.map(f => `${id}/${f.name}`));
      fail((await sb.from('books').delete().eq('id', id)).error, '삭제');
    },
    // ── 작가 배정·공유
    async authors(): Promise<AuthorRow[]> { const { data, error } = await sb.from('profiles').select('id,name,email').eq('role', 'author').order('name'); fail(error, '작가 목록'); return (data ?? []) as AuthorRow[]; },
    async assignments(bookId: string): Promise<AssignRow[]> { const { data, error } = await sb.from('assignments').select('author_id,enabled,allow_copy').eq('book_id', bookId); fail(error, '배정 조회'); return (data ?? []) as AssignRow[]; },
    async assign(bookId: string, authorId: string) { fail((await sb.from('assignments').upsert({ book_id: bookId, author_id: authorId }, { onConflict: 'book_id,author_id', ignoreDuplicates: true })).error, '배정'); },
    async updateAssign(bookId: string, authorId: string, patch: { enabled?: boolean; allow_copy?: boolean }) { fail((await sb.from('assignments').update({ ...patch, updated_at: new Date().toISOString() }).eq('book_id', bookId).eq('author_id', authorId)).error, '변경'); },
    async unassign(bookId: string, authorId: string) { fail((await sb.from('assignments').delete().eq('book_id', bookId).eq('author_id', authorId)).error, '배정 해제'); },
    async addAuthor(email: string, name?: string) { fail((await sb.rpc('add_author', { p_email: email, p_name: name ?? null })).error, '작가 추가'); },
  };
}

// ── 형광펜·이어읽기 서버 저장소 (로컬 저장소와 같은 모양)
export const annToRow = (a: Annotation) => ({ id: a.id, book_id: a.bookId, chapter_id: a.chapterId, block_index: a.blockIndex, start_pos: a.start, end_pos: a.end, quote: a.quote, color: a.color, memo: a.memo ?? null, created_at: new Date(a.createdAt).toISOString(), updated_at: new Date(a.updatedAt).toISOString() });
export const rowToAnn = (r: any): Annotation => ({ id: r.id, bookId: r.book_id, authorId: r.author_id, chapterId: r.chapter_id, blockIndex: r.block_index, start: r.start_pos, end: r.end_pos, quote: r.quote, color: r.color, memo: r.memo ?? undefined, createdAt: Date.parse(r.created_at), updatedAt: Date.parse(r.updated_at) });

export function createRemoteRepo(sb: Sb): AnnotationStore & { getState(bookId: string): Promise<ReadingState | null>; saveState(s: ReadingState): Promise<void> } {
  const log = (what: string, e: unknown) => console.error(`[서버 저장 실패] ${what}`, e);
  return {
    async listAnnotations(bookId) { const { data, error } = await sb.from('annotations').select('*').eq('book_id', bookId); if (error) { log('주석 조회', error); return []; } return (data ?? []).map(rowToAnn); },
    async saveAnnotation(a) { const { error } = await sb.from('annotations').upsert(annToRow(a), { onConflict: 'id' }); if (error) log('주석 저장', error); },
    async deleteAnnotation(_bookId, id) { const { error } = await sb.from('annotations').delete().eq('id', id); if (error) log('주석 삭제', error); },
    async getState(bookId) {
      const { data } = await sb.from('reading_states').select('book_id,chapter_id,block_index,updated_at').eq('book_id', bookId).maybeSingle();
      return data ? { bookId: data.book_id, chapterId: data.chapter_id, blockIndex: data.block_index, updatedAt: Date.parse(data.updated_at) } : null;
    },
    async saveState(s) {
      const uid = (await sb.auth.getSession()).data.session?.user.id; if (!uid) return;
      const { error } = await sb.from('reading_states').upsert({ user_id: uid, book_id: s.bookId, chapter_id: s.chapterId, block_index: s.blockIndex, updated_at: new Date(s.updatedAt).toISOString() }, { onConflict: 'user_id,book_id' });
      if (error) log('이어읽기 저장', error);
    },
  };
}
