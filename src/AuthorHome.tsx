import { useCallback, useEffect, useState } from 'react';
import type { Api } from './server/api';
import type { BookRow } from './server/books';
import type { Book, ReadingState } from './core/model';
import { useSettings } from './store/useSettings';
import Viewer from './viewer/Viewer';
import { AccountBar } from './Auth';
import type { Account } from './Library';
import LibSearch from './LibSearch';
import { filterBooks } from './core/search';

/** 작가 화면: 편집자가 배정하고 공유를 켠 원고만 목록에 나온다(서버 RLS). 업로드·삭제 없음. */
export default function AuthorHome({ api, userId, account, onLogout }: { api: Api; userId: string; account: Account; onLogout: () => void }) {
  const [books, setBooks] = useState<BookRow[] | null>(null);
  const [copy, setCopy] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState(''); const [query, setQuery] = useState('');
  const [open, setOpen] = useState<{ book: Book; state: ReadingState | null; allowCopy: boolean } | null>(null);
  const [settings, setSettings] = useSettings();

  const refresh = useCallback(async () => {
    try {
      const [list, mine] = await Promise.all([api.books.list(), api.books.myAssignments()]);
      setCopy(Object.fromEntries(mine.map(m => [m.book_id, m.allow_copy]))); setBooks(list);
    } catch (e) { setMsg((e as Error).message); setBooks([]); }
  }, [api]);
  useEffect(() => { refresh(); }, [refresh]);

  const read = async (id: string) => {
    setMsg('');
    try { setOpen({ book: await api.books.get(id), state: await api.repo.getState(id), allowCopy: !!copy[id] }); }
    catch (e) { setMsg('공유가 중단되었거나 열 수 없는 원고입니다'); refresh(); }
  };

  if (open) return <Viewer repo={api.repo} meId={userId} protect={!open.allowCopy} book={open.book} state={open.state}
    settings={settings} onSettings={setSettings} onProgress={s => api.repo.saveState(s)} onClose={() => { setOpen(null); refresh(); }} />;

  return (
    <main className="lib">
      <AccountBar account={account} onLogout={onLogout} api={api} />
      <header className="lib-head"><h1>내 원고</h1><button className="link" onClick={refresh}>새로고침</button></header>
      {msg && <p className="err" role="alert">{msg}</p>}
      <LibSearch count={books?.length ?? 0} value={query} onChange={setQuery} />
      {books === null ? <p className="sub">불러오는 중…</p> : books.length === 0 ? (
        <div className="drop"><p>배정된 원고가 없습니다</p><small>편집자가 원고를 배정하고 공유를 켜면 여기에 나타납니다</small></div>
      ) : (
        <ul className="books">{filterBooks(books, query, b => [b.title]).map(b => (
          <li key={b.id}><button className="card" onClick={() => read(b.id)}>
            <strong>{b.title}</strong>
            <span>{b.format.toUpperCase()} · {b.current_revision > 1 ? `개정 ${b.current_revision}` : '초판'}</span>
            <span>{b.chapter_count}회차 · {(b.char_count / 1000).toFixed(1)}천자</span></button></li>))}</ul>
      )}
      <footer className="ver">웹소설 뷰어 v{__APP_VERSION__}</footer>
    </main>
  );
}
