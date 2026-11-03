// 로그인 후 "이 계정이 뷰어에서 무엇을 할 수 있나"를 판정하는 순수 함수 (테스트 가능)
export type Access =
  | { kind: 'editor' | 'author'; name: string; email: string }
  | { kind: 'none' }                       // 로그인은 됐지만 뷰어 권한(viewer.profiles)이 없음
  | { kind: 'schema-not-exposed' }         // 대시보드 Exposed schemas에 viewer 미등록
  | { kind: 'error'; message: string };

interface Row { name?: string | null; email?: string | null; role?: string | null }
interface Err { code?: string; message?: string }

export function resolveAccess(row: Row | null | undefined, err?: Err | null): Access {
  if (err) {
    if (err.code === 'PGRST106' || /schema must be one of/i.test(err.message ?? '')) return { kind: 'schema-not-exposed' };
    if (err.code === '42501') return { kind: 'error', message: '권한 오류(42501): supabase/schema.sql 전체가 정상 실행됐는지 확인해 주세요' };
    return { kind: 'error', message: err.message || '서버 응답 오류' };
  }
  if (!row) return { kind: 'none' };
  if (row.role === 'editor' || row.role === 'author') return { kind: row.role, name: row.name || '', email: row.email || '' };
  return { kind: 'none' };
}

export function loginErrorMessage(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return '이메일 또는 비밀번호가 올바르지 않습니다';
  if (/email not confirmed/i.test(msg)) return '이메일 인증이 안 된 계정입니다. 관리자에게 문의해 주세요';
  if (/rate limit|too many/i.test(msg)) return '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요';
  if (/failed to fetch|network/i.test(msg)) return '네트워크 연결을 확인해 주세요';
  return '로그인에 실패했습니다: ' + msg;
}
