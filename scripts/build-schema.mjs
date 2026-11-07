// supabase/migrations/NNN_*.sql 을 순서대로 이어 붙여 supabase/schema.sql(새로 설치용 합본)을 만든다.  사용: npm run schema
import fs from 'node:fs';
export function buildSchema(dir = 'supabase/migrations') {
  const files = fs.readdirSync(dir).filter(f => /^\d{3}_.*\.sql$/.test(f)).sort();
  const header = `-- 웹소설 뷰어 DB 스키마 = migrations/${files[0]} ~ ${files[files.length - 1]} 합본 (새로 설치할 때 이 파일 전체를 한 번 실행)\n-- ⚠ 직접 수정 금지: supabase/migrations 에 새 파일을 추가하고 \`npm run schema\` 로 다시 만든다.\n`;
  return header + files.map(f => '\n' + fs.readFileSync(`${dir}/${f}`, 'utf8').trim() + '\n').join('');
}
if (process.argv[1]?.endsWith('build-schema.mjs')) { fs.writeFileSync('supabase/schema.sql', buildSchema()); console.log('supabase/schema.sql 갱신'); }
