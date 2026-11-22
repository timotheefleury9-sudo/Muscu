/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

function buildId() {
  const ts = new Date().toISOString()
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    return `${sha} ${ts}`
  } catch {
    return ts
  }
}

// Dépôt GitHub : timotheefleury9-sudo/Muscu → publié sur /Muscu/ (chemins sensibles à la casse)
export default defineConfig({
  base: '/Muscu/',
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Muscu',
        short_name: 'Muscu',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/Muscu/',
        scope: '/Muscu/',
        background_color: '#0e0f12',
        theme_color: '#181a1f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest,json}'],
        navigateFallback: '/Muscu/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: false,
  },
})
