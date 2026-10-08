import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']

export default defineConfig(({ command, mode }) => {
  // .env is not committed. Fail the build loudly instead of shipping an app
  // that can't reach Supabase — a failed Vercel build keeps the live site as is.
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), '')
    const missing = REQUIRED_ENV.filter((k) => !env[k])
    if (missing.length) {
      throw new Error(`Missing ${missing.join(', ')}. Set them in .env locally or in Vercel → Settings → Environment Variables.`)
    }
  }

  return {
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Stock Collection Portal',
        short_name: 'Stock Portal',
        description: 'Agency stock count collection for store staff and admins',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        theme_color: '#1B5E37',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('supabase.co'),
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ]
  }
})