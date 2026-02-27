import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SPARS Collector',
        short_name: 'SPARS',
        start_url: '/collect/',
        scope: '/collect/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: '/collect/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/collect/pwa-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  base: process.env.VITE_BASE_PATH || '/collect/',
  server: { strictPort: true }
});
