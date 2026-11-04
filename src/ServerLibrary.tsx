import { useCallback, useEffect, useRef, useState } from 'react';
import type { Api } from './server/api';
import type { BookRow } from './server/books';
import type { Book, ReadingState } from './core/model';
import { parseFile, SUPPORTED } from './parsers';
import { useSettings } from './store/useSettings';
import Viewer from './viewer/Viewer';
import AssignPanel from './AssignPanel';
import LibSearch from './LibSearch';
import { filterBooks } from './core/search';

export default function ServerLibrary({ api, userId, myName }: { api: Api; userId: string; myName: string }) {
  const [books, setBooks] = useState<BookRow[] | null>(null);
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [open, setOpen] = useState<{ book: Book; state: ReadingState | null; names: Record<string, string> } | null>(null);
  const [assign, setAssign] = useState<BookRow | null>(null);
  const [query, setQuery] = useState('');
  const [settings, setSettings] = useSettings();
  const input = useRef<HTMLInputElement>(null); const reviseInput = useRef<HTMLInputElement>(null);
  const reviseId = useRef<string | null>(null);

  const refresh = useCallback(async () => { try { setBooks(await api.books.list()); } catch (e) { setMsg((e as Error).message); setBooks([]); } }, [api]);
  useEffect(() => { refresh(); }, [refresh]);

  const upload = async (files: FileList | File[], revise?: string) => {
    setMsg('');
    for (const f of Array.from(files)) {
      setBusy(`${f.name} 올리는 중…`);
      try { const book = await parseFile(f); if (revise) await api.books.uploadRevision(revise, book, f); else await api.books.upload(book, f); }
      catch (e) { setMsg(`${f.name}: ${(e as Error).message}`); }
    }
    setBusy(''); refresh();
  };
  const read = async (id: string) => {
    try {
      const authors = await api.books.authors().catch(() => []);
      const names: Record<string, string> = { [userId]: myName, ...Object.fromEntries(authors.map(a => [a.id, a.name || a.email])) };
      setOpen({ book: await api.books.get(id), state: await api.repo.getState(id), names });
    } catch (e) { setMsg((e as Error).message); }
  };

  if (open) return <Viewer repo={api.repo} meId={userId} names={open.names} book={open.book} state={open.state} settings={settings} onSettings={setSettings}
    onProgress={s => api.repo.saveState(s)} onClose={() => setOpen(null)} />;

  return (
    <section onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files); }}>
      <header className="lib-head"><h1>서버 원고</h1>
        <button className="primary" disabled={!!busy} onClick={() => input.current?.click()}>{busy || '+ 원고 올리기'}</button>
        <input ref={input} type="file" hidden multiple accept=".epub,.docx,.hwpx" onChange={e => { if (e.target.files) upload(e.target.files); e.target.value = ''; }} />
        <input ref={reviseInput} type="file" hidden accept=".epub,.docx,.hwpx" onChange={e => { if (e.target.files && reviseId.current) upload(e.target.files, reviseId.current); e.target.value = ''; }} />
      </header>
      {msg && <p className="err" role="alert">{msg}</p>}
      <LibSearch count={books?.length ?? 0} value={query} onChange={setQuery} />
      {books === null ? <p className="sub">불러오는 중…</p> : books.length === 0 ? (
        <div className="drop"><p>서버에 올린 원고가 없습니다<br />‘원고 올리기’를 눌러 {SUPPORTED.join(' · ').toUpperCase()} 파일을 올려주세요</p>
          <small>올린 원고는 배정한 작가에게만 보입니다</small></div>
      ) : (
        <ul className="books">{filterBooks(books, query, b => [b.title, b.author_name]).map(b => {
          const shared = (b.assignments ?? []).filter(a => a.enabled).length, total = (b.assignments ?? []).length;
          return <li key={b.id}><div className="card static">
            <button className="titlebtn" onClick={() => read(b.id)}><strong>{b.title}</strong></button>
            <span>{b.author_name ?? '작가 미상'} · {b.format.toUpperCase()} · {b.current_revision > 1 ? `개정 ${b.current_revision}` : '초판'}</span>
            <span>{b.chapter_count}회차 · {(b.char_count / 1000).toFixed(1)}천자</span>
            <span className={shared ? 'share on' : 'share'}>{total === 0 ? '배정된 작가 없음' : `공유 ${shared}명 / 배정 ${total}명`}</span>
            <div className="cardbtns">
              <button onClick={() => read(b.id)}>읽기</button>
              <button onClick={() => setAssign(b)}>작가·공유</button>
              <button onClick={() => { reviseId.current = b.id; reviseInput.current?.click(); }}>개정본</button>
              <button className="dangertxt" onClick={async () => { if (confirm(`‘${b.title}’을 서버에서 삭제할까요?\n작가들의 형광펜·메모도 함께 삭제됩니다.`)) { try { await api.books.remove(b.id); } catch (e) { setMsg((e as Error).message); } refresh(); } }}>삭제</button>
            </div></div></li>; })}</ul>
      )}
      {assign && <AssignPanel api={api} book={assign} onClose={() => { setAssign(null); refresh(); }} />}
    </section>
  );
}
