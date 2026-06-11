import type { webhook } from '@line/bot-sdk'
import { getClient } from '../client'
import { getSession, setSession } from '../session'
import { prismaAdmin } from '@repo/db'

export async function handleMessage(
  event: webhook.MessageEvent,
): Promise<void> {
  if (event.message.type !== 'text') return

  const lineUserId = event.source?.userId
  if (!lineUserId) return
  const replyToken = event.replyToken
  if (!replyToken) return

  const client = getClient()
  const text = (event.message as { text: string }).text.trim()
  const session = (await getSession(lineUserId)) ?? { step: 'idle' as const }

  // ── 等待手機號碼綁定 ──────────────────────────────────────────────────────────
  if (session.step === 'awaiting_phone') {
    const phone = text.replace(/[-\s]/g, '')
    if (!/^09\d{8}$/.test(phone)) {
      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: '手機號碼格式不正確，請輸入 10 碼手機號碼（例：0912345678）：',
          },
        ],
      })
      return
    }

    const storeId = process.env.STORE_ID
    if (!storeId) {
      await client.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: '系統設定錯誤，請聯絡管理員。' }],
      })
      return
    }
    const customer = await prismaAdmin.customer.findUnique({
      where: { storeId_phone: { storeId, phone } },
      select: { id: true, name: true, lineUserId: true },
    })

    if (!customer) {
      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: `找不到手機號碼 ${phone} 的帳號。\n請確認號碼是否正確，或請至美容店登記建立帳號。`,
          },
        ],
      })
      return
    }

    if (customer.lineUserId && customer.lineUserId !== lineUserId) {
      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: '此手機號碼已綁定其他 LINE 帳號，請聯絡門市處理。',
          },
        ],
      })
      return
    }

    await prismaAdmin.customer.update({
      where: { id: customer.id },
      data: { lineUserId },
    })
    await setSession(lineUserId, { step: 'idle' })
    await client.replyMessage({
      replyToken,
      messages: [
        {
          type: 'text',
          text: `${customer.name} 您好！帳號綁定成功 ✓\n\n點下方選單即可開始預約或查詢預約紀錄。`,
        },
      ],
    })
    return
  }

  // ── 在預約流程中收到文字訊息 ──────────────────────────────────────────────────
  if (session.step !== 'idle') {
    if (text === '取消' || text === '重來') {
      await setSession(lineUserId, { step: 'idle' })
      await client.replyMessage({
        replyToken,
        messages: [
          { type: 'text', text: '已取消，可重新使用下方選單開始操作。' },
        ],
      })
    } else {
      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: '請使用下方按鈕完成操作，或輸入「取消」中止目前流程。',
          },
        ],
      })
    }
    return
  }

  // ── Idle 狀態 ─────────────────────────────────────────────────────────────────
  await client.replyMessage({
    replyToken,
    messages: [
      {
        type: 'text',
        text: '請使用下方選單進行操作：\n• 我要預約\n• 查詢預約',
      },
    ],
  })
}
