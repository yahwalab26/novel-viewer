import { createClient, type Session } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from '../config';
import { resolveAccess, loginErrorMessage, registerFailure, type Access } from './access';
import { createBooksApi, createRemoteRepo } from './books';

/** 서버(Supabase) 접근은 모두 이 파일을 통한다. 뷰어 데이터는 전용 스키마 `viewer`. */
export function createApi(opts: { fetch?: typeof fetch } = {}) {
  const sb = createClient<any, 'viewer'>(SUPABASE_URL, SUPABASE_KEY, {
    db: { schema: 'viewer' },
    auth: { detectSessionInUrl: false },
    ...(opts.fetch ? { global: { fetch: opts.fetch } } : {}),
  });
  return {
    sb,
    books: createBooksApi(sb),          // 편집자: 원고 업로드·배정·공유
    repo: createRemoteRepo(sb),         // 형광펜·이어읽기 서버 저장
    async session(): Promise<Session | null> { return (await sb.auth.getSession()).data.session; },
    onAuth(cb: (s: Session | null) => void) { return sb.auth.onAuthStateChange((_e, s) => cb(s)); },
    /** 성공: { error: null, session } / 실패: 화면에 보여줄 한국어 메시지 */
    async signIn(email: string, password: string): Promise<{ error: string | null; session: Session | null }> {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      return error ? { error: loginErrorMessage(error.message), session: null } : { error: null, session: data.session };
    },
    async signOut() { await sb.auth.signOut(); },
    async loadAccess(userId: string): Promise<Access> {
      const read = () => sb.from('profiles').select('name,email,role').eq('id', userId).maybeSingle();
      let { data, error } = await read(); let access = resolveAccess(data, error);
      if (access.kind === 'none') {
        // 같은 프로젝트의 계정(정산 작가 등)은 첫 로그인 때 '작가'로 자동 등록(편집자는 불가·원고는 배정돼야 보임).
        // 안 되는 경우에는 '권한 없음'에 이유를 붙여 화면이 다음 행동을 안내한다.
        const r = await sb.rpc('ensure_profile');
        if (r.error) access = { kind: 'none', ...registerFailure(r.error) };
        else if (!r.data) access = { kind: 'none', reason: 'disabled' };
        else {
          ({ data, error } = await read()); access = resolveAccess(data, error);
          if (access.kind === 'none') access = { kind: 'none', reason: 'failed', detail: '등록 직후 조회 실패' };
        }
      }
      return access;
    },
  };
}
export type Api = ReturnType<typeof createApi>;
