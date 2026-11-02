import type { Theme } from '../core/settings';
export const THEME_COLORS: Record<Theme, { bg: string; fg: string; label: string }> = {
  white: { bg: '#ffffff', fg: '#1f1f1f', label: '화이트' }, ivory: { bg: '#f0e8d2', fg: '#2b2820', label: '아이보리' },
  silver: { bg: '#d6d3ce', fg: '#1f1f1f', label: '실버' }, gray: { bg: '#6e6e6e', fg: '#f4f4f4', label: '그레이' },
  charcoal: { bg: '#2e2e2e', fg: '#d9d9d9', label: '차콜' }, forest: { bg: '#2f6d64', fg: '#e8f1ef', label: '포레스트' },
  paper: { bg: '#eeeeea', fg: '#242424', label: '페이퍼' },
};
export const FONT_SIZES = [12, 13.5, 15, 16.5, 18, 19.5, 21, 23, 25, 28];
export const FONTS: Record<string, { label: string; css: string }> = {
  original: { label: '원본(명조)', css: '"Noto Serif KR","Nanum Myeongjo","Apple SD Gothic Neo",serif' },
  sans: { label: '고딕', css: '"Noto Sans KR","Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif' },
  system: { label: '시스템', css: 'system-ui,-apple-system,"Segoe UI",sans-serif' },
};
export const WIDTHS = [480, 560, 640, 740, 860];
export const LH_DEFAULT = 1.85, GAP_DEFAULT = 0.8;
