import { useState } from 'react';
import type { Api } from './server/api';
import Library, { type Account } from './Library';
import ServerLibrary from './ServerLibrary';
import { AccountBar } from './Auth';

export default function EditorHome({ api, userId, account, onLogout }: { api: Api; userId: string; account: Account; onLogout: () => void }) {
  const [tab, setTab] = useState<'server' | 'local'>('server');
  return (
    <main className="lib">
      <AccountBar account={account} onLogout={onLogout} api={api} />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'server'} className={tab === 'server' ? 'on' : ''} onClick={() => setTab('server')}>서버 원고</button>
        <button role="tab" aria-selected={tab === 'local'} className={tab === 'local' ? 'on' : ''} onClick={() => setTab('local')}>이 기기에서만</button>
      </div>
      {tab === 'server' ? <ServerLibrary api={api} userId={userId} myName={account.name || account.email} /> : <Library />}
      <footer className="ver">웹소설 뷰어 v{__APP_VERSION__}</footer>
    </main>
  );
}
