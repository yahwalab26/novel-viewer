import { useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Api } from './server/api';
import { SETTLE_URL } from './config';
import AuthShell from './ui/AuthShell';

const LOGIN_TIMEOUT_MS = 15000;

export function Login({ api, onSignedIn, defaultError = '' }: { api: Api; onSignedIn: (s: Session) => void; defaultError?: string }) {
  const [err, setErr] = useState(defaultError); const [show, setShow] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (busy) return;
    // 모바일 자동완성은 입력 이벤트 없이 값만 채우는 경우가 있어, 상태값 대신 화면(DOM)의 실제 값을 읽는다
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? ''), pw = String(fd.get('password') ?? '');
    setBusy(true); setErr('');
    const timeout = new Promise<{ error: string; session: null }>(res => setTimeout(() => res({ error: '응답이 없어요. 네트워크를 확인하고 다시 시도해 주세요', session: null }), LOGIN_TIMEOUT_MS));
    try {
      const r = await Promise.race([api.signIn(email, pw), timeout]);
      if (r.error) setErr(r.error);
      else if (r.session) onSignedIn(r.session);          // 세션 변화 통지만 기다리지 않고 바로 화면 전환
    } catch (x) { setErr('로그인에 실패했습니다: ' + (x as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <AuthShell title="로그인" lead="정산 사이트와 같은 계정으로 로그인합니다.">
      <form onSubmit={submit} noValidate={false}>
        <label className="field"><span>이메일</span>
          <input name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" required /></label>
        <div className="field"><label htmlFor="login-pw">비밀번호</label>
          <div className="pw-wrap">
            <input id="login-pw" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" enterKeyHint="go" required />
            <button type="button" className="pw-toggle" aria-pressed={show} onClick={() => setShow(v => !v)}>{show ? '숨기기' : '보기'}</button>
          </div></div>
        {err && <p className="err" role="alert">{err}</p>}
        <button type="submit" className="primary block" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
        <p className="fine">비밀번호 변경·분실은 <a href={SETTLE_URL} target="_blank" rel="noopener noreferrer">정산 사이트</a>에서 해 주세요.</p>
      </form>
    </AuthShell>
  );
}

export function Notice({ title, children, onLogout, onRetry }: { title: string; children: ReactNode; onLogout: () => void; onRetry?: () => void }) {
  return (
    <AuthShell title={title}>
      <div className="body">{children}</div>
      <div className="auth-actions">
        {onRetry && <button className="primary block" onClick={onRetry}>다시 시도</button>}
        <button className="quiet" onClick={onLogout}>로그아웃</button>
      </div>
    </AuthShell>
  );
}
