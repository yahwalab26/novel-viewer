import type { ReactNode } from 'react';
import { Logo } from './Logo';

/** 로그인·안내·오류·로딩 화면의 공통 틀: 로고 → 제목 → (설명) → 내용, 하단 버전 */
export default function AuthShell({ title, lead, children }: { title?: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-col">
        <div className="brand"><Logo /><span>웹소설 뷰어</span></div>
        {title && <h1>{title}</h1>}
        {lead && <p className="lead">{lead}</p>}
        {children}
      </div>
      <footer className="auth-foot">v{__APP_VERSION__}</footer>
    </main>
  );
}
export const Loading = () => <AuthShell><p className="loading" role="status"><span className="spinner" aria-hidden="true" />불러오는 중…</p></AuthShell>;
