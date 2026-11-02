import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' = GitHub Pages(저장소 이름이 주소에 붙는 방식)에서도, 로컬에서도 같은 빌드가 동작
export default defineConfig({ base: './', plugins: [react()] });
