import { useCallback, useEffect, useRef, useState } from 'react';
import type { Api } from './server/api';
import type { BookRow as Row } from './server/books';
import type { Book, ReadingState } from './core/model';
import { parseFile, SUPPORTED } from './parsers';
import { useSettings } from './store/useSettings';
import Viewer from './viewer/Viewer';
import AssignPanel from './AssignPanel';
import LibSearch from './LibSearch';
import { filterBooks } from './core/search';
import { progressOf } from './core/progress';
import BookRow from './ui/BookRow';
import Empty from './ui/Empty';
import ActionMenu from './ui/ActionMenu';
import { DropOverlay, useFileDrop } from './ui/useFileDrop';

export default function ServerLibrary({ api, userId, myName }: { api: Api; userId: string; myName: string }) {
  const [books, setBooks] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [open, setOpen] = useState<{ book: Book; state: ReadingState | null; names: Record<string, string> } | null>(null);
  const [assign, setAssign] = useState<Row | null>(null);
  const [query, setQuery] = useState('');
  const [states, setStates] = useState<Map<string, ReadingState>>(new Map());
  const [settings, setSettings] = useSettings();
  const input = useRef<HTMLInputElement>(null); const reviseInput = useRef<HTMLInputElement>(null);
  const reviseId = useRef<string | null>(null);

  const refresh = useCallback(async () => { try { setBooks(await api.books.list()); } catch (e) { setMsg((e as Error).message); setBooks([]); } }, [api]);
  const loadStates = useCallback(() => { api.repo.listStates().then(l => setStates(new Map(l.map(x => [x.bookId, x])))).catch(() => {}); }, [api]);
  useEffect(() => { refresh(); loadStates(); }, [refresh, loadStates]);

  const upload = async (files: FileList | File[], revise?: string) => {
    setMsg('');
    for (const f of Array.from(files)) {
      setBusy(`${f.name} 올리는 중…`);
      try { const book = await parseFile(f); if (revise) await api.books.uploadRevision(revise, book, f); else await api.books.upload(book, f); }
      catch (e) { setMsg(`${f.name}: ${(e as Error).message}`); }
    }
    setBusy(''); refresh();
  };
  const dragging = useFileDrop(files => upload(files), !open && !assign && !busy);     // 화면 어디에 놓아도 업로드
  const read = async (id: string) => {
    try {
      const authors = await api.books.authors().catch(() => []);
      const names: Record<string, string> = { [userId]: myName, ...Object.fromEntries(authors.map(a => [a.id, a.name || a.email])) };
      setOpen({ book: await api.books.get(id), state: await api.repo.getState(id), names });
    } catch (e) { setMsg((e as Error).message); }
  };

  if (open) return <Viewer repo={api.repo} meId={userId} names={open.names} book={open.book} state={open.state} settings={settings} onSettings={setSettings}
    onProgress={s => api.repo.saveState(s)} onClose={() => { setOpen(null); loadStates(); }} />;

  const visible = books ? filterBooks(books, query, b => [b.title, b.author_name]) : [];
  return (
    <section className="lb">
      <DropOverlay show={dragging}>놓으면 원고가 올라가요</DropOverlay>
      <div className="lb-head">
        <h2 className="lb-title">원고{books && <span className="count">{books.length}편</span>}</h2>
        <button type="button" className="primary" disabled={!!busy} onClick={() => input.current?.click()}>{busy ? <><span className="spinner on-dark" aria-hidden="true" />올리는 중</> : '원고 올리기'}</button>
        <input ref={input} type="file" hidden multiple accept=".epub,.docx,.hwpx,.hwp" onChange={e => { if (e.target.files) upload(e.target.files); e.target.value = ''; }} />
        <input ref={reviseInput} type="file" hidden accept=".epub,.docx,.hwpx,.hwp" onChange={e => { if (e.target.files && reviseId.current) upload(e.target.files, reviseId.current); e.target.value = ''; }} />
      </div>
      {busy && <p className="lb-note" role="status">{busy}</p>}
      {msg && <p className="err" role="alert">{msg}</p>}
      <LibSearch count={books?.length ?? 0} value={query} onChange={setQuery} />
      {books === null ? <p className="loading"><span className="spinner" aria-hidden="true" />불러오는 중…</p>
        : books.length === 0 ? <Empty title="아직 올린 원고가 없어요">원고 올리기를 누르거나 파일을 이 화면에 끌어놓으세요. {SUPPORTED.join(', ').toUpperCase()} 파일을 올릴 수 있고, 올린 원고는 배정한 작가에게만 보입니다.</Empty>
        : visible.length === 0 ? <Empty title="찾는 원고가 없어요">검색어를 바꿔 보세요.</Empty>
        : <ul className="bk-list">{visible.map(b => {
            const as = b.assignments ?? [], shared = as.filter(a => a.enabled).length;
            const status = as.length === 0 ? { on: false, text: '배정된 작가 없음' } : shared === 0 ? { on: false, text: `공유 꺼짐 (배정 ${as.length}명)` } : { on: true, text: `${shared}명에게 공유 중` };
            return <BookRow key={b.id} title={b.title} byline={b.author_name ?? '작가 미상'} chips={[b.format.toUpperCase(), ...(b.current_revision > 1 ? [`개정 ${b.current_revision}`] : [])]}
              facts={[`${b.chapter_count}회차`, `${b.char_count.toLocaleString()}자`]} progress={progressOf(states.get(b.id), b.chapter_count)} status={status} onOpen={() => read(b.id)}
              actions={<>
                <button type="button" className="bk-act" onClick={() => setAssign(b)}>작가·공유</button>
                <ActionMenu label="더보기" items={[
                  { label: '개정본 올리기', onSelect: () => { reviseId.current = b.id; reviseInput.current?.click(); } },
                  { label: '삭제', danger: true, onSelect: async () => { if (confirm(`‘${b.title}’을 서버에서 삭제할까요?\n작가들의 형광펜·메모도 함께 삭제되고 되돌릴 수 없습니다.`)) { try { await api.books.remove(b.id); } catch (e) { setMsg((e as Error).message); } refresh(); } } },
                ]} /></>} />; })}</ul>}
      {assign && <AssignPanel api={api} book={assign} onClose={() => { setAssign(null); refresh(); }} />}
    </section>
  );
}
