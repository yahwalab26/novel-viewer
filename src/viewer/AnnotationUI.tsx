import { useState } from 'react';
import type { Annotation, Book } from '../core/model';
import { segments } from './anchor';

export const COLORS: Annotation['color'][] = ['yellow', 'green', 'pink', 'blue'];
const LABEL: Record<string, string> = { yellow: '노랑', green: '초록', pink: '분홍', blue: '파랑' };

export const renderSegs = (text: string, anns?: Annotation[]) =>
  segments(text, anns).map((s, i) => s.ann
    ? <mark key={i} data-a={s.ann.id} className={`hl hl-${s.ann.color}${s.ann.memo ? ' memo' : ''}`}>{s.text}</mark> : s.text);

export function SelectionBar({ onColor, onMemo, note }: { onColor: (c: Annotation['color']) => void; onMemo: () => void; note?: string }) {
  return <div className="selbar" role="toolbar" aria-label="형광펜" onClick={e => e.stopPropagation()} onMouseDown={e => e.preventDefault()}>
    {COLORS.map(c => <button key={c} className={`dot hl-${c}`} aria-label={`${LABEL[c]} 형광펜`} onClick={() => onColor(c)} />)}
    <button className="memo-btn" onClick={onMemo}>메모</button>{note && <small className="selnote">{note}</small>}</div>;
}

export function MemoSheet({ ann, isNew, onSave, onDelete, onClose }: { ann: Annotation; isNew: boolean; onSave: (a: Annotation) => void; onDelete: () => void; onClose: () => void }) {
  const [memo, setMemo] = useState(ann.memo ?? ''); const [color, setColor] = useState(ann.color);
  return <div className="panel sheet" role="dialog" aria-label="메모" onClick={e => e.stopPropagation()}>
    <div className="phead"><b>{isNew ? '메모 추가' : '메모·형광펜'}</b><button className="link" onClick={onClose}>닫기</button></div>
    <div className="pbody">
      <blockquote className="quote">{ann.quote}</blockquote>
      <div className="colors">{COLORS.map(c => <button key={c} className={`dot hl-${c}${c === color ? ' sel' : ''}`} aria-label={LABEL[c]} onClick={() => setColor(c)} />)}</div>
      <textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="메모를 입력하세요 (선택)" rows={4} autoFocus={isNew} />
      <div className="actions">
        {!isNew && <button className="danger" onClick={() => { if (confirm('이 형광펜과 메모를 삭제할까요?')) onDelete(); }}>삭제</button>}
        <button className="primary" onClick={() => onSave({ ...ann, color, memo: memo.trim() || undefined, updatedAt: Date.now() })}>저장</button></div>
    </div></div>;
}

export function NotesPanel({ book, anns, onGo, onClose }: { book: Book; anns: Annotation[]; onGo: (ci: number, bi: number) => void; onClose: () => void }) {
  const order = (a: Annotation) => book.chapters.findIndex(c => c.id === a.chapterId) * 1e6 + a.blockIndex * 1e3 + a.start / 1e3;
  const list = [...anns].sort((x, y) => order(x) - order(y));
  return <div className="panel toc" role="dialog" aria-label="메모 목록" onClick={e => e.stopPropagation()}>
    <div className="phead"><b>메모·형광펜 ({list.length})</b><button className="link" onClick={onClose}>닫기</button></div>
    <ol className="pbody">{list.length === 0 && <li className="hint">글을 길게 눌러 선택하면 형광펜과 메모를 남길 수 있어요.</li>}
      {list.map(a => { const ci = book.chapters.findIndex(c => c.id === a.chapterId); return <li key={a.id}>
        <button onClick={() => onGo(ci, a.blockIndex)}><span><mark className={`hl hl-${a.color}`}>{a.quote.length > 60 ? a.quote.slice(0, 60) + '…' : a.quote}</mark>
          {a.memo && <span className="note">{a.memo}</span>}</span><small>{book.chapters[ci]?.title}</small></button></li>; })}</ol></div>;
}
