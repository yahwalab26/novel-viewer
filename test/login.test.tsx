// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import { Login } from '../src/Auth';
import NavPanel from '../src/viewer/NavPanel';
import { isStandalone, markStandalone } from '../src/standalone';
import type { Book, Bookmark } from '../src/core/model';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).__APP_VERSION__ = 'test';

let host: HTMLElement, root: Root;
beforeEach(() => { document.body.innerHTML = '<div id="h"></div>'; host = document.getElementById('h')!; root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); vi.useRealTimers(); });
const submit = async () => { const form = host.querySelector('form')!; await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); };
const fill = (name: string, v: string) => { (host.querySelector(`input[name=${name}]`) as HTMLInputElement).value = v; };   // 이벤트 없이 값만 채움 = 모바일 자동완성

describe('로그인 화면', () => {
  it('자동완성처럼 입력 이벤트 없이 채워진 값도 읽어 로그인하고, 성공하면 바로 화면 전환을 요청한다', async () => {
    const session = { user: { id: 'u1' } };
    const api: any = { signIn: vi.fn(async () => ({ error: null, session })) }; const onSignedIn = vi.fn();
    await act(async () => { root.render(<Login api={api} onSignedIn={onSignedIn} />); });
    fill('email', 'a@x.com'); fill('password', 'pw123');
    await submit();
    expect(api.signIn).toHaveBeenCalledWith('a@x.com', 'pw123'); expect(onSignedIn).toHaveBeenCalledWith(session);
    expect((host.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(false);   // 다시 누를 수 있는 상태로 복귀
  });
  it('실패하면 오류 문구를 보여주고 화면 전환하지 않는다', async () => {
    const api: any = { signIn: vi.fn(async () => ({ error: '이메일 또는 비밀번호가 올바르지 않습니다', session: null })) }; const onSignedIn = vi.fn();
    await act(async () => { root.render(<Login api={api} onSignedIn={onSignedIn} />); });
    fill('email', 'a@x.com'); fill('password', 'bad'); await submit();
    expect(host.querySelector('[role=alert]')!.textContent).toContain('올바르지 않습니다'); expect(onSignedIn).not.toHaveBeenCalled();
  });
  it('서버가 15초간 응답이 없으면 안내 문구를 보여주고 버튼이 다시 활성화된다', async () => {
    vi.useFakeTimers();
    const api: any = { signIn: vi.fn(() => new Promise(() => {})) };
    await act(async () => { root.render(<Login api={api} onSignedIn={() => {}} />); });
    fill('email', 'a@x.com'); fill('password', 'pw'); await submit();
    expect((host.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(host.querySelector('[role=alert]')!.textContent).toContain('응답이 없어요');
    expect((host.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(false);
  });
  it('모바일 입력 속성(이메일 키보드·자동 대문자 끔·go 키)이 설정되어 있다', async () => {
    await act(async () => { root.render(<Login api={{} as any} onSignedIn={() => {}} />); });
    const em = host.querySelector('input[name=email]')!, pw = host.querySelector('input[name=password]')!;
    expect(em.getAttribute('inputmode')).toBe('email'); expect(em.getAttribute('autocapitalize')).toBe('none'); expect(pw.getAttribute('enterkeyhint')).toBe('go');
  });
});

describe('북마크 목록', () => {
  const book: Book = { id: 'b', title: 't', format: 'docx', parserVersion: 1, addedAt: 0, chapters: [{ id: 'c0', title: '1화', blocks: [], charCount: 0 }, { id: 'c1', title: '2화', blocks: [], charCount: 0 }] };
  const bm = (id: string, c: string, label?: string): Bookmark => ({ id, bookId: 'b', chapterId: c, blockIndex: 1, label, createdAt: 1 });
  it('이동 버튼과 삭제 버튼이 분리된 구조(한 줄 미리보기 클래스 사용)로 렌더링된다', async () => {
    await act(async () => { root.render(<NavPanel book={book} ci={0} bookmarks={[bm('1', 'c1', '아주 긴 문장입니다 '.repeat(8)), bm('2', 'c0')]} onChapter={() => {}} onGo={() => {}} onDeleteBookmark={() => {}} onClose={() => {}} />); });
    await act(async () => { (host.querySelectorAll('.ptabs button')[1] as HTMLElement).click(); });
    const rows = host.querySelectorAll('.bmrow'); expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('.bmgo b')!.textContent).toBe('1화');                    // 회차순 정렬
    expect(rows[1].querySelector('.bmlabel')!.textContent).toContain('아주 긴 문장');
    expect(rows[0].querySelector('.bmlabel')).toBeNull();                                  // 미리보기 없는 북마크는 제목만
    expect(rows[0].querySelector('button.bmdel')!.getAttribute('aria-label')).toContain('삭제');
  });
  it('CSS: 미리보기는 한 줄(nowrap)+말줄임(…), 삭제 버튼은 폭 100%가 되지 않는다', () => {
    const css = fs.readFileSync('src/styles.css', 'utf-8');
    expect(css).toMatch(/\.bmgo \.bmlabel\{[^}]*white-space:nowrap[^}]*text-overflow:ellipsis/);
    expect(css).toMatch(/\.toc \.bmrow \.bmdel\{[^}]*width:auto/);
  });
});

describe('설치 앱(standalone) 여백', () => {
  it('설치 앱이면 html.standalone, 아니면 없음 (display-mode·iOS standalone 모두 인식)', () => {
    const mk = (mm: boolean, ios?: boolean) => ({ matchMedia: () => ({ matches: mm }), navigator: { standalone: ios } }) as any;
    expect(isStandalone(mk(false))).toBe(false); expect(isStandalone(mk(true))).toBe(true); expect(isStandalone(mk(false, true))).toBe(true);
    markStandalone(mk(true)); expect(document.documentElement.classList.contains('standalone')).toBe(true);
    markStandalone(mk(false)); expect(document.documentElement.classList.contains('standalone')).toBe(false);
  });
  it('CSS: 설치 앱에서만 좌우 여백 +1pt, 기본 20px / 넓은 화면 40px이 변수로 적용', () => {
    const css = fs.readFileSync('src/styles.css', 'utf-8');
    expect(css).toContain('html.standalone{--padx-extra:1pt}');
    expect(css).toMatch(/\.wrap\{[^}]*calc\(var\(--padx\) \+ var\(--padx-extra,0px\)\)/);
    expect(css).toContain(':root{--padx:20px}'); expect(css).toMatch(/@media \(min-width:900px\)\{[\s\S]*?:root\{--padx:40px\}/);
  });
});

import ErrorBoundary from '../src/ErrorBoundary';
import { PasswordModal } from '../src/Auth';
import { validateNewPassword } from '../src/server/access';

describe('출시용 안전장치', () => {
  it('화면 오류가 나면 하얀 화면 대신 안내와 새로고침 버튼', async () => {
    const Boom = () => { throw new Error('깨졌다'); };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => { root.render(<ErrorBoundary><Boom /></ErrorBoundary>); });
    expect(host.textContent).toContain('문제가 발생했어요'); expect(host.textContent).toContain('깨졌다'); expect(host.querySelector('button')!.textContent).toBe('새로고침');
    spy.mockRestore();
  });
  it('정상이면 그대로 보여준다', async () => {
    await act(async () => { root.render(<ErrorBoundary><p>정상</p></ErrorBoundary>); });
    expect(host.textContent).toBe('정상');
  });
  it('비밀번호 검증: 8자 미만·확인 불일치 거부', () => {
    expect(validateNewPassword('abc', 'abc')).toContain('8자'); expect(validateNewPassword('abcdefgh', 'abcdefgX')).toContain('일치');
    expect(validateNewPassword('abcdefgh', 'abcdefgh')).toBeNull();
  });
  const fillPw = (a: string, b: string) => { (host.querySelector('input[name=pw]') as HTMLInputElement).value = a; (host.querySelector('input[name=pw2]') as HTMLInputElement).value = b; };
  it('비밀번호 변경 창: 불일치면 서버를 부르지 않고, 일치하면 변경 후 완료 안내', async () => {
    const api: any = { changePassword: vi.fn(async () => null) };
    await act(async () => { root.render(<PasswordModal api={api} onClose={() => {}} />); });
    fillPw('새비밀번호123', '다른비밀번호123'); await submit();
    expect(host.querySelector('[role=alert]')!.textContent).toContain('일치'); expect(api.changePassword).not.toHaveBeenCalled();
    fillPw('새비밀번호123', '새비밀번호123'); await submit();
    expect(api.changePassword).toHaveBeenCalledWith('새비밀번호123'); expect(host.querySelector('[role=status]')!.textContent).toContain('변경했어요');
  });
  it('서버가 거부하면 그 이유를 보여준다', async () => {
    const api: any = { changePassword: vi.fn(async () => '이전과 다른 비밀번호를 입력해 주세요') };
    await act(async () => { root.render(<PasswordModal api={api} onClose={() => {}} />); });
    fillPw('같은비밀번호123', '같은비밀번호123'); await submit();
    expect(host.querySelector('[role=alert]')!.textContent).toContain('이전과 다른');
  });
});
