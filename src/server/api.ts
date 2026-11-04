import { createClient, type Session } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from '../config';
import { resolveAccess, loginErrorMessage, type Access } from './access';
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
    /** 성공하면 null, 실패하면 화면에 보여줄 한국어 메시지 */
    async signIn(email: string, password: string): Promise<string | null> {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      return error ? loginErrorMessage(error.message) : null;
    },
    async signOut() { await sb.auth.signOut(); },
    async loadAccess(userId: string): Promise<Access> {
      const { data, error } = await sb.from('profiles').select('name,email,role').eq('id', userId).maybeSingle();
      return resolveAccess(data, error);
    },
  };
}
export type Api = ReturnType<typeof createApi>;
