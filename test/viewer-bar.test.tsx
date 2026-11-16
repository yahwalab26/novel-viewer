// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import fs from 'node:fs';
import Viewer from '../src/viewer/Viewer';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { mockBook } from '../src/mock/data';
import { createMockApi } from '../src/mock/mockApi';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; (globalThis as any).__APP_VERSION__ = 'test';
let host: HTMLElement, root: Root;
beforeEach(() => { document.body.innerHTML = '<div id="h"></div>'; host = document.getElementById('h')!; root = createRoot(host); Element.prototype.scrollIntoView = () => {}; });
afterEach(() => { act(() => root.unmount()); vi.restoreAllMocks(); });

const mount = async (onClose = () => {}) => {
  const api = createMockApi();
  await act(async () => { root.render(<Viewer repo={api.repo} book={mockBook('b1')} state={null} settings={DEFAULT_SETTINGS} onSettings={() => {}} onProgress={() => {}} onClose={onClose} />); });
};
const btn = (label: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.trim() === label);
const click = async (el: Element) => { await act(async () => { (el as HTMLElement).click(); }); };

describe('읽기 화면 상단 바 — 목록·설정 접근', () => {
  it('처음부터 글자 라벨이 있는 목록·목차·메모·설정 버튼이 보인다', async () => {
    await mount();
    expect(host.querySelector('.bar.top')!.className).not.toContain('hide');
    for (const l of ['목록', '목차', '설정']) expect(btn(l), l).toBeTruthy();
    expect(Array.from(host.querySelectorAll('.bar button')).some(b => b.textContent?.startsWith('메모'))).toBe(true);
  });
  it('목록 버튼을 누르면 서재로 돌아간다(onClose)', async () => {
    const close = vi.fn(); await mount(close); await click(btn('목록')!); expect(close).toHaveBeenCalledTimes(1);
  });
  it('본문을 눌러 바가 숨겨져도 작은 목록 칩이 남아 있어 돌아갈 수 있다', async () => {
    const close = vi.fn(); await mount(close);
    await click(host.querySelector('.wrap')!);
    expect(host.querySelector('.bar.top')!.className).toContain('hide');
    const peek = host.querySelector<HTMLButtonElement>('.peek')!; expect(peek.textContent).toContain('목록');
    await click(peek); expect(close).toHaveBeenCalledTimes(1);
  });
  it('설정 버튼으로 뷰어 설정 패널이 열리고, 열려 있는 동안 바는 숨겨지지 않는다', async () => {
    await mount(); await click(btn('설정')!);
    expect(host.querySelector('[role=dialog][aria-label="뷰어 설정"]')).toBeTruthy();
    expect(host.querySelector('.bar.top')!.className).not.toContain('hide');
    expect(host.querySelector('.peek')).toBeNull();
  });
  it('CSS: PC(마우스+넓은 화면)에서는 바가 항상 보이고 칩은 숨긴다', () => {
    const css = fs.readFileSync('src/styles.css', 'utf-8');
    expect(css).toMatch(/@media \(pointer:fine\) and \(min-width:900px\)\{\.bar\.hide\{transform:none\}\.peek\{display:none\}\}/);
  });
});
