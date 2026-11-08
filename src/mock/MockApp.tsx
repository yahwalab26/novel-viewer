import type { ReactNode } from 'react';
import { Login, Notice } from '../Auth';
import ErrorBoundary from '../ErrorBoundary';
import { Loading } from '../ui/AuthShell';
import { noneMessage } from '../server/access';

/** 개발 전용 화면 목록(서버 없이 모양 확인): /?mock=login | login-error | loading | none | none-notset | none-disabled | none-failed | schema | error | crash */
const Boom = (): ReactNode => { throw new Error('목업: 화면 오류 예시'); };
const noop = () => {};
export default function MockApp() {
  const which = new URLSearchParams(location.search).get('mock');
  const fakeApi: any = { signIn: async () => ({ error: null, session: null }) };
  switch (which) {
    case 'login-error': return <Login api={fakeApi} onSignedIn={noop} defaultError="이메일 또는 비밀번호가 올바르지 않습니다" />;
    case 'loading': return <Loading />;
    case 'none': return <Notice title="이용 권한이 없습니다" onLogout={noop}>{noneMessage({}, 'author@example.com')}</Notice>;
    case 'none-notset': return <Notice title="이용 권한이 없습니다" onLogout={noop} onRetry={noop}>{noneMessage({ reason: 'not-set-up' }, 'author@example.com')}</Notice>;
    case 'none-disabled': return <Notice title="이용 권한이 없습니다" onLogout={noop} onRetry={noop}>{noneMessage({ reason: 'disabled' }, 'author@example.com')}</Notice>;
    case 'none-failed': return <Notice title="이용 권한이 없습니다" onLogout={noop} onRetry={noop}>{noneMessage({ reason: 'failed', detail: '시간 초과' }, 'author@example.com')}</Notice>;
    case 'schema': return <Notice title="서버 설정이 필요합니다" onLogout={noop} onRetry={noop}>Supabase의 <b>Project Settings → API → Exposed schemas</b>에 <code>viewer</code>를 추가한 뒤 다시 시도해 주세요.</Notice>;
    case 'error': return <Notice title="서버 연결 오류" onLogout={noop} onRetry={noop}>네트워크 연결을 확인해 주세요</Notice>;
    case 'crash': return <ErrorBoundary><Boom /></ErrorBoundary>;
    default: return <Login api={fakeApi} onSignedIn={noop} />;
  }
}
