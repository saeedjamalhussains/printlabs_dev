import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export const createViteConfig = (appConfigUrl, port) => defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', appConfigUrl)),
      '@brand': fileURLToPath(new URL('../../shared/assets/brand', appConfigUrl)),
    },
  },
  server: { port, strictPort: true },
});
