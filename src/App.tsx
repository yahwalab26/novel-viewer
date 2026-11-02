import { useCallback, useEffect, useRef, useState } from 'react';
import { parseFile, SUPPORTED } from './parsers';
import { localRepo as repo, loadSettings, persistSettings } from './store/repo';
import { DEFAULT_SETTINGS, type ViewerSettings } from './core/settings';
import type { Book, BookSummary, ReadingState } from './core/model';
import Viewer from './viewer/Viewer';

export default function App() {
  const [list, setList] = useState<BookSummary[]>([]);
  const [open, setOpen] = useState<{ book: Book; state: ReadingState | null } | null>(null);
  const [settings, setSettings] = useState<ViewerSettings>(() => loadSettings(DEFAULT_SETTINGS));
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => setList(await repo.listBooks()), []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => persistSettings(settings), [settings]);

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
  return (
    <main className="lib" onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}>
      <header><h1>내 서재</h1>
        <button className="primary" onClick={() => input.current?.click()} disabled={busy}>{busy ? '등록 중…' : '+ 원고 등록'}</button>
        <input ref={input} type="file" hidden multiple accept=".epub,.docx,.hwpx,.hwp" onChange={e => e.target.files && add(e.target.files)} />
      </header>
      {msg && <p className="err" role="alert">{msg}</p>}
      {list.length === 0 ? (
        <div className={'drop' + (drag ? ' on' : '')}><p>EPUB · DOCX 파일을 끌어놓거나<br />‘원고 등록’을 눌러주세요</p>
          <small>지원 예정: HWPX, HWP · 파일은 이 기기 안에만 저장됩니다 (지금 지원: {SUPPORTED.join(', ')})</small></div>
      ) : (
        <ul className="books">{list.map(b => (
          <li key={b.id}><button className="card" onClick={() => read(b.id)}>
            <strong>{b.title}</strong><span>{b.author ?? '작가 미상'} · {b.format.toUpperCase()}</span>
            <span>{b.chapterCount}회차 · {(b.charCount / 1000).toFixed(1)}천자</span></button>
            <button className="ghost" aria-label={`${b.title} 삭제`} onClick={async () => { if (confirm(`‘${b.title}’을 삭제할까요?`)) { await repo.deleteBook(b.id); refresh(); } }}>삭제</button></li>))}</ul>
      )}
    <footer className="ver">웹소설 뷰어 v{__APP_VERSION__}</footer>
    </main>
  );
}
