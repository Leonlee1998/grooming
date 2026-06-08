import { Hono } from 'hono'
import { validateSignature } from '@line/bot-sdk'
import type { webhook } from '@line/bot-sdk'
import { handleMessage } from './handlers/message'
import { handlePostback } from './handlers/postback'
import { handleFollow } from './handlers/follow'

const app = new Hono()

app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }))

app.post('/webhook', async (c) => {
  const body = await c.req.text()
  const signature = c.req.header('x-line-signature') ?? ''
  const secret = process.env.LINE_CHANNEL_SECRET ?? ''

  if (!validateSignature(body, secret, signature)) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  const { events } = JSON.parse(body) as { events: webhook.Event[] }

  await Promise.all(
    events.map(async (event) => {
      try {
        if (event.type === 'message')
          await handleMessage(event as webhook.MessageEvent)
        else if (event.type === 'postback')
          await handlePostback(event as webhook.PostbackEvent)
        else if (event.type === 'follow')
          await handleFollow(event as webhook.FollowEvent)
      } catch (err) {
        console.error(`[webhook] error handling ${event.type}:`, err)
      }
    }),
  )

  return c.json({ ok: true })
})

export default app
