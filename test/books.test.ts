import { describe, it, expect } from 'vitest';
import { createApi } from '../src/server/api';
import { annToRow, rowToAnn } from '../src/server/books';
import type { Annotation, Book } from '../src/core/model';

type Call = { method: string; url: string; body: any; headers: Headers };
/** 요청을 기록하고, routes(메서드+경로 일부 → 응답)에 따라 가짜 응답을 돌려주는 서버 */
function fake(routes: Record<string, (c: Call) => { status?: number; body?: unknown }>) {
  const calls: Call[] = [];
  const f = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = new Headers(init?.headers);
    let body: any = init?.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { /* 그대로 */ } }
    const c = { method, url, body, headers }; calls.push(c);
    if (url.includes('/auth/v1/token')) return new Response(JSON.stringify({ access_token: 'a.b.c', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: 'u-1', email: 'e@x.com', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    const key = Object.keys(routes).find(k => { const [m, p] = k.split(' '); return m === method && url.includes(p); });
    const r = key ? routes[key](c) : { status: 404, body: { message: 'no route ' + method + ' ' + url } };
    const single = (headers.get('accept') ?? '').includes('pgrst.object');
    const out = single && Array.isArray(r.body) ? r.body[0] : r.body;
    return new Response(r.status === 204 || out === undefined ? null : JSON.stringify(out), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { f, calls };
}
const book: Book = { id: 'hash123', title: '테스트 작품', author: '작가', format: 'hwpx', parserVersion: 1, addedAt: 0,
  chapters: [{ id: 'c0', title: '1화', blocks: [{ type: 'p', text: '가나다' }], charCount: 3 }, { id: 'c1', title: '2화', blocks: [], charCount: 7 }] };
const file = new Blob(['x']);
const logIn = async (api: ReturnType<typeof createApi>) => { await api.signIn('e@x.com', 'pw'); };

describe('원고 업로드(편집자)', () => {
  it('중복확인 → 책 → 본문 → 원본 파일 → 경로 저장 순서, 본문·메타 내용', async () => {
    const { f, calls } = fake({
      'GET /rest/v1/books': () => ({ body: [] }),
      'POST /rest/v1/books': () => ({ status: 201, body: [{ id: 'b-1' }] }),
      'POST /rest/v1/book_contents': () => ({ status: 201 }),
      'POST /storage/v1/object/viewer-manuscripts/b-1/r1.hwpx': () => ({ body: { Key: 'k' } }),
      'PATCH /rest/v1/books': () => ({ status: 204 }),
    });
    const api = createApi({ fetch: f }); await logIn(api);
    expect(await api.books.upload(book, file)).toBe('b-1');
    const seq = calls.filter(c => !c.url.includes('/auth/')).map(c => `${c.method} ${new URL(c.url).pathname.replace('/rest/v1', '')}`);
    expect(seq).toEqual(['GET /books', 'POST /books', 'POST /book_contents', 'POST /storage/v1/object/viewer-manuscripts/b-1/r1.hwpx', 'PATCH /books']);
    const ins = calls.find(c => c.method === 'POST' && new URL(c.url).pathname.endsWith('/books'))!;
    expect(ins.body).toMatchObject({ title: '테스트 작품', author_name: '작가', format: 'hwpx', file_hash: 'hash123', chapter_count: 2, char_count: 10 });
    expect(ins.headers.get('content-profile')).toBe('viewer');                    // 쓰기도 전용 스키마
    const cont = calls.find(c => c.url.includes('book_contents'))!;
    expect(cont.body).toMatchObject({ book_id: 'b-1', revision: 1 }); expect(cont.body.content).toHaveLength(2);
  });
  it('이미 등록된 파일이면 아무것도 만들지 않는다', async () => {
    const { f, calls } = fake({ 'GET /rest/v1/books': () => ({ body: [{ id: 'old', title: '기존 작품' }] }) });
    const api = createApi({ fetch: f }); await logIn(api);
    await expect(api.books.upload(book, file)).rejects.toThrow('이미 등록된 원고입니다 (기존 작품)');
    expect(calls.some(c => c.method === 'POST' && c.url.includes('/rest/v1/'))).toBe(false);
  });
  it('원본 파일 저장이 실패하면 만든 책을 지운다(반쪽 등록 방지)', async () => {
    const { f, calls } = fake({
      'GET /rest/v1/books': () => ({ body: [] }), 'POST /rest/v1/books': () => ({ status: 201, body: [{ id: 'b-9' }] }), 'POST /rest/v1/book_contents': () => ({ status: 201 }),
      'POST /storage/v1/object/': () => ({ status: 400, body: { message: 'storage down', error: 'x', statusCode: '400' } }),
      'DELETE /rest/v1/books': () => ({ status: 204 }), 'DELETE /storage/v1/object/': () => ({ body: [] }),
    });
    const api = createApi({ fetch: f }); await logIn(api);
    await expect(api.books.upload(book, file)).rejects.toThrow('원본 파일 저장');
    const del = calls.find(c => c.method === 'DELETE' && c.url.includes('/rest/v1/books'))!;
    expect(decodeURIComponent(del.url)).toContain('id=eq.b-9');
  });
});

describe('개정본 업로드', () => {
  it('revision +1 로 본문·원본 저장 후 현재 개정 갱신', async () => {
    const { f, calls } = fake({
      'GET /rest/v1/books?select=current_revision': () => ({ body: [{ current_revision: 2, file_hash: 'old' }] }),
      'GET /rest/v1/books?select=id%2Ctitle': () => ({ body: [] }),
      'POST /rest/v1/book_contents': () => ({ status: 201 }), 'POST /storage/v1/object/viewer-manuscripts/b-1/r3.hwpx': () => ({ body: {} }), 'PATCH /rest/v1/books': () => ({ status: 204 }),
    });
    const api = createApi({ fetch: f }); await logIn(api);
    expect(await api.books.uploadRevision('b-1', book, file)).toBe(3);
    expect(calls.find(c => c.url.includes('book_contents'))!.body.revision).toBe(3);
    expect(calls.find(c => c.method === 'PATCH')!.body).toMatchObject({ current_revision: 3, file_hash: 'hash123', chapter_count: 2 });
  });
  it('현재와 같은 파일이면 거부', async () => {
    const { f } = fake({ 'GET /rest/v1/books': () => ({ body: [{ current_revision: 1, file_hash: 'hash123' }] }) });
    const api = createApi({ fetch: f }); await logIn(api);
    await expect(api.books.uploadRevision('b-1', book, file)).rejects.toThrow('같은 파일');
  });
});

describe('배정·공유', () => {
  it('배정은 기존 값을 덮어쓰지 않고(ignore-duplicates), 변경은 PATCH로 해당 필드만', async () => {
    const { f, calls } = fake({ 'POST /rest/v1/assignments': () => ({ status: 201 }), 'PATCH /rest/v1/assignments': () => ({ status: 204 }), 'DELETE /rest/v1/assignments': () => ({ status: 204 }) });
    const api = createApi({ fetch: f }); await logIn(api);
    await api.books.assign('b-1', 'a-1'); await api.books.updateAssign('b-1', 'a-1', { enabled: false }); await api.books.unassign('b-1', 'a-1');
    const [post, patch, del] = calls.filter(c => c.url.includes('assignments'));
    expect(post.headers.get('prefer')).toContain('ignore-duplicates'); expect(post.body).toEqual({ book_id: 'b-1', author_id: 'a-1' });
    expect(Object.keys(patch.body).sort()).toEqual(['enabled', 'updated_at']);                  // allow_copy 를 건드리지 않음
    expect(decodeURIComponent(del.url)).toMatch(/book_id=eq\.b-1.*author_id=eq\.a-1|author_id=eq\.a-1.*book_id=eq\.b-1/);
  });
  it('작가 추가는 add_author RPC, 서버 오류 메시지를 그대로 전달', async () => {
    const { f, calls } = fake({ 'POST /rest/v1/rpc/add_author': () => ({ status: 400, body: { message: '해당 이메일 계정이 없습니다', code: 'P0001' } }) });
    const api = createApi({ fetch: f }); await logIn(api);
    await expect(api.books.addAuthor('no@x.com', '이름')).rejects.toThrow('해당 이메일 계정이 없습니다');
    expect(calls.find(c => c.url.includes('rpc/add_author'))!.body).toEqual({ p_email: 'no@x.com', p_name: '이름' });
  });
});

describe('형광펜 서버 저장 변환', () => {
  const a: Annotation = { id: 'i', bookId: 'b', authorId: 'u', chapterId: 'c0', blockIndex: 4, start: 2, end: 6, quote: '가나다라', color: 'pink', memo: '메모', createdAt: 1700000000000, updatedAt: 1700000001000 };
  it('모델 ↔ DB 행 왕복', () => {
    const row = annToRow(a); expect(row).toMatchObject({ start_pos: 2, end_pos: 6, block_index: 4, chapter_id: 'c0' }); expect(row).not.toHaveProperty('author_id');   // 작성자는 서버가 로그인 사용자로 채움
    expect(rowToAnn({ ...row, author_id: 'u' })).toEqual(a);
  });
  it('저장은 upsert, 이어읽기는 사용자·책 기준 upsert', async () => {
    const { f, calls } = fake({ 'POST /rest/v1/annotations': () => ({ status: 201 }), 'POST /rest/v1/reading_states': () => ({ status: 201 }) });
    const api = createApi({ fetch: f }); await logIn(api);
    await api.repo.saveAnnotation(a); await api.repo.saveState({ bookId: 'b', chapterId: 'c1', blockIndex: 7, updatedAt: 1700000000000 });
    expect(calls.find(c => c.url.includes('/annotations'))!.headers.get('prefer')).toContain('resolution=merge-duplicates');
    const st = calls.find(c => c.url.includes('/reading_states'))!; expect(st.body).toMatchObject({ user_id: 'u-1', book_id: 'b', block_index: 7 });
  });
});
