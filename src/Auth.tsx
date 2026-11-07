import { useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Api } from './server/api';
import type { Account } from './Library';
import { useInstall } from './Install';
import { SETTLE_URL } from './config';

const LOGIN_TIMEOUT_MS = 15000;

export function Login({ api, onSignedIn }: { api: Api; onSignedIn: (s: Session) => void }) {
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
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
    <main className="auth">
      <form className="card-auth" onSubmit={submit}>
        <h1>웹소설 뷰어</h1><p className="sub">계정으로 로그인해 주세요</p>
        <label>이메일<input name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" required /></label>
        <label>비밀번호<input name="password" type="password" autoComplete="current-password" enterKeyHint="go" required /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button type="submit" className="primary" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
        <p className="fine">정산 사이트와 같은 계정(이메일·비밀번호)입니다. 비밀번호 변경·분실은 <a href={SETTLE_URL} target="_blank" rel="noopener noreferrer">정산 사이트</a>에서 해 주세요.</p>
        <p className="ver">v{__APP_VERSION__}</p>
      </form>
    </main>
  );
}

export function AccountBar({ account, onLogout }: { account: Account; onLogout: () => void }) {
  const inst = useInstall();
  return <div className="acct"><span className={`badge ${account.role}`}>{account.role === 'editor' ? '편집자' : '작가'}</span>
    <span className="who">{account.name || account.email}</span>
    {inst.available && <button className="link" onClick={inst.install}>앱 설치</button>}
    <a className="link" href={SETTLE_URL} target="_blank" rel="noopener noreferrer" title="계정과 비밀번호는 정산 사이트에서 관리합니다">비밀번호 변경</a>
    <button className="link" onClick={onLogout}>로그아웃</button></div>;
}

export function Notice({ title, children, onLogout, onRetry }: { title: string; children: ReactNode; onLogout: () => void; onRetry?: () => void }) {
  return <main className="auth"><div className="card-auth"><h1>{title}</h1><div className="notice">{children}</div>
    <div className="row2">{onRetry && <button className="primary" onClick={onRetry}>다시 시도</button>}<button className="link" onClick={onLogout}>로그아웃</button></div>
    <p className="ver">v{__APP_VERSION__}</p></div></main>;
}
