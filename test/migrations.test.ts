import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import { STUB } from './pgstub';
import { buildSchema } from '../scripts/build-schema.mjs';

const read = (f: string) => fs.readFileSync(f, 'utf-8');
async function shape(files: string[]) {
  const db = new PGlite(); await db.exec(STUB); for (const f of files) await db.exec(read(f));
  const rows = async (sql: string) => (await db.query<any>(sql)).rows.map(r => JSON.stringify(r)).sort();
  return {
    columns: await rows("select table_name, column_name, data_type from information_schema.columns where table_schema='viewer'"),
    policies: await rows("select schemaname, tablename, policyname, cmd from pg_policies where schemaname in ('viewer','storage')"),
    rls: await rows("select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='viewer' and relkind='r'"),
    grants: await rows("select table_name, privilege_type, grantee from information_schema.role_table_grants where table_schema='viewer' and grantee in ('anon','authenticated')"),
  };
}
const migrations = fs.readdirSync('supabase/migrations').filter(f => /^\d{3}_.*\.sql$/.test(f)).sort().map(f => 'supabase/migrations/' + f);
it('새로 설치(schema.sql)와 업그레이드(001 → 최신)의 결과가 완전히 같다', async () => {
  const fresh = await shape(['supabase/schema.sql']);
  const upgraded = await shape(migrations);
  expect(upgraded).toEqual(fresh);
  expect(fresh.columns.some(c => c.includes('bookmarks'))).toBe(true);
  expect(fresh.columns.some(c => c.includes('app_settings'))).toBe(true);
  expect(fresh.rls.every(r => r.includes('true'))).toBe(true);           // 모든 테이블 RLS 켜짐
  expect(fresh.grants.some(g => g.includes('anon'))).toBe(false);        // 로그인 전 권한 없음
});
it('schema.sql 은 migrations 합본 스크립트(npm run schema)의 결과와 같다(수동 편집 방지)', () => {
  expect(read('supabase/schema.sql')).toBe(buildSchema());
});
