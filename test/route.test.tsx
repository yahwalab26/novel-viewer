// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import fs from 'node:fs';
import { parseRoute, readHash, navigate, back, clear } from '../src/core/route';
import AuthorHome from '../src/AuthorHome';
import { createMockApi } from '../src/mock/mockApi';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; (globalThis as any).__APP_VERSION__ = 'test';
let host: HTMLElement, root: Root;
beforeEach(() => { document.body.innerHTML = '<div id="h"></div>'; host = document.getElementById('h')!; root = createRoot(host); Element.prototype.scrollIntoView = () => {}; history.replaceState(null, '', '/'); localStorage.clear(); });
afterEach(() => { act(() => root.unmount()); history.replaceState(null, '', '/'); });
const wait = () => act(async () => { await new Promise(r => setTimeout(r, 30)); });
const author = { name: '이서연', email: 'a@example.com', role: 'author' as const };

describe('주소(해시) 라우팅 — 새로고침해도 보던 화면 유지', () => {
  it('읽기 주소를 만들고 다시 해석한다(특수문자 id 포함), 이상한 주소는 무시', () => {
    expect(parseRoute(readHash('s', 'b1'))).toEqual({ kind: 'read', scope: 's', id: 'b1' });
    expect(parseRoute(readHash('l', 'a b/한글'))).toEqual({ kind: 'read', scope: 'l', id: 'a b/한글' });
    for (const h of ['', '#', '#/read', '#/read/x/b1', '#/read/s/', '#/read/s/a/b', '#/other', '#/read/s/%E0%A4%A']) expect(parseRoute(h), h).toBeNull();
  });
  it('navigate는 해시를 바꾸고 기록을 남기며, back은 이 앱이 남긴 기록이면 뒤로 간다', async () => {
    navigate(readHash('s', 'b1')); expect(location.hash).toBe('#/read/s/b1'); expect(history.state?.nv).toBe(1);
    clear(); expect(location.hash).toBe('');
    back(); expect(location.hash).toBe('');                         // 기록이 없으면 해시만 지움
  });
  it('콜드 스타트(설치 앱 재실행): 해시가 없고 6시간 안의 기록이 있으면 그 읽기 화면으로 이어서 열고, 오래되면 무시한다', async () => {
    localStorage.setItem('nv.last', JSON.stringify({ h: '#/read/s/b1', t: Date.now() }));
    vi.resetModules(); await import('../src/core/route'); expect(location.hash).toBe('#/read/s/b1');
    history.replaceState(null, '', '/'); localStorage.setItem('nv.last', JSON.stringify({ h: '#/read/s/b1', t: Date.now() - 7 * 3600e3 }));
    vi.resetModules(); await import('../src/core/route'); expect(location.hash).toBe('');
  });
  it('목록으로 나가면(clear) 기억도 지워진다', () => {
    navigate(readHash('s', 'b1')); expect(localStorage.getItem('nv.last')).toContain('b1');
    clear(); expect(localStorage.getItem('nv.last')).toBeNull();
  });
  it('작가 화면: 주소가 읽기면 목록을 다 불러온 뒤 그 원고를 연다(복사 방지 켜짐), 목록 버튼으로 주소가 지워진다', async () => {
    history.replaceState(null, '', '/#/read/s/b1');
    await act(async () => { root.render(<AuthorHome api={createMockApi()} userId="a1" account={author} onLogout={() => {}} />); }); await wait();
    expect(host.querySelector('.viewer')).toBeTruthy(); expect(host.querySelector('.viewer.protect')).toBeTruthy();
    const back = Array.from(host.querySelectorAll('.bar button')).find(b => b.textContent?.includes('목록')) as HTMLElement;
    await act(async () => { back.click(); }); await wait();
    expect(location.hash).toBe(''); expect(host.querySelector('.viewer')).toBeNull(); expect(host.querySelector('.bk-list')).toBeTruthy();
  });
  it('작가 화면: 목록에서 책을 누르면 주소가 #/read/s/<id>로 바뀌고 읽기 화면이 열린다', async () => {
    await act(async () => { root.render(<AuthorHome api={createMockApi()} userId="a1" account={author} onLogout={() => {}} />); }); await wait();
    await act(async () => { host.querySelector<HTMLElement>('.bk-list li button')!.click(); }); await wait();
    expect(location.hash).toMatch(/^#\/read\/s\//); expect(host.querySelector('.viewer')).toBeTruthy();
  });
});

describe('형광펜 툴바 — 클래스 충돌·반응형 회귀 방지', () => {
  const css = fs.readFileSync('src/styles.css', 'utf-8'), ui = fs.readFileSync('src/viewer/AnnotationUI.tsx', 'utf-8');
  it('서재의 .dot(7px 점)과 겹치지 않도록 형광펜 점은 hl-dot을 쓰고, 색이 정의돼 있다', () => {
    expect(ui).not.toMatch(/className=\{`dot /); expect(ui).toMatch(/hl-dot hl-/);
    for (const c of ['yellow', 'green', 'pink', 'blue']) { expect(css).toContain(`--hl-${c}:`); expect(css).toContain(`.hl-dot.hl-${c}{background:var(--hl-${c})}`); }
  });
  it('툴바는 한 줄로 화면 안에 들어오고, 안내 문구는 …으로 줄어든다', () => {
    expect(css).toMatch(/\.selbar\{[^}]*flex-wrap:nowrap[^}]*max-width:calc\(100% - 24px\)/);
    expect(css).toMatch(/\.selnote\{[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/);
    expect(css).toMatch(/\.memo-btn\{[^}]*white-space:nowrap/);
  });
});
