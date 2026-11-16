import { useState } from 'react';
import { useRoute } from './core/route';
import type { Api } from './server/api';
import Library from './Library';
import ServerLibrary from './ServerLibrary';
import AppShell, { type Account } from './ui/AppShell';

export default function EditorHome({ api, userId, account, onLogout, initialTab = 'server' }: { api: Api; userId: string; account: Account; onLogout: () => void; initialTab?: 'server' | 'local' }) {
  const route = useRoute();
  const [picked, setTab] = useState<'server' | 'local'>(initialTab);
  const tab = route?.scope === 'l' ? 'local' : route?.scope === 's' ? 'server' : picked;   // 읽는 중인 원고의 탭을 따른다(새로고침해도 같은 탭)
  return (
    <AppShell account={account} onLogout={onLogout}>
      <div className="page-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'server'} className={tab === 'server' ? 'on' : ''} onClick={() => setTab('server')}>서버 원고</button>
        <button role="tab" aria-selected={tab === 'local'} className={tab === 'local' ? 'on' : ''} onClick={() => setTab('local')}>이 기기에서만</button>
      </div>
      {tab === 'server' ? <ServerLibrary api={api} userId={userId} myName={account.name || account.email} /> : <Library />}
    </AppShell>
  );
}
