/**
 * 복사 방지(억제 수준). 형광펜을 위해 '선택'은 허용하되 복사·잘라내기·끌어가기·우클릭 메뉴를 막는다.
 * 한계: 화면 캡처·개발자도구·직접 타이핑은 막을 수 없다 — 유출 "억제"일 뿐 보안 경계가 아니다.
 */
export function installProtection(el: HTMLElement): () => void {
  const stop = (e: Event) => e.preventDefault();
  const evs = ['copy', 'cut', 'dragstart', 'contextmenu'] as const;
  evs.forEach(n => el.addEventListener(n, stop));
  return () => evs.forEach(n => el.removeEventListener(n, stop));
}
/** 표시할 형광펜 범위: all(전체) | mine(내 것) | 작가 id */
export function filterAnns<T extends { authorId: string }>(anns: T[], who: string, meId?: string): T[] {
  const mine = (a: T) => !meId || a.authorId === meId || a.authorId === 'local';
  return who === 'all' ? anns : who === 'mine' ? anns.filter(mine) : anns.filter(a => a.authorId === who);
}
export const isMine = (a: { authorId: string }, meId?: string) => !meId || a.authorId === meId || a.authorId === 'local';
