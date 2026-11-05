import { useDeferredValue, useMemo, useState } from 'react';
import type { Book, Bookmark } from '../core/model';
import { searchBook } from '../core/search';

type Tab = 'toc' | 'bookmarks' | 'search';
interface Props { book: Book; ci: number; bookmarks: Bookmark[]; onChapter: (i: number) => void; onGo: (ci: number, bi: number) => void; onDeleteBookmark: (id: string) => void; onClose: () => void }

/** 목차 · 북마크 · 본문 검색을 한 패널에 */
export default function NavPanel({ book, ci, bookmarks, onChapter, onGo, onDeleteBookmark, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('toc');
  const [q, setQ] = useState(''); const dq = useDeferredValue(q);
  const result = useMemo(() => searchBook(book, dq), [book, dq]);
  const bms = useMemo(() => {
    const idx = (b: Bookmark) => book.chapters.findIndex(c => c.id === b.chapterId);
    return [...bookmarks].map(b => ({ b, ci: idx(b) })).filter(x => x.ci >= 0).sort((x, y) => x.ci - y.ci || x.b.blockIndex - y.b.blockIndex);
  }, [bookmarks, book]);

  return (
    <div className="panel toc" role="dialog" aria-label="목차·북마크·검색" onClick={e => e.stopPropagation()}>
      <div className="phead"><div className="ptabs" role="tablist">
        {([['toc', '목차'], ['bookmarks', `북마크${bookmarks.length ? ' ' + bookmarks.length : ''}`], ['search', '검색']] as [Tab, string][]).map(([t, l]) =>
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{l}</button>)}</div>
        <button className="link" onClick={onClose}>닫기</button></div>

      {tab === 'toc' && <ol className="pbody">{book.chapters.map((c, i) => <li key={c.id}><button className={i === ci ? 'cur' : ''} onClick={() => onChapter(i)}>
        <span>{c.title}</span><small>{c.charCount.toLocaleString()}자</small></button></li>)}</ol>}

      {tab === 'bookmarks' && <ol className="pbody">
        {bms.length === 0 && <li className="hint">읽다가 위쪽 ★ 버튼을 누르면 지금 위치에 북마크가 생겨요.</li>}
        {bms.map(({ b, ci: i }) => <li key={b.id} className="bmrow">
          <button className="bmgo" onClick={() => onGo(i, b.blockIndex)}><span><b>{book.chapters[i].title}</b>{b.label && <span className="bmlabel">{b.label}</span>}</span></button>
          <button className="bmdel" aria-label={`${book.chapters[i].title} 북마크 삭제`} onClick={() => onDeleteBookmark(b.id)}>삭제</button></li>)}</ol>}

      {tab === 'search' && <div className="pbody searchbody">
        <input type="search" autoFocus placeholder="본문에서 찾기" value={q} onChange={e => setQ(e.target.value)} aria-label="본문 검색" />
        {dq.trim() && <p className="hint">{result.total === 0 ? '검색 결과가 없어요' : result.truncated ? `${result.total}건 중 앞의 ${result.hits.length}건을 보여줘요` : `${result.total}건`}</p>}
        <ol className="hits">{result.hits.map((h, k) => <li key={k}><button onClick={() => onGo(h.ci, h.bi)}>
          <small>{book.chapters[h.ci].title}</small>
          <span>{h.before}<mark className="hl hl-yellow">{h.match}</mark>{h.after}</span></button></li>)}</ol>
      </div>}
    </div>
  );
}
