// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useKeyboardInset } from '../src/viewer/useKeyboardInset';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
function Box() { const r = useRef<HTMLDivElement>(null); useKeyboardInset(r); return <div ref={r} id="v" />; }
const fakeVV = (o: { height: number; offsetTop?: number; scale?: number }) => { const l: Record<string, (() => void)[]> = {};
  const vv: any = { ...o, offsetTop: o.offsetTop ?? 0, scale: o.scale ?? 1, addEventListener: (t: string, f: () => void) => (l[t] ??= []).push(f), removeEventListener: () => {} };
  return { vv, fire: () => Object.values(l).flat().forEach(f => f()) }; };
afterEach(() => { delete (window as any).visualViewport; });

describe('아이폰 키보드 높이 반영', () => {
  it('키보드가 올라오면 --kb·--vvh 를 넣고, 내려가면 되돌린다', () => {
    (window as any).innerHeight = 800; const f = fakeVV({ height: 800 }); (window as any).visualViewport = f.vv;
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    act(() => root.render(<Box />)); const el = host.querySelector('#v') as HTMLElement;
    expect(el.style.getPropertyValue('--kb')).toBe('0px'); expect(el.hasAttribute('data-kb')).toBe(false);
    f.vv.height = 500; act(() => f.fire());                                   // 키보드 300px
    expect(el.style.getPropertyValue('--kb')).toBe('300px'); expect(el.style.getPropertyValue('--vvh')).toBe('500px'); expect(el.hasAttribute('data-kb')).toBe(true);
    f.vv.height = 400; f.vv.offsetTop = 100; act(() => f.fire());             // 사파리가 화면을 100px 밀어 올린 경우도 같은 위치
    expect(el.style.getPropertyValue('--kb')).toBe('300px');
    f.vv.height = 800; f.vv.offsetTop = 0; act(() => f.fire());
    expect(el.style.getPropertyValue('--kb')).toBe('0px'); expect(el.hasAttribute('data-kb')).toBe(false);
    act(() => root.unmount());
  });
  it('손가락 확대(scale>1)나 주소창 변화(작은 차이)는 키보드로 보지 않는다', () => {
    (window as any).innerHeight = 800; const f = fakeVV({ height: 500, scale: 2 }); (window as any).visualViewport = f.vv;
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    act(() => root.render(<Box />)); const el = host.querySelector('#v') as HTMLElement;
    expect(el.hasAttribute('data-kb')).toBe(false);
    f.vv.scale = 1; f.vv.height = 760; act(() => f.fire()); expect(el.hasAttribute('data-kb')).toBe(false);
    act(() => root.unmount());
  });
  it('visualViewport 가 없는 브라우저에서도 오류 없이 지나간다', () => {
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    expect(() => act(() => root.render(<Box />))).not.toThrow(); act(() => root.unmount());
  });
  it('CSS: 패널이 --kb 만큼 올라가고 입력칸은 16px(사파리 자동 확대 방지)', async () => {
    const css = (await import('node:fs')).readFileSync('src/styles.css', 'utf8');
    expect(css).toMatch(/\.viewer \.panel\{bottom:var\(--kb,0px\)/); expect(css).toMatch(/\.viewer \.panel textarea[^}]*font-size:16px/);
  });
});
