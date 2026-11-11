import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useDismiss } from './useDismiss';
import { Logo } from './Logo';
import { SETTLE_URL } from '../config';
import { useInstall } from '../Install';

export interface Account { name: string; email: string; role: 'editor' | 'author' }

/** 상단 계정 메뉴: 이름을 누르면 계정 정보·비밀번호 변경(정산 사이트)·앱 설치·로그아웃 */
export function AccountMenu({ account, onLogout }: { account: Account; onLogout: () => void }) {
  const [open, setOpen] = useState(false); const box = useRef<HTMLDivElement>(null); const btn = useRef<HTMLButtonElement>(null); const inst = useInstall();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, box, btn);
  const label = account.name || account.email;
  return (
    <div className="acct-wrap" ref={box}>
      <button ref={btn} type="button" className="acct-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span>{label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-id"><b>{label}</b><small>{account.email}</small><span className={'chip' + (account.role === 'editor' ? ' solid' : '')}>{account.role === 'editor' ? '편집자' : '작가'}</span></div>
          <a role="menuitem" className="item" href={SETTLE_URL} target="_blank" rel="noopener noreferrer">비밀번호 변경<small>정산 사이트에서 변경합니다</small></a>
          {inst.available && <button type="button" role="menuitem" className="item" onClick={() => { setOpen(false); inst.install(); }}>앱으로 설치</button>}
          <button type="button" role="menuitem" className="item" onClick={onLogout}>로그아웃</button>
        </div>
      )}
    </div>
  );
}

/** 로그인 후 화면의 공통 틀: 상단 바(로고·계정) + 본문 + 하단 버전 */
export default function AppShell({ account, onLogout, children }: { account: Account; onLogout: () => void; children: ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar"><div className="topbar-in">
        <div className="brand sm"><Logo size={20} /><span>웹소설 뷰어</span></div>
        <AccountMenu account={account} onLogout={onLogout} />
      </div></header>
      <main className="page">{children}</main>
      <footer className="auth-foot">v{__APP_VERSION__}</footer>
    </div>
  );
}
