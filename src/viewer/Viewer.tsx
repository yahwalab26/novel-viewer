import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Annotation, AnnotationStore, Book, Bookmark, BookmarkStore, ReadingState } from '../core/model';
import { readSelection, type Picked } from './selection';
import { filterAnns, installProtection, isMine } from './protect';
import { viewProgress, locateProgress } from '../core/progress';
import { MemoSheet, SelectionBar, renderSegs } from './AnnotationUI';
import { useKeyboardInset } from './useKeyboardInset';
import { DEVICE_SIZE, type ViewerSettings } from '../core/settings';
import SettingsPanel, { rangeP } from './SettingsPanel';
import NavPanel from './NavPanel';
import { THEME_COLORS, FONT_SIZES, FONTS, WIDTHS, LH_DEFAULT, GAP_DEFAULT } from './theme';

interface Props { repo: AnnotationStore & BookmarkStore; meId?: string; names?: Record<string, string>; protect?: boolean; book: Book; state: ReadingState | null; settings: ViewerSettings; onSettings: (s: ViewerSettings) => void; onProgress: (s: ReadingState) => void; onClose: () => void }

export default function Viewer({ repo, meId, names, protect, book, state, settings: s, onSettings, onProgress, onClose }: Props) {
  const [ci, setCi] = useState(() => Math.max(0, book.chapters.findIndex(c => c.id === state?.chapterId)));
  const [bar, setBar] = useState(true);
  const [panel, setPanel] = useState<null | 'view' | 'viewer' | 'toc'>(null);
  const [page, setPage] = useState(0); const [pages, setPages] = useState(1);
  const [tick, setTick] = useState(0);
  const [win, setWin] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => { const f = () => setWin({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const [anns, setAnns] = useState<Annotation[]>([]);
  const [sel, setSel] = useState<null | Picked>(null);
  const [edit, setEdit] = useState<null | { ann: Annotation; isNew: boolean; readOnly?: boolean }>(null);
  const [bms, setBms] = useState<Bookmark[]>([]);
  const [toast, setToast] = useState('');
  const [who, setWho] = useState('all');                  // 표시할 형광펜: all | mine | 작가 id
  const [now, setNow] = useState(() => new Date());
  const noHide = useRef(0); const [seek, setSeek] = useState<number | null>(null);   // 슬라이더로 끄는 중인 값(0~1000)
  const lastTop = useRef(0); const touched = useRef(false);   // 사용자가 직접 스크롤했을 때만 바를 자동으로 숨긴다(이어읽기 위치 복원 스크롤은 제외)
  const wrap = useRef<HTMLDivElement>(null); const flow = useRef<HTMLDivElement>(null);
  const rootEl = useRef<HTMLDivElement>(null); useKeyboardInset(rootEl);   // 아이폰 키보드가 패널을 가리지 않게
  const curRef = useRef<() => number>(() => 0);            // 최신 currentBlock (set·ResizeObserver에서 사용)
  const stride = useRef(1); const pending = useRef(state?.blockIndex ?? 0); const goLast = useRef(false);
  const ch = book.chapters[ci]; const scroll = s.mode === 'scroll';
  const dev: 'auto' | 'mobile' | 'tablet' = s.device === 'mobile' || s.device === 'tablet' ? s.device : 'auto';   // 알 수 없는 저장값은 자동
  // 모드(스크롤↔페이지)·글자·간격·너비·화면 크기처럼 줄바꿈 위치가 달라지는 설정을 바꾸기 전에, 지금 읽는 문단을 기억해 두었다가 다시 그 문단으로 돌아간다
  const LAYOUT_KEYS = ['mode', 'fontSizeLevel', 'fontFamily', 'lineHeight', 'paragraphGap', 'paragraphWidthLevel', 'align', 'twoPageLandscape', 'device'];
  const set = (p: Partial<ViewerSettings>) => {
    if (LAYOUT_KEYS.some(k => k in p)) { const b = curRef.current(); if (b > 0) pending.current = b; }
    onSettings({ ...s, ...p });
  };

  const lastChapter = ci >= book.chapters.length - 1;
  const gotoChapter = (i: number) => { pending.current = 0; setPage(0); setCi(i); };
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
  }, [tick, scroll, ci, s.fontSizeLevel, s.fontFamily, s.lineHeight, s.paragraphGap, s.paragraphWidthLevel, s.align, s.twoPageLandscape, s.mode, dev]);
  useEffect(() => {
    if (scroll || !wrap.current) return;
    const ro = new ResizeObserver(() => { if (pending.current === 0) { const b = curRef.current(); if (b > 0) pending.current = b; } setTick(t => t + 1); });   // 창·틀 크기가 바뀌어도 읽던 문단 유지 ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [scroll]);

  // ── 스크롤 모드: 회차 이동·모드 전환·글자 설정 변경 시 위치 복원 (회차나 모드가 바뀐 경우에만 맨 위/맨 아래로 보낸다)
  const lastNav = useRef({ ci, scroll });
  useEffect(() => {
    if (!scroll || !wrap.current) return;
    const moved = lastNav.current.ci !== ci || lastNav.current.scroll !== scroll; lastNav.current = { ci, scroll };
    const el = pending.current > 0 ? wrap.current.querySelector<HTMLElement>(`[data-i="${pending.current}"]`) : null;
    if (el) el.scrollIntoView(); else if (moved) wrap.current.scrollTop = goLast.current ? wrap.current.scrollHeight : 0;
    pending.current = 0; goLast.current = false;
  }, [scroll, ci, s.fontSizeLevel, s.fontFamily, s.lineHeight, s.paragraphGap, s.paragraphWidthLevel, s.align, dev]);

  // ── 진행 저장
  const currentBlock = useCallback((): number => {            // 지금 화면 맨 위(또는 쪽 시작)에 보이는 문단 번호
    const f = flow.current ?? wrap.current; if (!f) return 0;
    const kids = Array.from(f.querySelectorAll<HTMLElement>('[data-i]'));
    if (scroll) { const top = wrap.current!.getBoundingClientRect().top + 8; return Number(kids.find(k => k.getBoundingClientRect().bottom > top)?.dataset.i ?? 0); }
    return Number(kids.find(k => k.offsetLeft >= page * stride.current - 1)?.dataset.i ?? 0);
  }, [scroll, page]);
  // 진행률: 마지막 회차 끝까지 내려가야 100%. 한 화면에 다 들어가는(스크롤할 수 없는) 짧은 글은 열기만 해서는 100%가 되지 않는다
  const measure = useCallback((): number => {
    const w = wrap.current; if (!w) return 0;
    const atEnd = scroll ? (w.scrollHeight > w.clientHeight + 8 && w.scrollTop + w.clientHeight >= w.scrollHeight - 4) : (pages > 1 && page >= pages - 1);
    return viewProgress(book.chapters, ci, currentBlock(), atEnd);
  }, [currentBlock, ci, book, scroll, page, pages]);
  const save = useCallback(() => {
    if (!(flow.current ?? wrap.current)) return;
    onProgress({ bookId: book.id, chapterId: ch.id, blockIndex: currentBlock(), updatedAt: Date.now(), progress: measure() });
  }, [currentBlock, measure, ch.id, book.id, onProgress]);
  const [prog, setProg] = useState(0);                      // 화면에 보여 주는 읽은 비율(0~1)
  const progTimer = useRef<number>();
  // 지금 화면에 보이는 문단 번호 범위[처음, 끝] — 책갈피 아이콘 채움·삭제 기준
  const visibleRange = useCallback((): [number, number] => {
    const f = flow.current ?? wrap.current; const first = currentBlock(); if (!f) return [first, first];
    const kids = Array.from(f.querySelectorAll<HTMLElement>('[data-i]')); let last = first;
    for (const k of kids) {
      const i = Number(k.dataset.i); if (i <= first) continue;
      const seen = scroll ? k.getBoundingClientRect().top < wrap.current!.getBoundingClientRect().bottom : k.offsetLeft < (page + 1) * stride.current - 1;
      if (!seen) break; last = i;
    }
    return [first, last];
  }, [currentBlock, scroll, page]);
  const [vis, setVis] = useState<[number, number]>([0, 0]);
  const refreshProg = useCallback(() => { setProg(measure()); setVis(visibleRange()); }, [measure, visibleRange]);
  const scheduleProg = () => { if (progTimer.current) return; progTimer.current = window.setTimeout(() => { progTimer.current = undefined; refreshProg(); }, 120); };
  useEffect(() => { refreshProg(); }, [refreshProg, tick, s.fontSizeLevel, s.lineHeight, s.paragraphGap, s.paragraphWidthLevel, s.fontFamily, s.align]);
  useEffect(() => () => clearTimeout(progTimer.current), []);
  const timer = useRef<number>();
  const saveRef = useRef(save); saveRef.current = save; curRef.current = currentBlock;
  useEffect(() => {   // 새로고침·탭 닫기·앱 전환 직전에 마지막 위치를 바로 저장(500ms 디바운스에 걸려 유실되는 것 방지)
    const flush = () => { clearTimeout(timer.current); saveRef.current(); };
    const vis = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', vis); };
  }, []);
  const close = () => { clearTimeout(timer.current); save(); onClose(); };   // 목록으로 나가기 전에 위치 저장
  const later = () => { clearTimeout(timer.current); timer.current = window.setTimeout(save, 500); };
  useEffect(later, [ci, page, scroll]); // eslint-disable-line
  useEffect(() => () => clearTimeout(timer.current), []);

  // 스크롤 모드: 아래로 읽어 내려가면 바를 숨긴다. 바는 화면을 터치·클릭(또는 Esc)했을 때만 나타난다 — 위로 스크롤해도, 맨 위에 닿아도 나타나지 않는다. 슬라이더로 이동한 직후(0.8초)에는 숨기지 않는다
  const onScrollBar = () => {
    later(); scheduleProg();
    const t = wrap.current!.scrollTop, d = t - lastTop.current; lastTop.current = t;
    if (touched.current && d > 12 && Date.now() - noHide.current > 800) setBar(false);
  };
  // ── 이동
  const next = useCallback(() => {
    touched.current = true;
    if (scroll) { const w = wrap.current!; if (w.scrollTop + w.clientHeight >= w.scrollHeight - 4) moveChapter(1); else w.scrollBy({ top: w.clientHeight * 0.9, behavior: 'smooth' }); }
    else if (page < pages - 1) setPage(page + 1); else moveChapter(1);
  }, [scroll, page, pages, moveChapter]);
  const prev = useCallback(() => {
    touched.current = true;
    if (scroll) { const w = wrap.current!; if (w.scrollTop <= 4) moveChapter(-1, true); else w.scrollBy({ top: -w.clientHeight * 0.9, behavior: 'smooth' }); }
    else if (page > 0) setPage(page - 1); else moveChapter(-1, true);
  }, [scroll, page, moveChapter]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('select,input')) return;
      if (scroll && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); touched.current = true; moveChapter(e.key === 'ArrowRight' ? 1 : -1); }   // 스크롤 모드: ←/→ = 이전/다음 화 (PageUp/Down·Space 는 화면 스크롤)
      else if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); prev(); }
      else if (e.key === 'Escape') panel ? setPanel(null) : setBar(b => !b);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [next, prev, panel, scroll, moveChapter]);

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
  // ── 북마크 (같은 위치에서 다시 누르면 삭제)
  useEffect(() => { repo.listBookmarks(book.id).then(setBms); }, [repo, book.id]);
  const say = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 1800); };
  const delBookmark = (id: string) => { setBms(l => l.filter(x => x.id !== id)); repo.deleteBookmark(book.id, id).catch(() => say('북마크 삭제에 실패했어요')); };
  const toggleBookmark = () => {
    const [v0, v1] = visibleRange(), here = bms.filter(b => b.chapterId === ch.id && b.blockIndex >= v0 && b.blockIndex <= v1);
    if (here.length) { here.forEach(b => delBookmark(b.id)); say('북마크를 삭제했어요'); return; }
    const bi = v0;
    const blk = ch.blocks[bi], label = blk && (blk.type === 'p' || blk.type === 'h') ? blk.text.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    const bm: Bookmark = { id: crypto.randomUUID(), bookId: book.id, chapterId: ch.id, blockIndex: bi, label, createdAt: Date.now() };
    setBms(l => [...l, bm]); say('북마크를 추가했어요');
    repo.saveBookmark(bm).catch(() => { setBms(l => l.filter(x => x.id !== bm.id)); say('북마크 저장에 실패했어요 (서버 설정을 확인해 주세요)'); });
  };
  const commitSeek = () => {   // 손을 떼면 그 위치(전체 중 %)로 이동
    if (seek === null) return; const loc = locateProgress(book.chapters, seek / 1000); setSeek(null);
    noHide.current = Date.now(); seekTo(loc.ci, loc.blockIndex);
  };
  const bmHere = bms.some(b => b.chapterId === ch.id && b.blockIndex >= vis[0] && b.blockIndex <= vis[1]);   // 지금 보이는 곳에 북마크가 있으면 채움
  const goTo = (idx: number, bi: number) => { setPanel(null); seekTo(idx, bi); };
  const seekTo = (idx: number, bi: number) => {
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
  const info = (k: string) => k === 'time' ? now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : k === 'chapter' ? ch.title : k === 'page' ? `${page + 1} / ${pages}` : k === 'percent' ? `${Math.round(prog * 100)}%` : '';
  const content = (<>
    <h2 className="ch-title">{ch.title}</h2>
    {ch.blocks.map((b, i) => { const st = b.type !== 'img' && b.gap ? { paddingTop: `calc(${b.gap} * var(--lh) * 1em)` } : undefined;   // 엔터만 친 빈 줄 = 줄 높이 × 개수
      return b.type === 'p' ? <p key={i} data-i={i} style={st}>{renderSegs(b.text, byBlock.get(i), meId, b.marks)}</p>
        : b.type === 'h' ? <h3 key={i} data-i={i} style={st}>{b.text}</h3>
        : b.type === 'scene' ? <div key={i} data-i={i} className="scene" role="separator" style={st}>{b.text}</div> : null; })}
  </>);

  // 화면 크기 미리보기: 모바일·태블릿은 항상 그 크기의 틀로, PC는 화면이 1280×800보다 작을 때만 틀(화면에 안 들어가면 비율대로 축소)
  const size = dev === 'auto' ? null : DEVICE_SIZE[dev];
  const framed = !!size;
  const k = framed ? Math.min(1, (win.w - 24) / size!.w, (win.h - 56) / size!.h) : 1;
  const frameStyle: CSSProperties | undefined = framed ? { width: size!.w, height: size!.h, transform: `translate(-50%,-50%) scale(${k})` } : undefined;
  const onDevice = (device: ViewerSettings['device']) => set({ device });

  return (<>
    {framed && <div className="vbackdrop" aria-hidden="true"><span>{dev === 'mobile' ? '모바일' : dev === 'tablet' ? '태블릿' : 'PC'} · {size!.w}×{size!.h}{k < 1 ? ` (${Math.round(k * 100)}%로 축소)` : ''}</span></div>}
    <div ref={rootEl} className={`viewer ${scroll ? 'scroll' : 'paged'} fx-${s.pageTurnEffect}${protect ? ' protect' : ''}${framed ? ' framed' : ''}`} data-device={framed ? dev : 'auto'} style={{ ...vars, ...frameStyle }}>
      <div className={'bar top' + (bar || panel ? '' : ' hide')}>
        <button className="back" onClick={close} aria-label="작품 목록으로"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4 6 10l6 6" /></svg>목록</button><span className="bsp" />
        <button className="bmbtn" onClick={toggleBookmark} aria-pressed={bmHere} aria-label="현재 위치 북마크 추가/삭제"><svg width="22" height="22" viewBox="0 0 24 24" fill={bmHere ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" /></svg></button>
        <span className="ttl">{book.title}</span></div>
      {!bar && !panel && <button className="peek" onClick={close} aria-label="작품 목록으로"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4 6 10l6 6" /></svg>목록</button>}
      <div className={'bar bottom' + (bar || panel ? '' : ' hide')} onClick={e => e.stopPropagation()}>
        <div className="bnav">
          <button onClick={() => gotoChapter(0)} disabled={ci === 0}>⇤ 처음으로</button><span className="bsp" />
          <button onClick={() => moveChapter(-1)} disabled={ci === 0}>‹ 이전 화</button>
          <button onClick={() => moveChapter(1)} disabled={lastChapter}>다음 화 ›</button></div>
        <div className="bseek"><input type="range" min={0} max={1000} step={1} value={seek ?? Math.round(prog * 1000)} style={rangeP(seek ?? Math.round(prog * 1000), 0, 1000)} aria-label="읽은 위치" aria-valuetext={`${Math.round((seek ?? prog * 1000) / 10)}%`}
          onChange={e => setSeek(+e.target.value)} onPointerUp={commitSeek} onKeyUp={commitSeek} onBlur={commitSeek} /><span>{Math.round((seek ?? prog * 1000) / 10)}%</span></div>
        <div className="btabs">
          <button className={panel === 'toc' ? 'on' : ''} onClick={() => setPanel(panel === 'toc' ? null : 'toc')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg><span>목차</span></button>
          <button className={panel === 'view' ? 'on' : ''} onClick={() => setPanel(panel === 'view' ? null : 'view')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 6V4h14v2M12 4v16M9 20h6" /></svg><span>보기 설정</span></button>
          <button className={panel === 'viewer' ? 'on' : ''} onClick={() => setPanel(panel === 'viewer' ? null : 'viewer')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></svg><span>뷰어 설정</span></button></div></div>
      <div ref={wrap} className="wrap" onClick={tap} onWheel={() => { touched.current = true; }} onTouchMove={() => { touched.current = true; }} onScroll={scroll ? onScrollBar : e => { e.currentTarget.scrollLeft = 0; e.currentTarget.scrollTop = 0; }}>
        {scroll ? <article className="flow">{content}
          <nav className="endnav">{ci > 0 && <button onClick={() => moveChapter(-1)}>이전 화</button>}{!lastChapter ? <button className="primary" onClick={() => moveChapter(1)}>다음 화</button> : <span>마지막 회차입니다</span>}</nav></article>
          : <div ref={flow} className={`flow pgflow anim-${page % 2}`} style={{ transform: `translateX(${-page * stride.current}px)` }}>{content}</div>}
      </div>
      {!scroll && <div className="foot"><span>{info(s.bottomInfo.left)}</span><span>{info(s.bottomInfo.right)}</span></div>}
      <div className="vprog" role="progressbar" aria-label="읽은 비율" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(prog * 100)}><i style={{ width: `${prog * 100}%` }} /></div>
      {(scroll || s.bottomInfo.right === 'none') && <span className="vpct" aria-hidden="true">{Math.round(prog * 100)}%</span>}
      <div className="dim" style={{ opacity: (1 - s.brightness) * 0.8 }} />
      {sel && !edit && !panel && <SelectionBar note={sel.clamped ? '첫 문단에만 적용돼요' : undefined} onColor={c => { const a = build(c); if (a) saveAnn(a); clearSel(); }} onMemo={() => { const a = build('yellow'); if (a) setEdit({ ann: a, isNew: true }); clearSel(); }} />}
      {edit && <MemoSheet key={edit.ann.id} ann={edit.ann} isNew={edit.isNew} readOnly={edit.readOnly} authorName={names?.[edit.ann.authorId]} onClose={() => setEdit(null)} onDelete={() => { delAnn(edit.ann.id); setEdit(null); }} onSave={a => { saveAnn(a); setEdit(null); }} />}
      {(panel === 'view' || panel === 'viewer') && <SettingsPanel kind={panel} s={s} set={set} close={() => setPanel(null)} />}
      {panel === 'toc' && <NavPanel book={book} ci={ci} bookmarks={bms} anns={anns} who={who} onWho={setWho} meId={meId} names={names} onClose={() => setPanel(null)} onGo={goTo} onDeleteBookmark={delBookmark}
        onChapter={i => { pending.current = 0; setPage(0); setCi(i); setPanel(null); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  </>);
}
