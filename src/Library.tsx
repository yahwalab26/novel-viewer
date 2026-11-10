import { useCallback, useEffect, useRef, useState } from 'react';
import { parseFile, SUPPORTED } from './parsers';
import { localRepo as repo } from './store/repo';
import { useSettings } from './store/useSettings';
import type { Book, BookSummary, ReadingState } from './core/model';
import Viewer from './viewer/Viewer';
import BookRow from './ui/BookRow';
import Empty from './ui/Empty';
import LibSearch from './LibSearch';
import { filterBooks } from './core/search';

export default function Library() {
  const [list, setList] = useState<BookSummary[]>([]);
  const [open, setOpen] = useState<{ book: Book; state: ReadingState | null } | null>(null);
  const [settings, setSettings] = useSettings();
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null); const [query, setQuery] = useState('');
  const refresh = useCallback(async () => setList(await repo.listBooks()), []);
  useEffect(() => { refresh(); }, [refresh]);

  const add = async (files: FileList | File[]) => {
    setBusy(true); setMsg('');
    for (const f of Array.from(files)) {
      try { await repo.saveBook(await parseFile(f), f); } catch (e) { setMsg(`${f.name}: ${(e as Error).message}`); }
    }
    setBusy(false); refresh();
  };
  const read = async (id: string) => { const book = await repo.getBook(id); if (book) setOpen({ book, state: await repo.getState(id) }); };

  if (open) return <Viewer repo={repo} book={open.book} state={open.state} settings={settings} onSettings={setSettings}
    onProgress={s => repo.saveState(s)} onClose={() => { setOpen(null); refresh(); }} />;
  const visible = filterBooks(list, query, b => [b.title, b.author]);
  return (
    <section className={'lb' + (drag ? ' dragover' : '')} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}>
      <div className="lb-head">
        <h2 className="lb-title">이 기기의 원고<span className="count">{list.length}편</span></h2>
        <button type="button" className="primary" onClick={() => input.current?.click()} disabled={busy}>{busy ? <><span className="spinner on-dark" aria-hidden="true" />추가하는 중</> : '파일 추가'}</button>
        <input ref={input} type="file" hidden multiple accept=".epub,.docx,.hwpx,.hwp" onChange={e => { if (e.target.files) add(e.target.files); e.target.value = ''; }} />
      </div>
      <p className="lb-note">이 브라우저에만 저장되고 서버에는 올라가지 않습니다.</p>
      {msg && <p className="err" role="alert">{msg}</p>}
      <LibSearch count={list.length} value={query} onChange={setQuery} />
      {list.length === 0 ? <Empty title="이 기기에 저장된 원고가 없어요">파일 추가를 누르거나 파일을 이 화면에 끌어놓으세요. {SUPPORTED.join(', ').toUpperCase()} 파일을 읽을 수 있습니다.</Empty>
        : visible.length === 0 ? <Empty title="찾는 원고가 없어요">검색어를 바꿔 보세요.</Empty>
        : <ul className="bk-list">{visible.map(b => (
            <BookRow key={b.id} title={b.title} byline={b.author ?? '작가 미상'} chips={[b.format.toUpperCase()]} facts={[`${b.chapterCount}회차`, `${b.charCount.toLocaleString()}자`]} onOpen={() => read(b.id)}
              actions={<button type="button" className="bk-act danger" aria-label={`${b.title} 삭제`} onClick={async () => { if (confirm(`‘${b.title}’을 이 기기에서 삭제할까요?`)) { await repo.deleteBook(b.id); refresh(); } }}>삭제</button>} />))}</ul>}
    </section>
  );
}
