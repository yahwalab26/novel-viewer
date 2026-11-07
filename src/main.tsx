import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import './styles.css';
import { markStandalone } from './standalone';

markStandalone();                                     // 설치 앱이면 <html class="standalone">
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);

// 앱 설치·오프라인 껍데기용 서비스 워커 (운영 빌드에서만). 서버 원고는 캐시하지 않는다 — public/sw.js 참고
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
