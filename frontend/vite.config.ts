import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Em desenvolvimento, /api e /healthz vão para o backend Flask (python run.py, porta 8080)
const apiTarget = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8080';

// versão exibida no menu lateral vem do package.json
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': apiTarget,
      '/healthz': apiTarget,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // o arquivo principal (React + núcleo do Ant Design) tem ~820 kB, ~270 kB comprimido;
    // o restante de cada módulo só é baixado quando a tela é aberta
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
  },
});
