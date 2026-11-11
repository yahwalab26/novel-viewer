// 서버 권한 규칙(supabase/schema.sql) 검증: 가짜 Postgres(PGlite)에 Supabase 환경을 흉내내고 시나리오 실행
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import { STUB } from './pgstub';

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
  await db.exec(STUB);
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
describe('SQL Editor(로그인 없는 관리자 세션)에서 작가 등록', () => {
  it('add_author는 로그인한 편집자 전용이라 SQL Editor에서는 거부된다 → insert로 등록', async () => {
    await db.exec(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a3','a3@x.com')`);
    await expect(db.exec(`select viewer.add_author('a3@x.com')`)).rejects.toThrow(/편집자만/);
    await db.exec(`insert into viewer.profiles (id, email, name, role) select id, email, '작가3', 'author' from auth.users where email = 'a3@x.com' on conflict (id) do nothing;`);
    expect(await q(`select role from viewer.profiles where email='a3@x.com'`)).toEqual([{ role: 'author' }]);
    await db.exec(`insert into viewer.profiles (id, email, name, role) select id, email, '작가3', 'author' from auth.users where email = 'a3@x.com' on conflict (id) do nothing;`); // 재실행 안전
    await db.exec(`delete from viewer.profiles where email='a3@x.com'`);
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

// 앱(PostgREST)이 실제로 보내는 형태의 SQL이 RLS 아래에서 의도대로 동작하는지
describe('앱이 쓰는 저장 패턴(upsert·cascade)', () => {
  const B3 = '10000000-0000-0000-0000-000000000003', AN = '20000000-0000-0000-0000-000000000001';
  beforeAll(async () => {
    await as(E, async () => { await db.exec(`insert into viewer.books (id, title, format) values ('${B3}','작품3','docx'); insert into viewer.assignments (book_id, author_id) values ('${B3}','${A1}'), ('${B3}','${A2}');`); });
  });
  it('작가: 같은 id로 형광펜 upsert → 수정됨. 다른 작가가 같은 id로 upsert → 거부, 원본 불변', async () => {
    const ins = (memo: string) => `insert into viewer.annotations (id, book_id, chapter_id, block_index, start_pos, end_pos, quote, color, memo) values ('${AN}','${B3}','c0',0,0,1,'가','yellow','${memo}') on conflict (id) do update set memo = excluded.memo`;
    await as(A1, async () => { await db.exec(ins('처음')); await db.exec(ins('수정')); });
    await as(A2, async () => { expect(await denied(ins('탈취'))).toBe(true); });
    expect((await q(`select memo, author_id from viewer.annotations where id='${AN}'`))[0]).toEqual({ memo: '수정', author_id: A1 });
  });
  it('편집자: 같은 방식으로 자기 형광펜 저장 가능(작가 것은 수정 불가)', async () => {
    await as(E, async () => {
      await db.exec(`insert into viewer.annotations (id, book_id, chapter_id, block_index, start_pos, end_pos, quote, color) values ('20000000-0000-0000-0000-000000000002','${B3}','c0',1,0,1,'나','blue')`);
      expect(await denied(`insert into viewer.annotations (id, book_id, chapter_id, block_index, start_pos, end_pos, quote, color, memo) values ('${AN}','${B3}','c0',0,0,1,'가','yellow','편집자가덮음') on conflict (id) do update set memo = excluded.memo`)).toBe(true);
    });
    expect((await q(`select memo from viewer.annotations where id='${AN}'`))[0].memo).toBe('수정');
  });
  it('배정 재실행(on conflict do nothing)은 기존 설정(복사 허용 등)을 유지', async () => {
    await as(E, async () => {
      await db.exec(`update viewer.assignments set allow_copy = true where book_id='${B3}' and author_id='${A1}'`);
      await db.exec(`insert into viewer.assignments (book_id, author_id) values ('${B3}','${A1}') on conflict (book_id, author_id) do nothing`);
    });
    expect((await q(`select allow_copy from viewer.assignments where book_id='${B3}' and author_id='${A1}'`))[0].allow_copy).toBe(true);
  });
  it('이어읽기 upsert (작가 본인)', async () => {
    const up = (c: string) => `insert into viewer.reading_states (user_id, book_id, chapter_id, block_index) values ('${A1}','${B3}','${c}',3) on conflict (user_id, book_id) do update set chapter_id = excluded.chapter_id`;
    await as(A1, async () => { await db.exec(up('c1')); await db.exec(up('c2')); expect((await q('select chapter_id from viewer.reading_states where book_id = \'' + B3 + '\''))[0].chapter_id).toBe('c2'); });
    await as(A2, async () => { expect(await denied(`insert into viewer.reading_states (user_id, book_id, chapter_id) values ('${A1}','${B3}','해킹') on conflict (user_id, book_id) do update set chapter_id = excluded.chapter_id`)).toBe(true); });
  });
  it('편집자가 원고를 삭제하면 배정·형광펜·이어읽기·본문이 함께 삭제', async () => {
    await as(E, async () => { await db.exec(`insert into viewer.book_contents (book_id, content) values ('${B3}','[]'); delete from viewer.books where id='${B3}'`); });
    for (const t of ['assignments', 'annotations', 'reading_states', 'book_contents']) expect((await q(`select count(*)::int n from viewer.${t} where book_id='${B3}'`))[0].n).toBe(0);
  });
});

describe('북마크(개인)', () => {
  const BM = '30000000-0000-0000-0000-000000000001';
  const up = (label: string) => `insert into viewer.bookmarks (id, book_id, chapter_id, block_index, label) values ('${BM}','${B1}','c0',5,'${label}') on conflict (id) do update set label = excluded.label`;
  it('작가는 본인 북마크를 저장·수정(upsert)하고, 다른 작가는 못 보며 덮어쓸 수도 없다', async () => {
    await as(A1, async () => { await db.exec(up('처음')); await db.exec(up('수정')); expect(await q('select label from viewer.bookmarks')).toEqual([{ label: '수정' }]); });
    await as(A2, async () => { expect(await q('select * from viewer.bookmarks')).toHaveLength(0); expect(await denied(up('탈취'))).toBe(true); });
    expect((await q(`select label from viewer.bookmarks where id='${BM}'`))[0].label).toBe('수정');
  });
  it('편집자도 남의 북마크는 못 본다(개인 영역)', async () => {
    await as(E, async () => { expect(await q('select * from viewer.bookmarks')).toHaveLength(0); });
  });
  it('배정되지 않은 원고에는 북마크 불가, 남 명의로도 불가', async () => {
    await as(A1, async () => {
      expect(await denied(`insert into viewer.bookmarks (book_id, chapter_id, block_index) values ('${B2}','c0',1)`)).toBe(true);
      expect(await denied(`insert into viewer.bookmarks (user_id, book_id, chapter_id, block_index) values ('${A2}','${B1}','c0',1)`)).toBe(true);
    });
  });
  it('공유 OFF 면 보이지 않고, 다시 ON 이면 복구. 삭제는 본인만', async () => {
    await as(E, async () => { await db.exec(`update viewer.assignments set enabled=false where book_id='${B1}' and author_id='${A1}'`); });
    await as(A1, async () => { expect(await q('select * from viewer.bookmarks')).toHaveLength(0); });
    await as(E, async () => { await db.exec(`update viewer.assignments set enabled=true where book_id='${B1}' and author_id='${A1}'`); });
    await as(A2, async () => { expect(await denied(`delete from viewer.bookmarks where id='${BM}'`)).toBe(true); });
    await as(A1, async () => { expect(await q('select * from viewer.bookmarks')).toHaveLength(1); await db.exec(`delete from viewer.bookmarks where id='${BM}'`); expect(await q('select * from viewer.bookmarks')).toHaveLength(0); });
  });
});

describe('자동 등록(ensure_profile) — 정산 등 같은 프로젝트 계정', () => {
  const N1 = '00000000-0000-0000-0000-0000000000b1', N2 = '00000000-0000-0000-0000-0000000000b2';
  beforeAll(async () => { await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${N1}','New1@Settle.com','{"name":"김정산"}'), ('${N2}','new2@settle.com', null)`); });
  const ensure = () => q('select viewer.ensure_profile() as r').then(r => r[0].r);

  it('프로필이 없는 로그인 사용자가 호출하면 작가로 등록(이메일 소문자, 이름 반영)되고, 다시 호출해도 그대로', async () => {
    await as(N1, async () => { expect(await ensure()).toBe('author'); expect(await ensure()).toBe('author'); });
    expect(await q(`select email, name, role from viewer.profiles where id='${N1}'`)).toEqual([{ email: 'new1@settle.com', name: '김정산', role: 'author' }]);
  });
  it('이름 정보가 없으면 이메일 앞부분을 이름으로', async () => {
    await as(N2, async () => { await ensure(); });
    expect((await q(`select name from viewer.profiles where id='${N2}'`))[0].name).toBe('new2');
  });
  it('자동 등록된 작가는 배정 전에는 어떤 원고도 못 본다', async () => {
    await as(N1, async () => { expect(await q('select * from viewer.books')).toHaveLength(0); expect(await q('select * from viewer.book_contents')).toHaveLength(0); });
  });
  it('편집자가 호출해도 역할은 editor 그대로, 호출로 편집자가 될 수는 없다', async () => {
    await as(E, async () => { expect(await ensure()).toBe('editor'); });
    await as(N1, async () => {
      expect(await ensure()).toBe('author');
      expect(await denied(`insert into viewer.profiles (id, email, role) values ('${N1}','x','editor')`)).toBe(true);        // 직접 등록 불가
      expect(await denied(`update viewer.profiles set role='editor' where id='${N1}'`)).toBe(true);
    });
    expect((await q(`select role from viewer.profiles where id='${N1}'`))[0].role).toBe('author');
  });
  it('로그인 전(anon)은 호출 불가', async () => {
    await as(null, async () => { expect(await denied('select viewer.ensure_profile()')).toBe(true); });
    expect((await q("select has_function_privilege('anon','viewer.ensure_profile()','execute') as ok"))[0].ok).toBe(false);        // 실행 권한 자체가 없어야 함
    expect((await q("select has_function_privilege('authenticated','viewer.ensure_profile()','execute') as ok"))[0].ok).toBe(true);
  });
  it('스위치(auto_register)를 끄면 새 계정은 등록되지 않고 null, 작가는 스위치를 보거나 바꿀 수 없다', async () => {
    const N3 = '00000000-0000-0000-0000-0000000000b3'; await db.exec(`insert into auth.users (id, email) values ('${N3}','new3@settle.com')`);
    await as(N1, async () => { expect(await q('select * from viewer.app_settings')).toHaveLength(0); expect(await denied(`update viewer.app_settings set bool_value=false`)).toBe(true); });
    await as(E, async () => { expect(await q('select bool_value from viewer.app_settings')).toEqual([{ bool_value: true }]); await db.exec(`update viewer.app_settings set bool_value=false where key='auto_register'`); });
    await as(N3, async () => { expect(await ensure()).toBeNull(); });
    expect(await q(`select * from viewer.profiles where id='${N3}'`)).toHaveLength(0);
    await as(N1, async () => { expect(await ensure()).toBe('author'); });                       // 이미 등록된 사람은 영향 없음
    await as(E, async () => { await db.exec(`update viewer.app_settings set bool_value=true where key='auto_register'`); });
    await as(N3, async () => { expect(await ensure()).toBe('author'); });
  });
});

describe('읽기 진행률(progress)', () => {
  const up = (v: string) => `insert into viewer.reading_states (user_id, book_id, chapter_id, progress) values ('${A1}','${B1}','c0',${v}) on conflict (user_id, book_id) do update set progress = excluded.progress`;
  it('작가는 본인 진행률을 저장·수정하고, 0~1 밖의 값은 거부, 기본값은 0', async () => {
    await as(A1, async () => {
      await db.exec(up('0.4')); expect((await q('select progress from viewer.reading_states'))[0].progress).toBeCloseTo(0.4);
      await db.exec(up('1')); expect((await q('select progress from viewer.reading_states'))[0].progress).toBe(1);
      expect(await denied(up('1.5'))).toBe(true); expect(await denied(up('-0.1'))).toBe(true);
    });
    await as(A2, async () => { expect(await q('select * from viewer.reading_states')).toHaveLength(0); });          // 남의 진행률은 안 보임
  });
});
