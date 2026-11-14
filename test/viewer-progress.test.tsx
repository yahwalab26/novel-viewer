// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import fs from 'node:fs';
import Viewer from '../src/viewer/Viewer';
import ActionMenu from '../src/ui/ActionMenu';
import { placeMenu } from '../src/ui/placeMenu';
import { viewProgress } from '../src/core/progress';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { mockBook } from '../src/mock/data';
import { createMockApi } from '../src/mock/mockApi';
import type { Chapter } from '../src/core/model';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; (globalThis as any).__APP_VERSION__ = 'test';
let host: HTMLElement, root: Root;
beforeEach(() => { document.body.innerHTML = '<div id="h"></div>'; host = document.getElementById('h')!; root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); vi.restoreAllMocks(); });

const ch = (n: number, t: string[]): Chapter => ({ id: `c${n}`, title: `${n + 1}화`, charCount: t.join('').length, blocks: t.map(text => ({ type: 'p' as const, text })) });

describe('읽기 화면 진행률', () => {
  it('마지막 회차 끝에 도달했을 때만 100%, 그 밖에는 읽은 글자 비율', () => {
    const cs = [ch(0, ['aaaa', 'bbbb']), ch(1, ['cccc', 'dddd'])];
    expect(viewProgress(cs, 0, 0, false)).toBe(0); expect(viewProgress(cs, 1, 1, false)).toBeCloseTo(12 / 16);
    expect(viewProgress(cs, 0, 1, true)).toBeCloseTo(4 / 16);          // 첫 회차 끝은 100%가 아님
    expect(viewProgress(cs, 1, 1, true)).toBe(1);
  });
  it('읽기 화면에 진행 막대(role=progressbar)와 퍼센트가 표시된다 — 열기만 하면 0%', async () => {
    Element.prototype.scrollIntoView = () => {};
    const api = createMockApi();
    await act(async () => { root.render(<Viewer repo={api.repo} book={mockBook('b1')} state={null} settings={DEFAULT_SETTINGS} onSettings={() => {}} onProgress={() => {}} onClose={() => {}} />); });
    const bar = host.querySelector('[role=progressbar]')!;
    expect(bar.getAttribute('aria-label')).toBe('읽은 비율'); expect(bar.getAttribute('aria-valuenow')).toBe('0');
    expect(host.querySelector('.vpct')!.textContent).toBe('0%');
  });
  it('CSS: 진행 선은 독서 테마 글자색을 따르고 화면 맨 아래에 놓인다', () => {
    const css = fs.readFileSync('src/styles.css', 'utf-8');
    expect(css).toMatch(/\.vprog\{[^}]*bottom:0[^}]*var\(--fg\)/); expect(css).toMatch(/\.vprog i\{[^}]*background:var\(--fg\)/);
  });
});

describe('더보기 메뉴가 화면 밖으로 잘리지 않게', () => {
  const vp = { w: 400, h: 800 };
  it('위치 계산: 아래 공간이 충분하면 아래, 부족하고 위가 더 넓으면 위, 둘 다 좁으면 아래 유지, 오른쪽 넘침은 오른쪽 정렬', () => {
    const menu = { w: 180, h: 100 };
    expect(placeMenu({ top: 100, bottom: 144, left: 20, right: 90 }, menu, vp)).toEqual({ up: false, right: false });
    expect(placeMenu({ top: 700, bottom: 744, left: 20, right: 90 }, menu, vp)).toEqual({ up: true, right: false });
    expect(placeMenu({ top: 40, bottom: 84, left: 20, right: 90 }, { w: 180, h: 900 }, vp).up).toBe(false);          // 위도 안 들어가면 그대로
    expect(placeMenu({ top: 100, bottom: 144, left: 300, right: 360 }, menu, vp).right).toBe(true);
  });
  it('화면 아래쪽 행에서 열면 메뉴가 위로 열린다(up 클래스), 위쪽 행에서는 아래로', async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return (this as HTMLElement).classList.contains('menu') ? 120 : 0; } });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return (this as HTMLElement).classList.contains('menu') ? 180 : 0; } });
    (window as any).innerHeight = 800; (window as any).innerWidth = 400;
    const open = async (top: number) => {
      rectSpy.mockReturnValue({ top, bottom: top + 44, left: 20, right: 90, width: 70, height: 44, x: 20, y: top, toJSON() {} } as DOMRect);
      await act(async () => { root.render(<ActionMenu label="더보기" items={[{ label: '삭제', onSelect: () => {} }]} />); });
      await act(async () => { (host.querySelector('.bk-act') as HTMLElement).click(); });
      return host.querySelector('.menu')!.className;
    };
    expect(await open(720)).toContain('up');
    await act(async () => { (host.querySelector('.bk-act') as HTMLElement).click(); });                    // 닫기
    expect(await open(100)).not.toContain('up');
    delete (HTMLElement.prototype as any).offsetHeight; delete (HTMLElement.prototype as any).offsetWidth;
  });
});

describe('서재 검색 줄', () => {
  it('CSS: 검색창이 있으면 목록 위 굵은 선을 없애 선이 한 줄만 보인다', () => {
    const css = fs.readFileSync('src/styles/library.css', 'utf-8');
    expect(css).toMatch(/\.lb-search \+ \.bk-list[^{]*\{[^}]*border-top: 0/); expect(css).toMatch(/\.lb-search \{[^}]*margin: 0;/);
  });
});
