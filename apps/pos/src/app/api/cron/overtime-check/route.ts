import { type NextRequest, NextResponse } from 'next/server'
import { prismaAdmin } from '@repo/db'
import { sendOvertimeNotice } from '@repo/line-bot'

export const dynamic = 'force-dynamic'

// §：逾 30 分鐘才可計收（CLAUDE.md 法規規定）
const GRACE_MINUTES = 30
// 每小時逾時費率（NTD），可由環境變數覆蓋
const RATE_PER_HOUR = parseInt(process.env.OVERTIME_RATE_PER_HOUR ?? '200', 10)

function verifyBearer(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // 僅開發環境允許無 secret，生產環境必須設定 CRON_SECRET
    return process.env.NODE_ENV === 'development'
  }
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!verifyBearer(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  try {
    const overdueAppts = await prismaAdmin.appointment.findMany({
      where: {
        pickupDeadlineAt: { lt: now },
        pickedUpAt: null,
        status: { in: ['IN_PROGRESS', 'COMPLETED'] },
      },
      select: {
        id: true,
        pickupDeadlineAt: true,
        customer: { select: { lineUserId: true } },
        pet: { select: { name: true } },
        order: { select: { id: true, overtimeFee: true } },
      },
    })

    const results = await Promise.allSettled(
      overdueAppts.map(async (appt) => {
        if (!appt.order) return { id: appt.id, skipped: 'no_order' }

        const overtimeMins = Math.floor(
          (now.getTime() - appt.pickupDeadlineAt!.getTime()) / 60_000,
        )

        if (overtimeMins <= GRACE_MINUTES) {
          return { id: appt.id, skipped: 'within_grace', overtimeMins }
        }

        // 計費：寬限期後每整小時收一次（無條件進位）
        const billableMins = overtimeMins - GRACE_MINUTES
        const fee = Math.ceil(billableMins / 60) * RATE_PER_HOUR

        const isFirstDetection = appt.order.overtimeFee === 0

        await prismaAdmin.order.update({
          where: { id: appt.order.id },
          data: { overtimeFee: fee },
        })

        // 僅第一次偵測到時推播，避免重複通知
        if (isFirstDetection && appt.customer.lineUserId) {
          await sendOvertimeNotice(appt.customer.lineUserId, {
            petName: appt.pet.name,
            overtimeMinutes: overtimeMins,
            fee,
          })
        }

        return { id: appt.id, overtimeMins, fee, notified: isFirstDetection }
      }),
    )

    const processed = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { error: String(r.reason) },
    )

    return NextResponse.json({
      checked: overdueAppts.length,
      processed,
      timestamp: now.toISOString(),
    })
  } catch (err) {
    console.error('[overtime-check]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
