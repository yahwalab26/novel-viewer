import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));
// base './' = GitHub Pages(저장소 이름이 주소에 붙는 방식)에서도, 로컬에서도 같은 빌드가 동작
// 버전은 package.json 한 곳만 고치면 화면에 자동 반영된다
export default defineConfig({ base: './', plugins: [react()], define: { __APP_VERSION__: JSON.stringify(version) } });
