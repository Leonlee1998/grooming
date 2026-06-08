import { prismaAdmin } from '@repo/db'

export type SessionState =
  | { step: 'idle' }
  | { step: 'awaiting_phone' }
  | { step: 'select_pet'; customerId: string }
  | {
      step: 'select_services'
      customerId: string
      petId: string
      selectedIds: string[]
    }
  | {
      step: 'select_date'
      customerId: string
      petId: string
      serviceIds: string[]
      estimatedMinutes: number
    }
  | {
      step: 'select_slot'
      customerId: string
      petId: string
      serviceIds: string[]
      estimatedMinutes: number
      date: string
    }
  | {
      step: 'booking_confirm'
      customerId: string
      petId: string
      serviceIds: string[]
      estimatedMinutes: number
      date: string
      staffId: string
      slot: string
    }

const TTL_MS = 30 * 60_000

export async function getSession(
  lineUserId: string,
): Promise<SessionState | null> {
  const row = await prismaAdmin.lineSession.findUnique({
    where: { lineUserId },
  })
  if (!row) return null
  if (row.expiresAt < new Date()) {
    await clearSession(lineUserId)
    return null
  }
  return row.state as SessionState
}

export async function setSession(
  lineUserId: string,
  state: SessionState,
): Promise<void> {
  const expiresAt = new Date(Date.now() + TTL_MS)
  await prismaAdmin.lineSession.upsert({
    where: { lineUserId },
    create: { lineUserId, state: state as object, expiresAt },
    update: { state: state as object, expiresAt },
  })
}

export async function clearSession(lineUserId: string): Promise<void> {
  await prismaAdmin.lineSession.deleteMany({ where: { lineUserId } })
}
