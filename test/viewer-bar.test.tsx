// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useState } from 'react';
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
  it('처음부터 목록·북마크(책갈피)·목차·보기 설정·뷰어 설정 버튼이 보인다', async () => {
    await mount();
    expect(host.querySelector('.bar.top')!.className).not.toContain('hide');
    for (const l of ['목록', '목차', '보기 설정', '뷰어 설정']) expect(btn(l), l).toBeTruthy();
    const bm = host.querySelector('.bar.top button[aria-label*="북마크"]')!; expect(bm).toBeTruthy(); expect(bm.textContent).not.toContain('★'); expect(bm.querySelector('svg')).toBeTruthy();
    expect(Array.from(host.querySelectorAll('.bar.top button')).some(b => b.textContent?.startsWith('메모'))).toBe(false);   // 메모는 목차 패널로 이동
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
  it('CSS: PC(자동)에서도 상단 바가 하단 바처럼 숨겨졌다 나타난다(바를 항상 보이게 하는 규칙 없음)', () => {
    const css = fs.readFileSync('src/styles.css', 'utf-8');
    expect(css).not.toContain('.bar.hide{transform:none}'); expect(css).not.toContain('pointer:fine');
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
  it('뷰어 설정의 화면 크기는 아코디언: 현재 값이 보이고, 펼쳐서 고르면 접힌다', async () => {
    const set = await mountWith('auto'); await click(btn('뷰어 설정')!);
    const head = host.querySelector<HTMLButtonElement>('.panel .acc-h')!; expect(head.textContent).toContain('화면 크기'); expect(head.textContent).toContain('자동');
    expect(head.getAttribute('aria-expanded')).toBe('false'); expect(host.querySelector('.acc-list')).toBeNull();
    await click(head); expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(Array.from(host.querySelectorAll('.acc-list button')).map(b => b.textContent?.replace('✓', ''))).toEqual(['자동', '모바일', '태블릿']);
    await click(host.querySelectorAll('.acc-list button')[2]);                                  // 태블릿
    expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ device: 'tablet' })); expect(host.querySelector('.acc-list')).toBeNull();
  });
  it('모바일 틀 안에서도 뷰어 설정으로 다른 화면 크기로 바꿀 수 있다', async () => {
    const set = await mountWith('mobile'); await click(btn('뷰어 설정')!);
    expect(host.querySelector('.panel .acc-h')!.textContent).toContain('모바일');
    await click(host.querySelector('.panel .acc-h')!); await click(host.querySelectorAll('.acc-list button')[0]);   // 자동
    expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ device: 'auto' }));
  });
  it('목차 패널에 메모 탭이 있고(메모 개수 표시), 상단에는 메모 버튼이 없다', async () => {
    await mountWith('auto'); await click(btn('목차')!);
    const tabs = Array.from(host.querySelectorAll('.panel [role=tab]')).map(b => b.textContent);
    expect(tabs.some(t => t?.startsWith('메모'))).toBe(true); expect(tabs.some(t => t?.startsWith('검색'))).toBe(true);
    await click(Array.from(host.querySelectorAll<HTMLElement>('.panel [role=tab]')).find(b => b.textContent?.startsWith('메모'))!);
    expect(host.querySelector('.panel')!.textContent).toContain('길게 눌러 선택');
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
    expect(bot.querySelector('input[type=range][aria-label="읽은 위치"]')).toBeTruthy();
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

describe('PC 폐지 · 글꼴 선택 화면', () => {
  it('예전에 저장된 device:desktop 값도 깨지지 않고 자동(틀 없음)으로 동작한다', async () => {
    const api = createMockApi();
    await act(async () => { root.render(<Viewer repo={api.repo} book={mockBook('b1')} state={null} settings={{ ...DEFAULT_SETTINGS, device: 'desktop' as any }} onSettings={() => {}} onProgress={() => {}} onClose={() => {}} />); });
    expect(host.querySelector('.viewer.framed')).toBeNull(); expect(host.querySelector('.bar.top')).toBeTruthy();
  });
  it('보기 설정의 글꼴 행을 누르면 글꼴 목록(각 글꼴로 미리보기)이 열리고, 고르면 적용된다', async () => {
    const set = vi.fn(); const api = createMockApi();
    await act(async () => { root.render(<Viewer repo={api.repo} book={mockBook('b1')} state={null} settings={DEFAULT_SETTINGS} onSettings={set} onProgress={() => {}} onClose={() => {}} />); });
    await click(btn('보기 설정')!); await click(host.querySelector('.panel .navrow')!);
    expect(host.querySelector('[role=dialog][aria-label="글꼴"]')).toBeTruthy();
    const items = host.querySelectorAll<HTMLButtonElement>('.fontlist button'); expect(items.length).toBeGreaterThanOrEqual(3);
    expect((items[1].querySelector('.fl span') as HTMLElement).style.fontFamily).toBeTruthy();
    await click(items[1]); expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ fontFamily: 'sans' }));
    await click(Array.from(host.querySelectorAll<HTMLElement>('.panel .link')).find(b => b.textContent?.includes('보기 설정'))!);
    expect(host.querySelector('[role=dialog][aria-label="보기 설정"]')).toBeTruthy();
  });
});

describe('읽던 위치 유지 (스크롤·페이지 전환, 글자 설정 변경)', () => {
  // 스크롤 모드에서 2번 문단이 화면 맨 위에 보이도록 위치를 흉내 낸다(jsdom에는 레이아웃이 없다)
  const fakeLayout = () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const i = this.dataset?.i; const top = i === undefined ? 0 : (Number(i) - 2) * 100;
      return { top, bottom: i === undefined ? 600 : top + 80, left: 0, right: 0, width: 0, height: 80, x: 0, y: top, toJSON() {} } as DOMRect;
    });
  };
  const Host = ({ init }: { init: any }) => { const [st, setSt] = useState(init); const api = createMockApi();
    return <Viewer repo={api.repo} book={mockBook('b1')} state={null} settings={st} onSettings={setSt} onProgress={() => {}} onClose={() => {}} />; };
  it('스크롤 모드에서 글자 크기를 바꿔도 읽던 문단(2번)으로 다시 이동한다', async () => {
    const seen: string[] = []; Element.prototype.scrollIntoView = function (this: Element) { seen.push((this as HTMLElement).dataset.i ?? ''); };
    await act(async () => { root.render(<Host init={{ ...DEFAULT_SETTINGS, mode: 'scroll' }} />); });
    fakeLayout(); seen.length = 0;
    await click(btn('보기 설정')!);
    await click(Array.from(host.querySelectorAll<HTMLButtonElement>('.panel .stepper button')).find(b => b.textContent === '+')!);   // 글자 크기 +
    expect(seen).toContain('2');
  });
});

describe('하단 슬라이더(위치 %) · 스크롤로는 바가 나타나지 않음 · 스크롤바 숨김', () => {
  const Host2 = ({ init }: { init: any }) => { const [st, setSt] = useState(init); const api = createMockApi();
    return <Viewer repo={api.repo} book={mockBook('b1')} state={null} settings={st} onSettings={setSt} onProgress={() => {}} onClose={() => {}} />; };
  const slider = () => host.querySelector<HTMLInputElement>('.bar.bottom input[type=range]')!;
  const setRange = async (el: HTMLInputElement, v: number) => { await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })); }); };
  it('슬라이더 옆에는 "1/1화" 대신 위치 %가 나오고, 끄는 동안 % 가 바뀐다', async () => {
    await act(async () => { root.render(<Host2 init={{ ...DEFAULT_SETTINGS, mode: 'scroll' }} />); });
    const lab = () => host.querySelector('.bseek span')!.textContent; expect(lab()).toMatch(/^\d+%$/); expect(lab()).not.toContain('화');
    await setRange(slider(), 500); expect(lab()).toBe('50%');
  });
  it('슬라이더를 놓으면 그 위치(전체 중 %)의 회차로 이동한다', async () => {
    await act(async () => { root.render(<Host2 init={{ ...DEFAULT_SETTINGS, mode: 'scroll' }} />); });
    await setRange(slider(), 1000);
    await act(async () => { slider().dispatchEvent(new Event('pointerup', { bubbles: true })); });
    expect(host.querySelector('.wrap')!.textContent).toContain('3화');
  });
  it('위로 스크롤하거나 맨 위에 닿아도 바가 나타나지 않고, 화면을 눌러야만 나타난다', async () => {
    await act(async () => { root.render(<Host2 init={{ ...DEFAULT_SETTINGS, mode: 'scroll' }} />); });
    const wrap = host.querySelector<HTMLElement>('.wrap')!; const top = host.querySelector('.bar.top')!, bot = host.querySelector('.bar.bottom')!;
    const scrollTo = async (y: number) => { await act(async () => { Object.defineProperty(wrap, 'scrollTop', { value: y, configurable: true, writable: true }); wrap.dispatchEvent(new Event('scroll', { bubbles: true })); }); };
    await act(async () => { wrap.dispatchEvent(new Event('wheel', { bubbles: true })); });   // 직접 스크롤하는 중
    await scrollTo(300);   expect(top.className).toContain('hide'); expect(bot.className).toContain('hide');   // 내려가면 숨김
    await scrollTo(100);   expect(top.className).toContain('hide'); expect(bot.className).toContain('hide');   // 위로 올려도 그대로 숨김
    await scrollTo(0);     expect(top.className).toContain('hide');                                           // 맨 위에 닿아도 그대로
    await click(wrap);     expect(top.className).not.toContain('hide'); expect(bot.className).not.toContain('hide');   // 눌러야 나타남
  });
  it('CSS: 본문 스크롤바(흰 줄)는 숨긴다', () => {
    const css = fs.readFileSync('src/styles.css', 'utf8').replace(/\s+/g, '');
    expect(css).toContain('.wrap{scrollbar-width:none');
    expect(css).toContain('.wrap::-webkit-scrollbar{display:none}');
  });
});

describe('문단 정렬 선택 화면 · 슬라이더 디자인', () => {
  it('보기 설정의 문단 정렬 행(원본 ›)을 누르면 정렬 목록(이름만)이 열리고, 고르면 적용된다', async () => {
    const set = vi.fn(); const api = createMockApi();
    await act(async () => { root.render(<Viewer repo={api.repo} book={mockBook('b1')} state={null} settings={{ ...DEFAULT_SETTINGS, align: 'original' }} onSettings={set} onProgress={() => {}} onClose={() => {}} />); });
    await click(btn('보기 설정')!);
    const row = Array.from(host.querySelectorAll<HTMLButtonElement>('.panel .navrow')).find(b => b.textContent?.includes('문단 정렬'))!;
    expect(row.textContent).toContain('원본'); await click(row);
    expect(host.querySelector('[role=dialog][aria-label="문단 정렬"]')).toBeTruthy();
    const items = Array.from(host.querySelectorAll<HTMLButtonElement>('.fontlist button')); expect(items.map(b => b.textContent?.replace('✓', ''))).toEqual(['원본', '왼쪽', '양쪽']);
    expect(host.querySelector('.fontlist')!.textContent).not.toContain('비가 그친');            // 샘플 문장 없음
    await click(items[2]); expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ align: 'justify' }));
    await click(Array.from(host.querySelectorAll<HTMLElement>('.panel .link')).find(b => b.textContent?.includes('보기 설정'))!);
    expect(host.querySelector('[role=dialog][aria-label="보기 설정"]')).toBeTruthy();
  });
  it('슬라이더는 채움 비율(--p)을 갖고, CSS는 2px 가는 선·작은 손잡이다', async () => {
    await mount(); const r = host.querySelector<HTMLInputElement>('.bar.bottom input[type=range]')!; expect(r.style.getPropertyValue('--p')).toMatch(/%$/);
    const css = fs.readFileSync('src/styles.css', 'utf8').replace(/\s+/g, '');
    expect(css).toContain('::-webkit-slider-runnable-track{height:2px'); expect(css).toContain('::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px');
  });
});

