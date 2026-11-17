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
    for (const l of ['목록', '목차', '보기 설정', '뷰어 설정']) expect(btn(l), l).toBeTruthy();
    expect(Array.from(host.querySelectorAll('.bar.top button')).some(b => b.textContent?.startsWith('메모'))).toBe(true);
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
    await mount(); await click(btn('뷰어 설정')!);
    expect(host.querySelector('[role=dialog][aria-label="뷰어 설정"]')).toBeTruthy();
    expect(host.querySelector('.bar.top')!.className).not.toContain('hide');
    expect(host.querySelector('.peek')).toBeNull();
  });
  it('CSS: PC(마우스+넓은 화면)에서는 바가 항상 보이고 칩은 숨긴다', () => {
    const css = fs.readFileSync('src/styles.css', 'utf-8');
    expect(css).toMatch(/@media \(pointer:fine\)\{@container viewer \(min-width:900px\)\{\.bar\.hide\{transform:none\}\.peek\{display:none\}\}\}/);
  });
});

describe('화면 크기 미리보기(모바일·태블릿·PC)', () => {
  const mountWith = async (device: any, onSettings = vi.fn()) => {
    const api = createMockApi();
    await act(async () => { root.render(<Viewer repo={api.repo} book={mockBook('b1')} state={null} settings={{ ...DEFAULT_SETTINGS, device }} onSettings={onSettings} onProgress={() => {}} onClose={() => {}} />); });
    return onSettings;
  };
  it('기본값은 자동(틀 없음)이다', async () => {
    expect(DEFAULT_SETTINGS.device).toBe('auto'); await mountWith('auto');
    expect(host.querySelector('.viewer.framed')).toBeNull(); expect(host.querySelector('.vbackdrop')).toBeNull();
  });
  it('모바일을 고르면 390×844 틀 + 배경이 생기고, 목록·설정 바는 그대로 있다', async () => {
    await mountWith('mobile');
    const v = host.querySelector<HTMLElement>('.viewer.framed')!; expect(v.dataset.device).toBe('mobile'); expect(v.style.width).toBe('390px'); expect(v.style.height).toBe('844px');
    expect(host.querySelector('.vbackdrop')!.textContent).toContain('모바일'); expect(btn('목록')).toBeTruthy(); expect(btn('뷰어 설정')).toBeTruthy();
  });
  it('상단 바의 버튼으로 전환하고, 켜진 버튼을 다시 누르면 자동으로 돌아간다', async () => {
    const set = await mountWith('auto');
    await click(host.querySelector('.bar .bar-dev')!.querySelectorAll('button')[1]);        // 태블릿
    expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ device: 'tablet' }));
    act(() => root.unmount()); root = createRoot(host); const set2 = await mountWith('tablet');
    await click(host.querySelector('.bar .bar-dev button.on')!); expect(set2).toHaveBeenLastCalledWith(expect.objectContaining({ device: 'auto' }));
  });
  it('설정 패널 맨 위에 화면 크기(자동·모바일·태블릿·PC)가 있다', async () => {
    await mountWith('auto'); await click(btn('뷰어 설정')!);
    const labels = Array.from(host.querySelectorAll('.panel .devrow button')).map(b => b.textContent);
    expect(labels).toEqual(['자동', '모바일', '태블릿', 'PC']);
  });
  it('CSS: 패널·여백 분기는 창이 아니라 뷰어 폭(@container) 기준', () => {
    const css = fs.readFileSync('src/styles.css', 'utf-8');
    expect(css).toContain('container:viewer/inline-size'); expect(css).toMatch(/@container viewer \(min-width:900px\)\{\s*\.panel\{left:auto/);
  });
});

describe('읽기 화면 하단 바·설정 분리 (v0.16.0)', () => {
  it('하단 바에 처음으로·이전/다음 화·회차 슬라이더·탭 3개가 있다', async () => {
    await mount();
    const bot = host.querySelector('.bar.bottom')!; expect(bot).toBeTruthy();
    expect(bot.querySelector('input[type=range][aria-label="회차 이동"]')).toBeTruthy();
    for (const l of ['⇤ 처음으로', '‹ 이전 화', '다음 화 ›']) expect(btn(l), l).toBeTruthy();
    expect(btn('⇤ 처음으로')!.disabled).toBe(true);            // 첫 회차에서는 이전/처음으로 비활성
  });
  it('보기 설정에는 배경색·글자, 뷰어 설정에는 읽기 방식이 따로 나온다', async () => {
    await mount(); await click(btn('보기 설정')!);
    const v = host.querySelector('[role=dialog][aria-label="보기 설정"]')!; expect(v.querySelector('[role=radiogroup]')).toBeTruthy(); expect(v.textContent).not.toContain('스크롤보기');
    await click(btn('뷰어 설정')!);
    const w = host.querySelector('[role=dialog][aria-label="뷰어 설정"]')!; expect(w.textContent).toContain('스크롤보기'); expect(w.querySelector('[role=radiogroup]')).toBeNull();
  });
  it('본문을 누르면 상단·하단 바가 함께 숨겨진다', async () => {
    await mount(); await click(host.querySelector('.wrap')!);
    expect(host.querySelector('.bar.top')!.className).toContain('hide'); expect(host.querySelector('.bar.bottom')!.className).toContain('hide');
  });
});

describe('앱 상단 헤더와 겹침 방지', () => {
  it('읽기 화면(.viewer)은 앱 헤더(.topbar)보다 위에 그려진다(z-index)', () => {
    const z = (file: string, sel: string) => { const m = fs.readFileSync(file, 'utf8').match(new RegExp(sel.replace('.', '\\.') + '\\s*\\{[^}]*?z-index:\\s*(\\d+)')); return m ? +m[1] : 0; };
    expect(z('src/styles.css', '.viewer')).toBeGreaterThan(z('src/styles/library.css', '.topbar'));
    expect(z('src/styles.css', '.vbackdrop')).toBeGreaterThan(z('src/styles/library.css', '.topbar'));
  });
});
