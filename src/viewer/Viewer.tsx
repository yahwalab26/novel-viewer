import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Annotation, AnnotationStore, Book, ReadingState } from '../core/model';
import { readSelection, type Picked } from './selection';
import { filterAnns, installProtection, isMine } from './protect';
import { MemoSheet, NotesPanel, SelectionBar, renderSegs } from './AnnotationUI';
import type { ViewerSettings } from '../core/settings';
import SettingsPanel from './SettingsPanel';
import { THEME_COLORS, FONT_SIZES, FONTS, WIDTHS, LH_DEFAULT, GAP_DEFAULT } from './theme';

interface Props { repo: AnnotationStore; meId?: string; names?: Record<string, string>; protect?: boolean; book: Book; state: ReadingState | null; settings: ViewerSettings; onSettings: (s: ViewerSettings) => void; onProgress: (s: ReadingState) => void; onClose: () => void }

export default function Viewer({ repo, meId, names, protect, book, state, settings: s, onSettings, onProgress, onClose }: Props) {
  const [ci, setCi] = useState(() => Math.max(0, book.chapters.findIndex(c => c.id === state?.chapterId)));
  const [bar, setBar] = useState(true);
  const [panel, setPanel] = useState<null | 'settings' | 'toc' | 'notes'>(null);
  const [page, setPage] = useState(0); const [pages, setPages] = useState(1);
  const [tick, setTick] = useState(0);
  const [anns, setAnns] = useState<Annotation[]>([]);
  const [sel, setSel] = useState<null | Picked>(null);
  const [edit, setEdit] = useState<null | { ann: Annotation; isNew: boolean; readOnly?: boolean }>(null);
  const [who, setWho] = useState('all');                  // 표시할 형광펜: all | mine | 작가 id
  const [now, setNow] = useState(() => new Date());
  const wrap = useRef<HTMLDivElement>(null); const flow = useRef<HTMLDivElement>(null);
  const stride = useRef(1); const pending = useRef(state?.blockIndex ?? 0); const goLast = useRef(false);
  const ch = book.chapters[ci]; const scroll = s.mode === 'scroll';
  const set = (p: Partial<ViewerSettings>) => onSettings({ ...s, ...p });

  const lastChapter = ci >= book.chapters.length - 1;
  const moveChapter = useCallback((d: number, last = false) => {
    const n = ci + d; if (n < 0 || n >= book.chapters.length) return;
    pending.current = 0; goLast.current = last; setPage(0); setCi(n);
  }, [ci, book.chapters.length]);

  // ── 쪽 나누기 (page 모드): CSS columns를 JS로 계산
  useLayoutEffect(() => {
    if (scroll || !wrap.current || !flow.current) return;
    const w = wrap.current, f = flow.current, cs = getComputedStyle(w);
    const padX = parseFloat(cs.paddingLeft), inner = w.clientWidth - padX * 2;
    const n = s.twoPageLandscape && w.clientWidth > w.clientHeight && w.clientWidth > 700 ? 2 : 1;
    const gapPx = padX * 2, colW = (inner - (n - 1) * gapPx) / n;
    f.style.columnWidth = colW + 'px'; f.style.columnGap = gapPx + 'px'; f.style.height = w.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) + 'px';
    stride.current = inner + gapPx;
    const total = Math.max(1, Math.round((f.scrollWidth + gapPx) / stride.current)); setPages(total);
    if (goLast.current) setPage(total - 1);
    else if (pending.current > 0) { const el = f.querySelector<HTMLElement>(`[data-i="${pending.current}"]`); setPage(el ? Math.min(Math.floor(el.offsetLeft / stride.current), total - 1) : 0); }
    else setPage(p => Math.min(p, total - 1));
    goLast.current = false; pending.current = 0;
  }, [tick, scroll, ci, s.fontSizeLevel, s.fontFamily, s.lineHeight, s.paragraphGap, s.paragraphWidthLevel, s.align, s.twoPageLandscape, s.mode]);
  useEffect(() => {
    if (scroll || !wrap.current) return;
    const ro = new ResizeObserver(() => setTick(t => t + 1)); ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [scroll]);

  // ── 스크롤 모드: 회차 이동 시 위치 복원
  useEffect(() => {
    if (!scroll || !wrap.current) return;
    const el = pending.current > 0 ? wrap.current.querySelector<HTMLElement>(`[data-i="${pending.current}"]`) : null;
    if (el) el.scrollIntoView(); else wrap.current.scrollTop = goLast.current ? wrap.current.scrollHeight : 0;
    pending.current = 0; goLast.current = false;
  }, [scroll, ci]);

  // ── 진행 저장
  const save = useCallback(() => {
    const f = flow.current ?? wrap.current; if (!f) return;
    const kids = Array.from(f.querySelectorAll<HTMLElement>('[data-i]')); let idx = 0;
    if (scroll) { const top = wrap.current!.getBoundingClientRect().top + 8; idx = Number(kids.find(k => k.getBoundingClientRect().bottom > top)?.dataset.i ?? 0); }
    else idx = Number(kids.find(k => k.offsetLeft >= page * stride.current - 1)?.dataset.i ?? 0);
    onProgress({ bookId: book.id, chapterId: ch.id, blockIndex: idx, updatedAt: Date.now() });
  }, [scroll, page, ch.id, book.id, onProgress]);
  const timer = useRef<number>();
  const later = () => { clearTimeout(timer.current); timer.current = window.setTimeout(save, 500); };
  useEffect(later, [ci, page, scroll]); // eslint-disable-line
  useEffect(() => () => clearTimeout(timer.current), []);

  // ── 이동
  const next = useCallback(() => {
    if (scroll) { const w = wrap.current!; if (w.scrollTop + w.clientHeight >= w.scrollHeight - 4) moveChapter(1); else w.scrollBy({ top: w.clientHeight * 0.9, behavior: 'smooth' }); }
    else if (page < pages - 1) setPage(page + 1); else moveChapter(1);
  }, [scroll, page, pages, moveChapter]);
  const prev = useCallback(() => {
    if (scroll) { const w = wrap.current!; if (w.scrollTop <= 4) moveChapter(-1, true); else w.scrollBy({ top: -w.clientHeight * 0.9, behavior: 'smooth' }); }
    else if (page > 0) setPage(page - 1); else moveChapter(-1, true);
  }, [scroll, page, moveChapter]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('select,input')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); prev(); }
      else if (e.key === 'Escape') panel ? setPanel(null) : setBar(b => !b);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [next, prev, panel]);

  const tap = (e: React.MouseEvent) => {
    if (window.getSelection()?.toString()) return;                  // 선택(형광펜 준비) 중엔 무시
    if (panel) { setPanel(null); return; }
    if (edit) { setEdit(null); return; }
    const mk = (e.target as HTMLElement).closest<HTMLElement>('mark[data-a]');
    if (mk && s.popupAnnotation) { const ann = anns.find(x => x.id === mk.dataset.a); if (ann) { setEdit({ ann, isNew: false, readOnly: !isMine(ann, meId) }); return; } }
    const r = wrap.current!.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (!scroll) {
      if (x < 0.3) return s.tapZones.left === 'prev' ? prev() : next();
      if (x > 0.7) return s.tapZones.right === 'next' ? next() : prev();
      if (s.verticalTapPaging) { if (y < 0.2) return prev(); if (y > 0.8) return next(); }
    }
    setBar(b => !b);
  };

  useEffect(() => { // 화면 켜짐 유지(지원 브라우저)
    let lock: any; if (s.keepScreenOn) (navigator as any).wakeLock?.request('screen').then((l: any) => (lock = l)).catch(() => {});
    return () => { lock?.release?.(); };
  }, [s.keepScreenOn]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  // ── 형광펜·메모 (현재는 이 기기 로컬 저장, authorId='local')
  useEffect(() => { repo.listAnnotations(book.id).then(setAnns); }, [repo, book.id]);
  const byBlock = useMemo(() => {
    const m = new Map<number, Annotation[]>();
    if (s.highlight) for (const a of filterAnns(anns, who, meId)) if (a.chapterId === ch.id) m.set(a.blockIndex, [...(m.get(a.blockIndex) ?? []), a]);
    return m;
  }, [anns, ch.id, s.highlight, who, meId]);
  useEffect(() => { if (!protect || !wrap.current) return; return installProtection(wrap.current); }, [protect]);
  const saveAnn = (a: Annotation) => { setAnns(l => [...l.filter(x => x.id !== a.id), a]); repo.saveAnnotation(a); };
  const delAnn = (id: string) => { setAnns(l => l.filter(x => x.id !== id)); repo.deleteAnnotation(book.id, id); };
  const build = (color: Annotation['color']): Annotation | null => sel && ({ id: crypto.randomUUID(), bookId: book.id, authorId: 'local', chapterId: ch.id,
    blockIndex: sel.i, start: sel.start, end: sel.end, quote: sel.quote, color, createdAt: Date.now(), updatedAt: Date.now() });
  const clearSel = () => { window.getSelection()?.removeAllRanges(); setSel(null); };
  useEffect(() => {
    let t: number;
    const h = () => {
      const picked = wrap.current ? readSelection(wrap.current, window.getSelection()) : null;
      if (!picked) { clearTimeout(t); t = window.setTimeout(() => setSel(null), 600); return; }  // 버튼 탭 중 선택이 풀려도 잠시 유지
      clearTimeout(t); setSel(picked);
    };
    document.addEventListener('selectionchange', h); return () => { document.removeEventListener('selectionchange', h); clearTimeout(t); };
  }, []);
  const goTo = (idx: number, bi: number) => {
    setPanel(null);
    if (idx === ci) { const el = (flow.current ?? wrap.current)?.querySelector<HTMLElement>(`[data-i="${bi}"]`); if (!el) return; scroll ? el.scrollIntoView({ block: 'center' }) : setPage(Math.floor(el.offsetLeft / stride.current)); }
    else { pending.current = bi; setPage(0); setCi(idx); }
  };

  const th = THEME_COLORS[s.theme];
  const vars = {
    '--bg': th.bg, '--fg': th.fg, '--fs': FONT_SIZES[s.fontSizeLevel - 1] + 'px',
    '--lh': s.lineHeight === 'original' ? LH_DEFAULT : s.lineHeight, '--gap': (s.paragraphGap === 'original' ? GAP_DEFAULT : s.paragraphGap) + 'em',
    '--w': WIDTHS[s.paragraphWidthLevel - 1] + 'px', '--ff': FONTS[s.fontFamily]?.css ?? FONTS.original.css,
    '--ta': s.align === 'original' ? 'left' : s.align,
  } as CSSProperties;
  const info = (k: string) => k === 'time' ? now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : k === 'chapter' ? ch.title : k === 'page' ? `${page + 1} / ${pages}` : k === 'percent' ? `${Math.round(((ci + (pages > 1 ? page / (pages - 1) : 0)) / book.chapters.length) * 100)}%` : '';
  const content = (<>
    <h2 className="ch-title">{ch.title}</h2>
    {ch.blocks.map((b, i) => b.type === 'p' ? <p key={i} data-i={i}>{renderSegs(b.text, byBlock.get(i), meId)}</p>
      : b.type === 'h' ? <h3 key={i} data-i={i}>{b.text}</h3>
      : b.type === 'scene' ? <div key={i} data-i={i} className="scene" role="separator">◇</div> : null)}
  </>);

  return (
    <div className={`viewer ${scroll ? 'scroll' : 'paged'} fx-${s.pageTurnEffect}${protect ? ' protect' : ''}`} style={vars}>
      <div className={'bar top' + (bar ? '' : ' hide')}>
        <button onClick={onClose} aria-label="서재로">‹</button><span className="ttl">{book.title}</span>
        <button onClick={() => setPanel(panel === 'toc' ? null : 'toc')}>목차</button>
        <button onClick={() => setPanel(panel === 'notes' ? null : 'notes')}>메모{anns.length ? ` ${anns.length}` : ''}</button>
        <button onClick={() => setPanel(panel === 'settings' ? null : 'settings')} aria-label="설정">Aa</button></div>
      <div ref={wrap} className="wrap" onClick={tap} onScroll={scroll ? later : e => { e.currentTarget.scrollLeft = 0; e.currentTarget.scrollTop = 0; }}>
        {scroll ? <article className="flow">{content}
          <nav className="endnav">{ci > 0 && <button onClick={() => moveChapter(-1)}>이전 화</button>}{!lastChapter ? <button className="primary" onClick={() => moveChapter(1)}>다음 화</button> : <span>마지막 회차입니다</span>}</nav></article>
          : <div ref={flow} className={`flow pgflow anim-${page % 2}`} style={{ transform: `translateX(${-page * stride.current}px)` }}>{content}</div>}
      </div>
      {!scroll && <div className="foot"><span>{info(s.bottomInfo.left)}</span><span>{info(s.bottomInfo.right)}</span></div>}
      <div className="dim" style={{ opacity: (1 - s.brightness) * 0.8 }} />
      {sel && !edit && !panel && <SelectionBar note={sel.clamped ? '첫 문단에만 적용돼요' : undefined} onColor={c => { const a = build(c); if (a) saveAnn(a); clearSel(); }} onMemo={() => { const a = build('yellow'); if (a) setEdit({ ann: a, isNew: true }); clearSel(); }} />}
      {edit && <MemoSheet key={edit.ann.id} ann={edit.ann} isNew={edit.isNew} readOnly={edit.readOnly} authorName={names?.[edit.ann.authorId]} onClose={() => setEdit(null)} onDelete={() => { delAnn(edit.ann.id); setEdit(null); }} onSave={a => { saveAnn(a); setEdit(null); }} />}
      {panel === 'notes' && <NotesPanel book={book} anns={anns} who={who} onWho={setWho} meId={meId} names={names} onGo={goTo} onClose={() => setPanel(null)} />}
      {panel === 'settings' && <SettingsPanel s={s} set={set} close={() => setPanel(null)} />}
      {panel === 'toc' && <div className="panel toc" role="dialog" aria-label="목차" onClick={e => e.stopPropagation()}>
        <div className="phead"><b>목차 ({book.chapters.length}회차)</b><button className="link" onClick={() => setPanel(null)}>닫기</button></div>
        <ol className="pbody">{book.chapters.map((c, i) => <li key={c.id}><button className={i === ci ? 'cur' : ''} onClick={() => { pending.current = 0; setPage(0); setCi(i); setPanel(null); }}>
          <span>{c.title}</span><small>{c.charCount.toLocaleString()}자</small></button></li>)}</ol></div>}
    </div>
  );
}
