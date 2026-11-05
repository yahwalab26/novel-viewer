/** 홈 화면에 설치한 앱(독립 창)으로 열렸는지. iOS는 navigator.standalone, 그 외는 display-mode 미디어쿼리 */
export function isStandalone(win: Window = window): boolean {
  return !!(win.matchMedia?.('(display-mode: standalone)').matches || (win.navigator as any).standalone === true);
}
/** 설치 앱이면 <html class="standalone"> — CSS에서 설치 앱 전용 조정(예: 좌우 여백)에 사용 */
export function markStandalone(win: Window = window, doc: Document = document) {
  doc.documentElement.classList.toggle('standalone', isStandalone(win));
}
