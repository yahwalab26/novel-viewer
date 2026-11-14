import type { Chapter } from './model';

/** 읽기 진행 표시용 계산(서재 목록). 회차 id 는 파서가 만드는 `c<번호>` 형식이다. */
export interface StateLike { chapterId: string; updatedAt: number; progress?: number }
export function chapterIndexOf(id: string): number | null { const m = /^c(\d+)$/.exec(id); return m ? Number(m[1]) : null; }
/** 서재 목록의 진행 표시. progress(0~1)가 있으면 그대로, 없으면(옛 기록) 앞선 회차까지만 읽은 것으로 계산한다
 *  — 예전처럼 '읽는 회차 번호 ÷ 전체'로 하면 1회차짜리 단편은 열기만 해도 100%가 되었다. 막 열었을 뿐(0%)이면 표시하지 않는다. */
export function progressOf(s: StateLike | undefined, chapterCount: number): { index: number; ratio: number; label: string; done: boolean } | null {
  if (!s || chapterCount <= 0) return null;
  const i = chapterIndexOf(s.chapterId); if (i === null || i >= chapterCount) return null;
  const ratio = s.progress && s.progress > 0 ? Math.min(1, s.progress) : i / chapterCount;
  if (ratio <= 0) return null;
  const done = ratio >= 0.999, pct = Math.round(ratio * 100);
  return { index: i, ratio, done, label: done ? '다 읽음' : chapterCount > 1 ? `${i + 1}회차 읽는 중 (${pct}%)` : `${pct}% 읽는 중` };
}
/** 원고 전체 글자 수 대비, 현재 회차·문단 위치까지 읽은 비율(0~1) */
export function readingProgress(chapters: Chapter[], ci: number, blockIndex: number): number {
  const total = chapters.reduce((n, c) => n + c.charCount, 0); if (total <= 0) return 0;
  let before = 0; for (let k = 0; k < ci; k++) before += chapters[k]?.charCount ?? 0;
  const blocks = chapters[ci]?.blocks ?? []; let within = 0;
  for (let k = 0; k < Math.min(blockIndex, blocks.length); k++) { const b = blocks[k]; if (b.type === 'p' || b.type === 'h') within += b.text.replace(/\s/g, '').length; }
  return Math.max(0, Math.min(1, (before + within) / total));
}
/** 최근에 읽은 원고가 위로. 읽은 적 없는 것은 원래 순서 유지 */
export function byRecentRead<T extends { id: string }>(list: T[], states: Map<string, StateLike>): T[] {
  return [...list].sort((a, b) => (states.get(b.id)?.updatedAt ?? 0) - (states.get(a.id)?.updatedAt ?? 0));
}

/** 화면에 보이는 위치 → 진행률. 마지막 회차의 끝까지 내려갔을 때만 100% (atEnd) */
export function viewProgress(chapters: Chapter[], ci: number, blockIndex: number, atEnd: boolean): number {
  return ci >= chapters.length - 1 && atEnd ? 1 : readingProgress(chapters, ci, blockIndex);
}
