// 참고 화면 기준 뷰어 설정. 'original' = 문서 원본 서식 유지.
export const THEMES = ['white','ivory','silver','gray','charcoal','forest','paper'] as const;
export type Theme = typeof THEMES[number];

export interface ViewerSettings {
  // 화면
  theme: Theme; brightness: number;                  // 0~1
  // 글자/문단
  fontFamily: 'original' | string;
  fontSizeLevel: number;                              // 1~10 (기본 5)
  lineHeight: 'original' | number;
  paragraphGap: 'original' | number;
  paragraphWidthLevel: number;                        // 1~5 (기본 3, 좌우 여백)
  align: 'original' | 'left' | 'justify';
  v?: number;                                         // 저장된 설정의 버전(기본값을 바꿀 때 옛 저장값을 이전하는 데 사용)
  highlight: boolean;                                 // 형광펜 보기
  // 읽기 방식
  mode: 'page' | 'scroll';
  tapZones: { left: 'prev' | 'next'; right: 'prev' | 'next' };
  verticalTapPaging: boolean;
  pageTurnEffect: 'none' | 'fade' | 'slide';
  twoPageLandscape: boolean;
  bottomInfo: { left: 'none' | 'time' | 'battery' | 'chapter'; right: 'none' | 'page' | 'percent' };
  popupAnnotation: boolean;
  brightnessGesture: boolean; lockRotation: boolean; keepScreenOn: boolean;
}
export const SETTINGS_VERSION = 2;
/** 저장된 설정을 현재 버전으로 이전. v2: 기본 정렬을 '양쪽'으로 — 옛 기본값('원본')을 그대로 쓰던 사람만 바꾸고, 직접 고른 값은 유지 */
export function migrateSettings(stored: Record<string, unknown>): Record<string, unknown> {
  const s = { ...stored }; const v = typeof s.v === 'number' ? s.v : 1;
  if (v < 2 && s.align === 'original') s.align = 'justify';
  s.v = SETTINGS_VERSION; return s;
}
export const DEFAULT_SETTINGS: ViewerSettings = {
  v: SETTINGS_VERSION,
  theme: 'ivory', brightness: 1, fontFamily: 'original', fontSizeLevel: 5, lineHeight: 'original',
  paragraphGap: 'original', paragraphWidthLevel: 3, align: 'justify', highlight: true,
  mode: 'scroll', tapZones: { left: 'prev', right: 'next' }, verticalTapPaging: false,
  pageTurnEffect: 'fade', twoPageLandscape: false, bottomInfo: { left: 'none', right: 'none' },
  popupAnnotation: true, brightnessGesture: true, lockRotation: false, keepScreenOn: false,
};
// scroll 모드에서는 tapZones/pageTurnEffect/bottomInfo/brightnessGesture/twoPageLandscape 비활성 (참고 화면 안내문 동일)
