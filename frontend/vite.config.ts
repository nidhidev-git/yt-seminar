import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
    allowedHosts: [
      'meeting.studyhex.in',
      '210.79.129.176',
    ],
    proxy: {
      '/api': {
        target: 'http://210.79.129.176:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://210.79.129.176:5000',
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    },
  },

  preview: {
    allowedHosts: [
      'meeting.studyhex.in',
      '210.79.129.176',
    ],
  },
})
