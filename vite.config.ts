import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    target: 'es2022',
    rolldownOptions: {
      input: {
        main: resolve(root, 'index.html'),
        en: resolve(root, 'en/index.html'),
      },
    },
  },
});
