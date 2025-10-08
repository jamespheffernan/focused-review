import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(() => {
  const isElectron = process.env.ELECTRON === 'true'
  
  return {
    base: './', // Use relative paths for Electron
    server: {
      port: 5174, // Match the port that Electron expects
      strictPort: true // Fail if port is already in use
    },
    plugins: [
      react(),
      // Only enable PWA for web builds, not Electron
      ...(isElectron ? [] : [
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.svg'],
          manifest: { 
            name: 'Weekly Review HUD', 
            short_name: 'ReviewHUD', 
            start_url: '/', 
            display: 'standalone',
            theme_color: '#ffffff',
            background_color: '#ffffff',
            icons: [
              {
                src: 'favicon.svg',
                sizes: 'any',
                type: 'image/svg+xml'
              }
            ]
          }
        })
      ])
    ],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js'
        }
      }
    }
  }
})
