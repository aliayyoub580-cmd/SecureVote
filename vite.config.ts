import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: parseInt(process.env.PORT || '5173', 10),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('recharts')) return 'vendor-recharts'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'vendor-editor'
          if (id.includes('framer-motion')) return 'vendor-motion'
          if (id.includes('dompurify')) return 'vendor-dompurify'
          if (id.includes('@marsidev')) return 'vendor-turnstile'
          if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react'
          return 'vendor'
        },
      },
    },
  },
})
