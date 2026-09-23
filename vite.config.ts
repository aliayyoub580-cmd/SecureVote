import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function registerDevPlugin() {
  return {
    name: 'register-dev-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url === '/api/register' && req.method === 'POST') {
          try {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk)
            req.body = JSON.parse(Buffer.concat(chunks).toString())
            // Ensure standard response helper methods exist
            if (!res.status) {
              res.status = function (code: number) {
                res.statusCode = code
                return res
              }
            }
            if (!res.json) {
              res.json = function (data: any) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(data))
                return res
              }
            }
            const { default: handler } = await import('./api/register.js')
            await handler(req, res)
          } catch (e: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: e.message }))
          }
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  server: {
    port: parseInt(process.env.PORT || '5173', 10),
  },
  plugins: [react(), tailwindcss(), registerDevPlugin()],
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
