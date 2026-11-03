import { describe, it, expect } from 'vitest';
import { resolveAccess, loginErrorMessage } from '../src/server/access';
import { createApi } from '../src/server/api';

describe('resolveAccess', () => {
  it('역할별 판정', () => {
    expect(resolveAccess({ role: 'editor', name: '편집', email: 'e@x.com' })).toEqual({ kind: 'editor', name: '편집', email: 'e@x.com' });
    expect(resolveAccess({ role: 'author', name: null, email: null })).toEqual({ kind: 'author', name: '', email: '' });
  });
  it('프로필 없음/알 수 없는 역할 = 권한 없음', () => {
    expect(resolveAccess(null)).toEqual({ kind: 'none' });
    expect(resolveAccess({ role: 'admin' })).toEqual({ kind: 'none' });
  });
  it('오류 분류', () => {
    expect(resolveAccess(null, { code: 'PGRST106', message: 'x' }).kind).toBe('schema-not-exposed');
    expect(resolveAccess(null, { message: 'The schema must be one of the following: public' }).kind).toBe('schema-not-exposed');
    expect(resolveAccess(null, { code: '42501', message: 'permission denied' }).kind).toBe('error');
    expect(resolveAccess({ role: 'editor' }, { message: 'boom' }).kind).toBe('error');   // 오류가 있으면 데이터가 있어도 신뢰하지 않음
  });
  it('로그인 오류 한국어', () => {
    expect(loginErrorMessage('Invalid login credentials')).toContain('올바르지 않습니다');
    expect(loginErrorMessage('Email not confirmed')).toContain('인증');
  });
});

// 가짜 서버로 실제 요청 형태(스키마 헤더·키·토큰)를 검증
function fakeServer(profile: unknown, profileStatus = 200) {
  const calls: { url: string; method: string; headers: Headers }[] = [];
  const f = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url;
    const headers = new Headers(init?.headers ?? (input as Request).headers);
    calls.push({ url, method: init?.method ?? 'GET', headers });
    const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
    if (url.includes('/auth/v1/token')) return json({ access_token: 'aaa.bbb.ccc', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: 'u-1', email: 'e@x.com', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' } });
    if (url.includes('/rest/v1/profiles')) return json(profile, profileStatus);
    return json({}, 404);
  }) as typeof fetch;
  return { f, calls };
}

describe('createApi (가짜 서버)', () => {
  it('로그인 → viewer 스키마 헤더·키·토큰으로 profiles 조회 → 편집자', async () => {
    const { f, calls } = fakeServer([{ name: '편집', email: 'e@x.com', role: 'editor' }]);
    const api = createApi({ fetch: f });
    expect(await api.signIn(' e@x.com ', 'pw')).toBeNull();
    expect(calls[0].url).toContain('grant_type=password');
    const s = await api.session(); expect(s?.user.id).toBe('u-1');
    expect(await api.loadAccess('u-1')).toEqual({ kind: 'editor', name: '편집', email: 'e@x.com' });
    const rest = calls.find(c => c.url.includes('/rest/v1/profiles'))!;
    expect(rest.headers.get('accept-profile')).toBe('viewer');                  // ← 전용 스키마로 요청
    expect(rest.headers.get('apikey')).toMatch(/^sb_publishable_/);
    expect(rest.headers.get('authorization')).toBe('Bearer aaa.bbb.ccc');
    expect(rest.url).toContain('id=eq.u-1');
  });
  it('프로필이 없으면 권한 없음', async () => {
    const { f } = fakeServer([]); const api = createApi({ fetch: f });
    await api.signIn('a@x.com', 'pw'); expect((await api.loadAccess('u-1')).kind).toBe('none');
  });
  it('Exposed schemas 미설정(PGRST106) → 안내 상태', async () => {
    const { f } = fakeServer({ code: 'PGRST106', message: 'The schema must be one of the following: public, graphql_public' }, 406);
    const api = createApi({ fetch: f }); await api.signIn('a@x.com', 'pw');
    expect((await api.loadAccess('u-1')).kind).toBe('schema-not-exposed');
  });
});
