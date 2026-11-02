import { JSDOM } from 'jsdom';
(globalThis as any).DOMParser = new JSDOM().window.DOMParser; // 브라우저 DOMParser 대역
