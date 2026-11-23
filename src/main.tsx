import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import './styles.css';
import './styles/tokens.css';
import './styles/auth.css';
import './styles/library.css';
import { markStandalone } from './standalone';

markStandalone();                                     // 설치 앱이면 <html class="standalone">
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);

// 새 배포로 옛 조각 파일이 사라져 불러오기에 실패하면(Vite 가 알려 줌) 한 번만 자동 새로고침 — 10초 안에 또 실패하면 반복하지 않는다
window.addEventListener('vite:preloadError', () => {
  try {
    if (sessionStorage.getItem('nv-chunk-reload')) return;
    sessionStorage.setItem('nv-chunk-reload', '1'); setTimeout(() => sessionStorage.removeItem('nv-chunk-reload'), 10000);
    location.reload();
  } catch { /* 저장소 막힘 */ }
});

// 앱 설치·오프라인 껍데기용 서비스 워커 (운영 빌드에서만). 서버 원고는 캐시하지 않는다 — public/sw.js 참고
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
