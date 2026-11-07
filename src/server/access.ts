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

export const MIN_PASSWORD = 8;
/** 새 비밀번호 입력 검증 — 문제가 없으면 null */
export function validateNewPassword(pw: string, confirm: string): string | null {
  if (pw.length < MIN_PASSWORD) return `비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요`;
  if (pw !== confirm) return '비밀번호 확인이 일치하지 않아요';
  return null;
}
export function passwordErrorMessage(msg: string): string {
  if (/different from the old|same_password/i.test(msg)) return '이전과 다른 비밀번호를 입력해 주세요';
  if (/at least|too short|weak|pwned|should contain/i.test(msg)) return '더 안전한 비밀번호를 입력해 주세요 (길게, 영문·숫자 섞어서)';
  if (/reauthentication|recent login|nonce/i.test(msg)) return '보안을 위해 다시 로그인한 뒤 시도해 주세요';
  if (/failed to fetch|network/i.test(msg)) return '네트워크 연결을 확인해 주세요';
  return '비밀번호를 변경하지 못했어요: ' + msg;
}
