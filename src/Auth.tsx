import { useState, type ReactNode } from 'react';
import type { Api } from './server/api';
import type { Account } from './Library';

export function Login({ api }: { api: Api }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    setErr((await api.signIn(email, pw)) ?? ''); setBusy(false);       // 성공하면 App이 세션 변화를 감지해 화면 전환
  };
  return (
    <main className="auth">
      <form className="card-auth" onSubmit={submit}>
        <h1>웹소설 뷰어</h1><p className="sub">계정으로 로그인해 주세요</p>
        <label>이메일<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>비밀번호<input type="password" autoComplete="current-password" required value={pw} onChange={e => setPw(e.target.value)} /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="primary" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
        <p className="ver">v{__APP_VERSION__}</p>
      </form>
    </main>
  );
}

export function AccountBar({ account, onLogout }: { account: Account; onLogout: () => void }) {
  return <div className="acct"><span className={`badge ${account.role}`}>{account.role === 'editor' ? '편집자' : '작가'}</span>
    <span className="who">{account.name || account.email}</span><button className="link" onClick={onLogout}>로그아웃</button></div>;
}

export function Notice({ title, children, onLogout, onRetry }: { title: string; children: ReactNode; onLogout: () => void; onRetry?: () => void }) {
  return <main className="auth"><div className="card-auth"><h1>{title}</h1><div className="notice">{children}</div>
    <div className="row2">{onRetry && <button className="primary" onClick={onRetry}>다시 시도</button>}<button className="link" onClick={onLogout}>로그아웃</button></div>
    <p className="ver">v{__APP_VERSION__}</p></div></main>;
}
