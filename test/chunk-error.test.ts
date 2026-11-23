import { describe, it, expect } from 'vitest';
import { isChunkError } from '../src/parsers';

describe('조각 파일 불러오기 실패 판별', () => {
  it('브라우저별 메시지를 알아보고, 다른 오류는 건드리지 않음', () => {
    expect(isChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/cfb-abc.js'))).toBe(true);
    expect(isChunkError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkError(new Error('HWP: 올바른 HWP 5.x 파일이 아닙니다'))).toBe(false);
    expect(isChunkError(undefined)).toBe(false);
  });
});
