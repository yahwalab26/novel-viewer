import { useCallback, useEffect, useState } from 'react';
import { back, clear, navigate, readHash, useRoute } from './core/route';
import type { Api } from './server/api';
import type { BookRow as Row } from './server/books';
import type { Book, ReadingState } from './core/model';
import { useSettings } from './store/useSettings';
import Viewer from './viewer/Viewer';
import LibSearch from './LibSearch';
import { filterBooks } from './core/search';
import { byRecentRead, progressOf } from './core/progress';
import AppShell, { type Account } from './ui/AppShell';
import BookRow from './ui/BookRow';
import Empty from './ui/Empty';

/** 작가 화면: 편집자가 배정하고 공유를 켠 원고만 목록에 나온다(서버 RLS). 최근에 읽은 원고가 위에. */
export default function AuthorHome({ api, userId, account, onLogout }: { api: Api; userId: string; account: Account; onLogout: () => void }) {
  const [books, setBooks] = useState<Row[] | null>(null);
  const [copy, setCopy] = useState<Record<string, boolean>>({});
  const [states, setStates] = useState<Map<string, ReadingState>>(new Map());
  const [msg, setMsg] = useState(''); const [query, setQuery] = useState('');
  const [open, setOpen] = useState<{ book: Book; state: ReadingState | null; allowCopy: boolean } | null>(null);
  const [settings, setSettings] = useSettings();
  const route = useRoute(); const rid = route?.scope === 's' ? route.id : null;     // 주소에 기록된 읽는 중인 원고

  const refresh = useCallback(async () => {
    try {
      const [list, mine, st] = await Promise.all([api.books.list(), api.books.myAssignments(), api.repo.listStates()]);
      setCopy(Object.fromEntries(mine.map(m => [m.book_id, m.allow_copy]))); setStates(new Map(st.map(s => [s.bookId, s]))); setBooks(list);
    } catch (e) { setMsg((e as Error).message); setBooks([]); }
  }, [api]);
  useEffect(() => { refresh(); }, [refresh]);

  // 주소가 읽기(#/read/s/<id>)면 목록·배정(복사 허용 여부 포함)을 다 불러온 뒤에 연다 — 모르는 상태로 열면 복사 방지가 어긋난다
  useEffect(() => {
    if (!rid) { setOpen(null); return; }
    if (books === null || open?.book.id === rid) return;
    let alive = true; setMsg('');
    (async () => {
      try { const book = await api.books.get(rid), state = await api.repo.getState(rid); if (alive) setOpen({ book, state, allowCopy: !!copy[rid] }); }
      catch { if (alive) { setMsg('공유가 중단되었거나 열 수 없는 원고입니다'); clear(); refresh(); } }
    })();
    return () => { alive = false; };
  }, [rid, books]); // eslint-disable-line react-hooks/exhaustive-deps
  const read = (id: string) => navigate(readHash('s', id));

  if (rid && !open) return <AppShell account={account} onLogout={onLogout}><p className="loading"><span className="spinner" aria-hidden="true" />불러오는 중…</p></AppShell>;
  if (open && rid) return <Viewer repo={api.repo} meId={userId} protect={!open.allowCopy} book={open.book} state={open.state}
    settings={settings} onSettings={setSettings} onProgress={s => api.repo.saveState(s)} onClose={() => { back(); refresh(); }} />;

  const visible = books ? byRecentRead(filterBooks(books, query, b => [b.title]), states) : [];
  return (
    <AppShell account={account} onLogout={onLogout}>
      <div className="lb-head"><h1 className="lb-title">내 원고{books && <span className="count">{books.length}편</span>}</h1><button type="button" className="link" onClick={refresh}>새로고침</button></div>
      {msg && <p className="err" role="alert">{msg}</p>}
      <LibSearch count={books?.length ?? 0} value={query} onChange={setQuery} />
      {books === null ? <p className="loading"><span className="spinner" aria-hidden="true" />불러오는 중…</p>
        : books.length === 0 ? <Empty title="배정된 원고가 없어요">편집자가 원고를 배정하고 공유를 켜면 여기에 나타납니다.</Empty>
        : visible.length === 0 ? <Empty title="찾는 원고가 없어요">검색어를 바꿔 보세요.</Empty>
        : <ul className="bk-list">{visible.map(b => (
            <BookRow key={b.id} title={b.title} chips={[b.format.toUpperCase(), ...(b.current_revision > 1 ? [`개정 ${b.current_revision}`] : [])]}
              facts={[`${b.chapter_count}회차`, `${b.char_count.toLocaleString()}자`]} progress={progressOf(states.get(b.id), b.chapter_count)} onOpen={() => read(b.id)} />))}</ul>}
    </AppShell>
  );
}
