import { useState } from 'react';
import type { Api } from './server/api';
import Library from './Library';
import ServerLibrary from './ServerLibrary';
import AppShell, { type Account } from './ui/AppShell';

export default function EditorHome({ api, userId, account, onLogout, initialTab = 'server' }: { api: Api; userId: string; account: Account; onLogout: () => void; initialTab?: 'server' | 'local' }) {
  const [tab, setTab] = useState<'server' | 'local'>(initialTab);
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
