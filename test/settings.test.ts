import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_VERSION, migrateSettings } from '../src/core/settings';

describe('뷰어 설정 기본값·이전', () => {
  it('기본 문단 정렬은 양쪽 정렬', () => { expect(DEFAULT_SETTINGS.align).toBe('justify'); expect(DEFAULT_SETTINGS.v).toBe(SETTINGS_VERSION); });
  it('옛 기본값(원본)이 저장돼 있던 사람은 양쪽 정렬로 바뀐다', () => {
    expect(migrateSettings({ align: 'original', fontSizeLevel: 7 })).toMatchObject({ align: 'justify', fontSizeLevel: 7, v: SETTINGS_VERSION });
  });
  it('직접 고른 정렬(왼쪽)은 유지, 이미 이전된 설정은 건드리지 않음', () => {
    expect(migrateSettings({ align: 'left' }).align).toBe('left');
    expect(migrateSettings({ align: 'original', v: SETTINGS_VERSION }).align).toBe('original');      // 최신 버전에서 사용자가 '원본'을 고른 경우
  });
  it('저장값이 비어 있어도 버전만 기록하고 기본값에 맡긴다', () => { expect(migrateSettings({})).toEqual({ v: SETTINGS_VERSION }); });
});
