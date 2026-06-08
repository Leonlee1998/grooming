import type { webhook } from '@line/bot-sdk'
import { getClient } from '../client'
import { setSession } from '../session'
import { prismaAdmin } from '@repo/db'

export async function handleFollow(event: webhook.FollowEvent): Promise<void> {
  const lineUserId = event.source?.userId
  if (!lineUserId) return
  const replyToken = event.replyToken
  if (!replyToken) return

  const client = getClient()

  const customer = await prismaAdmin.customer.findUnique({
    where: { lineUserId },
    select: { name: true },
  })

  if (customer) {
    await setSession(lineUserId, { step: 'idle' })
    await client.replyMessage({
      replyToken,
      messages: [
        {
          type: 'text',
          text: `歡迎回來，${customer.name}！\n\n點下方選單可以開始預約或查詢預約紀錄。`,
        },
      ],
    })
  } else {
    await setSession(lineUserId, { step: 'awaiting_phone' })
    await client.replyMessage({
      replyToken,
      messages: [
        {
          type: 'text',
          text: '歡迎使用寵物美容預約服務！\n\n請輸入您的手機號碼以綁定帳號\n（例：0912345678）：',
        },
      ],
    })
  }
}
