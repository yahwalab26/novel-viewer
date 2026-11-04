import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

describe('PWA 매니페스트·아이콘', () => {
  const man = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf-8'));
  const png = (f: string) => { const b = fs.readFileSync('public/' + f); expect(b.subarray(1, 4).toString()).toBe('PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  it('설치 가능 조건: 이름·standalone·상대경로 start_url/scope', () => {
    expect(man).toMatchObject({ name: '웹소설 뷰어', display: 'standalone', start_url: './', scope: './', lang: 'ko' });
    expect(man.short_name.length).toBeLessThanOrEqual(12);
  });
  it('아이콘 파일이 실제로 있고 선언한 크기와 같다(192·512, maskable 포함)', () => {
    for (const i of man.icons) { const [w, h] = png(i.src); expect(`${w}x${h}`).toBe(i.sizes); }
    expect(man.icons.some((i: any) => i.sizes === '192x192')).toBe(true);
    expect(man.icons.some((i: any) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
    expect(png('icons/apple-touch-icon.png')).toEqual([180, 180]);
  });
  it('index.html 이 매니페스트·아이콘을 연결', () => {
    const h = fs.readFileSync('index.html', 'utf-8');
    expect(h).toContain('rel="manifest"'); expect(h).toContain('apple-touch-icon'); expect(h).toContain('viewport-fit=cover');
  });
});

// 서비스 워커를 가짜 브라우저 환경에서 실행해 캐시 전략을 검증
function loadSw() {
  const handlers: Record<string, (e: any) => void> = {}, store = new Map<string, Response>(), names = new Set(['nv-shell-v1', 'old-cache']);
  const st = { fetch: (async (): Promise<Response> => { throw new Error('offline'); }) as (r: any) => Promise<Response>, claimed: false };
  const keyOf = (r: any) => (typeof r === 'string' ? r : r.url);
  const cache = { put: async (r: any, res: Response) => { store.set(keyOf(r), res); }, match: async (r: any) => store.get(keyOf(r))?.clone() };
  const caches = { open: async () => cache, keys: async () => [...names], delete: async (k: string) => names.delete(k) };
  const self: any = { addEventListener: (t: string, h: any) => { handlers[t] = h; }, location: { origin: 'https://yahwalab.xyz' }, registration: { scope: 'https://yahwalab.xyz/' }, skipWaiting() {}, clients: { claim: async () => { st.claimed = true; } } };
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf-8'), { self, caches, fetch: (r: any) => st.fetch(r), URL, Response, Promise });
  const fire = async (req: any) => { const ev: any = { request: req }; ev.respondWith = (p: Promise<Response>) => { ev.p = p; }; handlers.fetch(ev); return ev.p ? await ev.p : undefined; };
  return { st, store, names, fire, handlers };
}
const page = { method: 'GET', url: 'https://yahwalab.xyz/', mode: 'navigate' };
const asset = { method: 'GET', url: 'https://yahwalab.xyz/assets/app-abc.js', mode: 'no-cors' };

describe('서비스 워커', () => {
  it('다른 출처(Supabase)·GET 이외 요청은 건드리지 않는다 → 서버 원고가 캐시되지 않음', async () => {
    const sw = loadSw();
    expect(await sw.fire({ method: 'GET', url: 'https://wddixxdrndgvjgicwunu.supabase.co/rest/v1/books', mode: 'cors' })).toBeUndefined();
    expect(await sw.fire({ method: 'POST', url: 'https://yahwalab.xyz/x', mode: 'cors' })).toBeUndefined();
    expect(sw.store.size).toBe(0);
  });
  it('페이지는 네트워크 우선: 온라인이면 새 것을 쓰고 캐시 갱신, 오프라인이면 캐시본', async () => {
    const sw = loadSw();
    sw.st.fetch = async () => new Response('NEW'); expect(await (await sw.fire(page)).text()).toBe('NEW');
    sw.st.fetch = async () => { throw new Error('offline'); }; expect(await (await sw.fire(page)).text()).toBe('NEW');
    sw.st.fetch = async () => new Response('NEWER'); expect(await (await sw.fire(page)).text()).toBe('NEWER');          // 새 배포가 바로 반영
  });
  it('오프라인인데 해당 주소 캐시가 없으면 앱 루트 캐시로 대체, 그것도 없으면 오류', async () => {
    const sw = loadSw();
    await expect(sw.fire({ ...page, url: 'https://yahwalab.xyz/foo' })).rejects.toThrow('offline');
    sw.store.set('https://yahwalab.xyz/', new Response('ROOT'));
    expect(await (await sw.fire({ ...page, url: 'https://yahwalab.xyz/foo' })).text()).toBe('ROOT');
  });
  it('정적 파일: 캐시가 있으면 즉시 사용하고 뒤에서 갱신, 없으면 네트워크, 둘 다 안 되면 오류 응답', async () => {
    const sw = loadSw();
    expect((await sw.fire(asset)).type).toBe('error');
    sw.st.fetch = async () => new Response('JS1'); expect(await (await sw.fire(asset)).text()).toBe('JS1');
    sw.st.fetch = async () => { throw new Error('offline'); }; expect(await (await sw.fire(asset)).text()).toBe('JS1');
  });
  it('활성화 시 이전 캐시를 정리하고 즉시 제어권을 가져간다', async () => {
    const sw = loadSw(); sw.handlers.activate({ waitUntil: async (p: Promise<void>) => { await p; } });
    await new Promise(r => setTimeout(r, 10));
    expect([...sw.names]).toEqual(['nv-shell-v1']); expect(sw.st.claimed).toBe(true);
  });
});
