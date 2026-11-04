import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createApi } from './server/api';
import type { Access } from './server/access';
import EditorHome from './EditorHome';
import { AccountBar, Login, Notice } from './Auth';

const api = createApi();
type State = { phase: 'loading' } | { phase: 'out' } | { phase: 'in'; email: string; access: Access };

export default function App() {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const uid = useRef<string | null>(null);

  const apply = useCallback(async (s: Session | null) => {
    if (!s) { uid.current = null; setState({ phase: 'out' }); return; }
    if (uid.current === s.user.id) return;                 // 토큰 갱신 등으로 같은 사용자가 반복 통지돼도 다시 불러오지 않음
    uid.current = s.user.id; setState({ phase: 'loading' });
    setState({ phase: 'in', email: s.user.email ?? '', access: await api.loadAccess(s.user.id) });
  }, []);
  useEffect(() => {
    api.session().then(apply);
    const { data: { subscription } } = api.onAuth(s => setTimeout(() => apply(s), 0));   // 콜백 안에서 직접 서버 호출 금지(교착 방지)
    return () => subscription.unsubscribe();
  }, [apply]);

  const logout = () => { api.signOut(); };
  const retry = () => { uid.current = null; api.session().then(apply); };

  if (state.phase === 'loading') return <main className="auth"><p className="sub">불러오는 중…</p></main>;
  if (state.phase === 'out') return <Login api={api} />;
  const a = state.access;
  switch (a.kind) {
    case 'editor': return <EditorHome api={api} account={{ name: a.name, email: a.email || state.email, role: 'editor' }} onLogout={logout} />;
    case 'author': return (
      <main className="lib">
        <AccountBar account={{ name: a.name, email: a.email || state.email, role: 'author' }} onLogout={logout} />
        <h1>내 원고</h1>
        <div className="drop"><p>배정된 원고가 없습니다</p><small>편집자가 원고를 배정하면 여기에 나타납니다 (열람 기능은 다음 단계에서 추가됩니다)</small></div>
        <footer className="ver">웹소설 뷰어 v{__APP_VERSION__}</footer>
      </main>);
    case 'none': return <Notice title="이용 권한이 없습니다" onLogout={logout}>이 계정({state.email})은 아직 뷰어 권한이 없습니다. 편집자에게 권한 부여를 요청해 주세요.</Notice>;
    case 'schema-not-exposed': return <Notice title="서버 설정이 필요합니다" onLogout={logout} onRetry={retry}>
      Supabase의 <b>Project Settings → API → Exposed schemas</b>에 <code>viewer</code>를 추가한 뒤 다시 시도해 주세요.</Notice>;
    default: return <Notice title="서버 연결 오류" onLogout={logout} onRetry={retry}>{a.message}</Notice>;
  }
}
