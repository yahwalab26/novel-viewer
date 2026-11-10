/** 읽기 진행 표시용 계산(서재 목록). 회차 id 는 파서가 만드는 `c<번호>` 형식이다. */
export interface StateLike { chapterId: string; updatedAt: number }
export function chapterIndexOf(id: string): number | null { const m = /^c(\d+)$/.exec(id); return m ? Number(m[1]) : null; }
/** 읽는 중인 회차 / 전체 회차 → 0~1. 회차 정보가 없거나 범위를 벗어나면 null(표시하지 않음) */
export function progressOf(s: StateLike | undefined, chapterCount: number): { index: number; ratio: number; label: string } | null {
  if (!s || chapterCount <= 0) return null;
  const i = chapterIndexOf(s.chapterId); if (i === null || i >= chapterCount) return null;
  return { index: i, ratio: (i + 1) / chapterCount, label: `${i + 1}회차 읽는 중` };
}
/** 최근에 읽은 원고가 위로. 읽은 적 없는 것은 원래 순서 유지 */
export function byRecentRead<T extends { id: string }>(list: T[], states: Map<string, StateLike>): T[] {
  return [...list].sort((a, b) => (states.get(b.id)?.updatedAt ?? 0) - (states.get(a.id)?.updatedAt ?? 0));
}
