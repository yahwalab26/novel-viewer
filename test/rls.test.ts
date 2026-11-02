// 서버 권한 규칙(supabase/schema.sql) 검증: 가짜 Postgres(PGlite)에 Supabase 환경을 흉내내고 시나리오 실행
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

let db: PGlite;
const E = '00000000-0000-0000-0000-00000000000e', A1 = '00000000-0000-0000-0000-0000000000a1', A2 = '00000000-0000-0000-0000-0000000000a2';
const B1 = '10000000-0000-0000-0000-000000000001', B2 = '10000000-0000-0000-0000-000000000002';

async function as<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(uid ? `set role authenticated; select set_config('request.jwt.claim.sub','${uid}', false);` : `set role anon; select set_config('request.jwt.claim.sub','', false);`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
const q = async (sql: string) => (await db.query<any>(sql)).rows;
// 거부 = 오류 발생, 또는 영향/반환 행 0개. (select는 반환 행 수, 그 외는 영향 행 수로 판정)
const denied = async (sql: string) => {
  try { const r = await db.query(sql); return (/^\s*select/i.test(sql) ? r.rows.length : (r.affectedRows ?? 0)) === 0; } catch { return true; }
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create schema storage;
    create table public.profiles (id uuid primary key, role text);  -- 기존 프로젝트에 이미 있는 같은 이름 테이블(충돌 확인용)
    create table public.books (id int);
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (bucket_id text, name text); alter table storage.objects enable row level security;
    grant usage on schema auth, storage, public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;   -- Supabase 기본 설정 흉내
    grant select, insert, update, delete on storage.objects to authenticated;
  `);
  await db.exec(fs.readFileSync('supabase/schema.sql', 'utf-8'));
  await db.exec(`
    insert into auth.users (id, email) values ('${E}','editor@x.com'), ('${A1}','a1@x.com'), ('${A2}','a2@x.com');
    insert into viewer.profiles (id, email, name, role) select id, email, 'editor', 'editor' from auth.users where email = 'editor@x.com';
  `);
  await as(E, async () => {
    await db.exec(`
      select viewer.add_author('a1@x.com', 'A1'); select viewer.add_author('A2@X.com');
      insert into viewer.books (id, title, format) values ('${B1}','작품1','hwpx'), ('${B2}','작품2','epub');
      insert into viewer.book_contents (book_id, content) values ('${B1}','[]'), ('${B2}','[]');
      insert into viewer.assignments (book_id, author_id) values ('${B1}','${A1}'), ('${B2}','${A2}');`);
  });
});

describe('로그인 전(anon)', () => {
  it('아무것도 못 본다', async () => {
    await as(null, async () => {
      for (const tb of ['books', 'book_contents', 'assignments', 'annotations', 'profiles']) expect(await denied(`select * from viewer.${tb}`)).toBe(true);
      expect(await denied(`select viewer.add_author('a1@x.com')`)).toBe(true);
    });
    expect((await q("select has_schema_privilege('anon','viewer','usage') as u"))[0].u).toBe(false);   // 스키마 접근권 자체가 없어야 함
  });
});
describe('작가 A1', () => {
  it('배정된 작품1만 보이고, 작품2의 본문은 안 보인다', async () => {
    await as(A1, async () => {
      expect((await q('select id from viewer.books')).map(r => r.id)).toEqual([B1]);
      expect((await q('select book_id from viewer.book_contents')).map(r => r.book_id)).toEqual([B1]);
      expect(await q('select * from viewer.assignments')).toHaveLength(1);
    });
  });
  it('작품 등록/수정/삭제, 배정 변경, 역할 변경 불가', async () => {
    await as(A1, async () => {
      expect(await denied(`insert into viewer.books (title, format) values ('몰래','epub')`)).toBe(true);
      expect(await denied(`update viewer.books set title='x' where id='${B1}'`)).toBe(true);
      expect(await denied(`delete from viewer.books where id='${B1}'`)).toBe(true);
      expect(await denied(`update viewer.assignments set enabled=false where book_id='${B1}'`)).toBe(true);
      expect(await denied(`insert into viewer.assignments (book_id, author_id) values ('${B2}','${A1}')`)).toBe(true);
      expect(await denied(`update viewer.profiles set role='editor' where id='${A1}'`)).toBe(true);
    });
    expect((await q(`select role from viewer.profiles where id='${A1}'`))[0].role).toBe('author');
  });
  it('본인 주석은 작성 가능, 남의 작품/남 명의로는 불가', async () => {
    await as(A1, async () => {
      await db.exec(`insert into viewer.annotations (book_id, chapter_id, block_index, start_pos, end_pos, quote, color, memo) values ('${B1}','c0',1,0,2,'가나','yellow','내 메모')`);
      expect(await denied(`insert into viewer.annotations (book_id, chapter_id, block_index, start_pos, end_pos, quote, color) values ('${B2}','c0',1,0,2,'가나','yellow')`)).toBe(true);
      expect(await denied(`insert into viewer.annotations (book_id, author_id, chapter_id, block_index, start_pos, end_pos, quote, color) values ('${B1}','${A2}','c0',1,0,2,'가나','pink')`)).toBe(true);
    });
  });
  it('이어읽기는 본인 것만', async () => {
    await as(A1, async () => { await db.exec(`insert into viewer.reading_states (book_id, chapter_id) values ('${B1}','c0')`); });
    await as(A2, async () => { expect(await q('select * from viewer.reading_states')).toHaveLength(0); });
  });
});
describe('작가 A2', () => {
  it('A1의 주석을 못 본다 / 수정·삭제도 못 한다', async () => {
    await as(A2, async () => {
      expect(await q('select * from viewer.annotations')).toHaveLength(0);
      expect(await denied(`update viewer.annotations set memo='해킹'`)).toBe(true);
      expect(await denied(`delete from viewer.annotations`)).toBe(true);
    });
    expect((await q(`select memo from viewer.annotations`))[0].memo).toBe('내 메모');
  });
});
describe('계정 부여(add_author)', () => {
  it('작가는 호출 불가, 없는 이메일은 오류, 기존 편집자 역할은 바뀌지 않음', async () => {
    await as(A1, async () => { expect(await denied(`select viewer.add_author('a2@x.com')`)).toBe(true); });
    await as(E, async () => {
      expect(await denied(`select viewer.add_author('nobody@x.com')`)).toBe(true);
      await db.exec(`select viewer.add_author('editor@x.com')`);
      expect((await q(`select role from viewer.profiles where id='${E}'`))[0].role).toBe('editor');
    });
  });
  it('기존 프로젝트의 public 테이블과 충돌하지 않는다', async () => {
    expect(await q(`select count(*)::int n from public.profiles`)).toEqual([{ n: 0 }]);
  });
});
describe('편집자', () => {
  it('모든 작품·모든 작가의 주석을 본다', async () => {
    await as(E, async () => {
      expect(await q('select id from viewer.books')).toHaveLength(2);
      expect(await q('select * from viewer.annotations')).toHaveLength(1);
      expect(await q('select * from viewer.profiles')).toHaveLength(3);
    });
  });
  it('작가의 주석을 수정·삭제할 수는 없다(열람 전용)', async () => {
    await as(E, async () => {
      expect(await denied(`update viewer.annotations set memo='편집'`)).toBe(true);
      expect(await denied(`delete from viewer.annotations`)).toBe(true);
    });
  });
  it('원본 파일 저장소는 편집자만', async () => {
    await as(E, async () => { await db.exec(`insert into storage.objects values ('viewer-manuscripts','a.hwpx')`); });
    await as(A1, async () => {
      expect(await denied(`insert into storage.objects values ('viewer-manuscripts','b.hwpx')`)).toBe(true);
      expect(await q('select * from storage.objects')).toHaveLength(0);
    });
  });
});
describe('공유 OFF', () => {
  it('편집자가 끄면 작가는 즉시 작품·본문·주석 모두 못 보고 새 주석도 못 쓴다', async () => {
    await as(E, async () => { await db.exec(`update viewer.assignments set enabled=false where book_id='${B1}' and author_id='${A1}'`); });
    await as(A1, async () => {
      expect(await q('select * from viewer.books')).toHaveLength(0);
      expect(await q('select * from viewer.book_contents')).toHaveLength(0);
      expect(await q('select * from viewer.annotations')).toHaveLength(0);
      expect(await denied(`insert into viewer.annotations (book_id, chapter_id, block_index, start_pos, end_pos, quote, color) values ('${B1}','c0',1,0,2,'가나','yellow')`)).toBe(true);
    });
  });
  it('다시 켜면 복구(주석 보존)', async () => {
    await as(E, async () => { await db.exec(`update viewer.assignments set enabled=true where book_id='${B1}' and author_id='${A1}'`); });
    await as(A1, async () => { expect(await q('select * from viewer.annotations')).toHaveLength(1); });
  });
});
