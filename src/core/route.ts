import { useEffect, useState } from 'react';

/** 화면 위치를 주소(#해시)에 기록해 새로고침·뒤로가기에도 보던 화면이 유지되게 한다.
 *  #/read/s/<id> = 서버 원고 읽기 · #/read/l/<id> = 이 기기 원고 읽기. (GitHub Pages는 경로 재작성이 안 돼서 해시 방식) */
export type Route = { kind: 'read'; scope: 's' | 'l'; id: string };

export const readHash = (scope: 's' | 'l', id: string) => `#/read/${scope}/${encodeURIComponent(id)}`;
export function parseRoute(hash: string): Route | null {
  const m = /^#\/read\/([sl])\/([^/?#]+)$/.exec(hash);
  if (!m) return null;
  try { return { kind: 'read', scope: m[1] as 's' | 'l', id: decodeURIComponent(m[2]) }; } catch { return null; }
}

const listeners = new Set<() => void>();
const base = () => location.pathname + location.search;
const KEY = 'nv.last', KEEP_MS = 6 * 3600e3;
/** 마지막으로 읽던 화면을 기억 — 설치 앱을 껐다 켜면 주소의 해시가 사라지기 때문(6시간 안에만 이어서 열기). 목록으로 나가면 지운다 */
const remember = () => { try { if (parseRoute(location.hash)) localStorage.setItem(KEY, JSON.stringify({ h: location.hash, t: Date.now() })); else localStorage.removeItem(KEY); } catch { /* 저장 불가 환경은 무시 */ } };
const emit = () => { remember(); listeners.forEach(f => f()); };
if (typeof window !== 'undefined') {
  if (!location.hash) { try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && Date.now() - j.t < KEEP_MS && parseRoute(j.h)) history.replaceState(null, '', base() + j.h); } catch { /* 무시 */ } }
  remember();
  window.addEventListener('popstate', emit); window.addEventListener('hashchange', emit);
}

/** 새 화면으로 이동(뒤로가기로 돌아올 수 있게 기록을 남김) */
export function navigate(hash: string) { history.pushState({ nv: 1 }, '', hash); emit(); }
/** 한 단계 뒤로. 이 앱이 남긴 기록이면 뒤로가기, 직접 주소로 들어온 경우엔 해시만 지움 */
export function back() { if (history.state?.nv) history.back(); else clear(); }
/** 기록을 남기지 않고 해시를 지움(열 수 없는 주소 정리용) */
export function clear() { history.replaceState(null, '', base()); emit(); }

export function useRoute(): Route | null {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => { const f = () => setHash(location.hash); listeners.add(f); f(); return () => { listeners.delete(f); }; }, []);
  return parseRoute(hash);
}
