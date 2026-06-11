import { type NextRequest, NextResponse } from 'next/server'
import { prismaAdmin } from '@repo/db'
import { sendPickupReminder } from '@repo/line-bot'

export const dynamic = 'force-dynamic'

// cron 每 5 分鐘執行一次，用 5 分鐘滑動視窗避免重複通知
const REMIND_BEFORE_MINUTES = 30
const WINDOW_MINUTES = 5

function verifyBearer(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return process.env.NODE_ENV === 'development'
  }
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!verifyBearer(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  // 尋找 pickupDeadlineAt 落在 [now+25min, now+30min) 的預約
  const windowStart = new Date(
    now.getTime() + (REMIND_BEFORE_MINUTES - WINDOW_MINUTES) * 60_000,
  )
  const windowEnd = new Date(now.getTime() + REMIND_BEFORE_MINUTES * 60_000)

  const storeName = process.env.STORE_NAME ?? '寵物美容店'

  try {
    const appts = await prismaAdmin.appointment.findMany({
      where: {
        pickupDeadlineAt: { gte: windowStart, lt: windowEnd },
        pickedUpAt: null,
        status: { in: ['IN_PROGRESS', 'COMPLETED'] },
      },
      select: {
        id: true,
        pickupDeadlineAt: true,
        customer: { select: { lineUserId: true } },
        pet: { select: { name: true } },
      },
    })

    const results = await Promise.allSettled(
      appts.map(async (appt) => {
        if (!appt.customer.lineUserId) {
          return { id: appt.id, skipped: 'no_line_user' }
        }

        const pickupTime = appt.pickupDeadlineAt!.toLocaleTimeString('zh-TW', {
          timeZone: 'Asia/Taipei',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })

        await sendPickupReminder(appt.customer.lineUserId, {
          petName: appt.pet.name,
          pickupDeadlineAt: pickupTime,
          storeName,
        })

        return { id: appt.id, notified: true }
      }),
    )

    const processed = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { error: String(r.reason) },
    )

    return NextResponse.json({
      checked: appts.length,
      processed,
      timestamp: now.toISOString(),
    })
  } catch (err) {
    console.error('[pickup-reminder]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
