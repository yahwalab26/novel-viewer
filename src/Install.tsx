import { useEffect, useState } from 'react';

// Chrome/Edge/Android: beforeinstallprompt 를 붙잡아 두었다가 버튼으로 띄운다. iOS Safari: 안내문만 가능.
let deferred: any = null; const subs = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; subs.forEach(f => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; subs.forEach(f => f()); });
}
export const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);
export const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

export function useInstall() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick(n => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  const available = !isStandalone() && (!!deferred || isIos());
  const install = async () => {
    if (deferred) { deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; tick(n => n + 1); }
    else if (isIos()) alert('Safari 아래쪽의 공유 버튼(네모에 화살표)을 누른 뒤\n"홈 화면에 추가"를 선택해 주세요.');
  };
  return { available, install };
}
