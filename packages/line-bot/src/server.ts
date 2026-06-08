import { serve } from '@hono/node-server'
import app from './app'

const port = parseInt(process.env.PORT ?? '3002')

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`LINE Bot server running at http://localhost:${info.port}`)
  console.log('POST /webhook  — LINE webhook endpoint')
  console.log('GET  /health   — health check')
})
