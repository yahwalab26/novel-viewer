// 서비스 워커: 앱 "껍데기"(HTML·JS·CSS·아이콘)만 캐시한다.
// - 같은 출처 GET 요청만 처리. Supabase(원고·계정) 등 다른 출처 요청은 절대 건드리지 않아 서버 원고가 기기에 캐시되지 않는다.
// - 페이지(HTML)는 네트워크 우선 → 새 배포가 바로 반영, 오프라인이면 캐시본 사용.
// - 정적 파일(해시 이름)은 캐시 우선 + 백그라운드 갱신.
const CACHE = 'nv-shell-v1';

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(req, { ignoreSearch: true })) || (await cache.match(self.registration.scope));
    if (hit) return hit;
    throw err;
  }
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const refresh = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await refresh) || Response.error();
}
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(req.mode === 'navigate' ? networkFirst(req) : staleWhileRevalidate(req));
});
