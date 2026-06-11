'use server'

// ─────────────────────────────────────────────────────────────────────────────
// READ  操作：Supabase anon key — 受 RLS 保護，僅能讀取公開資料。
// WRITE 操作：prismaAdmin（server-side 例外）——
//   anon 使用者無 Supabase session，appointment_insert_customer RLS policy
//   需要 authenticated role，因此 submitBooking 在 server-side 以
//   prismaAdmin 執行，input 全程 Zod 驗證，不暴露任何他人資料。
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { prismaAdmin } from '@repo/db'
import { z } from 'zod'

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type StorePublic = {
  id: string
  name: string
  address: string | null
  phone: string | null
}

export type ServicePublic = {
  id: string
  name: string
  category: string
  basePrice: number
  estimatedMinutes: number
}

export type SlotInfo = {
  slotTime: string // ISO 8601 string
  totalCapacity: number
  bookedCount: number
  availableCount: number
}

export type SubmitBookingInput = {
  storeId: string
  serviceIds: string[]
  scheduledAt: string // ISO 8601
  ownerName: string
  ownerPhone: string
  petName: string
  petSpecies: 'DOG' | 'CAT'
  petBreed?: string
  petWeightKg?: number
  isAggressive: boolean
  hasDisease: boolean
  diseaseNotes?: string
  isDewormed: boolean
  signOnline: boolean
}

export type SubmitBookingResult =
  | { ok: true; data: { appointmentId: string; needsOnlineSign: boolean } }
  | { ok: false; error: string }

// ─── Read: 店家公開資訊（anon RLS）────────────────────────────────────────────

export async function getStoreBySlug(
  slug: string,
): Promise<StorePublic | null> {
  const sb = supabaseAnon()
  const { data, error } = await sb
    .from('Store')
    .select('id, name, address, phone')
    .eq('slug', slug)
    .eq('isActive', true)
    .single()
  if (error || !data) return null
  return data as StorePublic
}

// ─── Read: 服務清單（anon RLS）───────────────────────────────────────────────

export async function getServicesForCustomer(
  storeId: string,
): Promise<ServicePublic[]> {
  const sb = supabaseAnon()
  const { data, error } = await sb
    .from('Service')
    .select('id, name, category, basePrice, estimatedMinutes')
    .eq('storeId', storeId)
    .eq('isActive', true)
    .order('sortOrder', { ascending: true })
  if (error || !data) return []
  return (data as ServicePublic[]).map((s) => ({
    ...s,
    basePrice: Number(s.basePrice),
    estimatedMinutes: Number(s.estimatedMinutes),
  }))
}

// ─── Read: 可預約時段（anon RLS，呼叫 get_available_slots RPC）───────────────

export async function getAvailableSlots(
  storeId: string,
  date: string,
): Promise<SlotInfo[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return []
  const sb = supabaseAnon()
  const { data, error } = await sb.rpc('get_available_slots', {
    p_store_id: storeId,
    p_date: date,
  })
  if (error || !data) return []
  return (
    data as Array<{
      slot_time: string
      total_capacity: number
      booked_count: number
      available_count: number
    }>
  ).map((row) => ({
    slotTime: row.slot_time,
    totalCapacity: Number(row.total_capacity),
    bookedCount: Number(row.booked_count),
    availableCount: Number(row.available_count),
  }))
}

// ─── Write: 送出預約（prismaAdmin，server-side 驗證寫入）──────────────────────

const submitSchema = z.object({
  storeId: z.string().min(1),
  serviceIds: z.array(z.string().min(1)).min(1, '請選擇至少一項服務'),
  scheduledAt: z.string().datetime({ message: '時段格式錯誤，請重新選擇' }),
  ownerName: z.string().trim().min(1, '請填寫姓名').max(20),
  ownerPhone: z.string().regex(/^09\d{8}$/, '請輸入正確手機號碼（09xxxxxxxx）'),
  petName: z.string().trim().min(1, '請填寫寵物名稱').max(20),
  petSpecies: z.enum(['DOG', 'CAT']),
  petBreed: z.string().max(30).optional(),
  petWeightKg: z.number().positive().max(100).optional(),
  isAggressive: z.boolean(),
  hasDisease: z.boolean(),
  diseaseNotes: z.string().max(100).optional(),
  isDewormed: z.boolean(),
  signOnline: z.boolean(),
})

export async function submitBooking(
  input: SubmitBookingInput,
): Promise<SubmitBookingResult> {
  const parsed = submitSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? '輸入格式錯誤',
    }
  }
  const d = parsed.data

  try {
    // 確認店家啟用
    const store = await prismaAdmin.store.findUnique({
      where: { id: d.storeId, isActive: true },
      select: { id: true },
    })
    if (!store) return { ok: false, error: '找不到店家，請重新整理後再試' }

    // 確認所有服務皆存在且啟用
    const services = await prismaAdmin.service.findMany({
      where: { id: { in: d.serviceIds }, storeId: d.storeId, isActive: true },
      select: { id: true, name: true, basePrice: true, estimatedMinutes: true },
    })
    if (services.length !== d.serviceIds.length) {
      return { ok: false, error: '部分服務項目已下架，請重新選擇' }
    }

    const estimatedDuration = services.reduce(
      (s, v) => s + v.estimatedMinutes,
      0,
    )
    const subtotal = services.reduce((s, v) => s + v.basePrice, 0)

    // 查找或建立客戶（以手機號碼 + storeId 識別）
    let customer = await prismaAdmin.customer.findFirst({
      where: { phone: d.ownerPhone, storeId: d.storeId },
      select: { id: true },
    })
    if (!customer) {
      customer = await prismaAdmin.customer.create({
        data: { storeId: d.storeId, name: d.ownerName, phone: d.ownerPhone },
        select: { id: true },
      })
    }

    // 查找或建立寵物（同名則更新健康資料）
    let pet = await prismaAdmin.pet.findFirst({
      where: { customerId: customer.id, name: d.petName },
      select: { id: true },
    })
    if (pet) {
      await prismaAdmin.pet.update({
        where: { id: pet.id },
        data: {
          ...(d.petBreed !== undefined && { breed: d.petBreed }),
          ...(d.petWeightKg !== undefined && { weightKg: d.petWeightKg }),
          isAggressive: d.isAggressive,
          hasDisease: d.hasDisease,
          ...(d.diseaseNotes !== undefined && { diseaseNotes: d.diseaseNotes }),
          isDewormed: d.isDewormed,
        },
      })
    } else {
      pet = await prismaAdmin.pet.create({
        data: {
          storeId: d.storeId,
          customerId: customer.id,
          name: d.petName,
          species: d.petSpecies,
          gender: 'UNKNOWN',
          breed: d.petBreed,
          weightKg: d.petWeightKg,
          isAggressive: d.isAggressive,
          hasDisease: d.hasDisease,
          diseaseNotes: d.diseaseNotes,
          isDewormed: d.isDewormed,
        },
        select: { id: true },
      })
    }

    // 建立預約 + DRAFT 訂單（讓 POS 時間表可看到預定服務）
    const appt = await prismaAdmin.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          storeId: d.storeId,
          customerId: customer!.id,
          petId: pet!.id,
          scheduledAt: new Date(d.scheduledAt),
          estimatedDuration,
          status: 'PENDING',
          source: 'ONLINE',
          signedOnline: d.signOnline,
        },
        select: { id: true },
      })
      await tx.order.create({
        data: {
          storeId: d.storeId,
          appointmentId: appointment.id,
          customerId: customer!.id,
          petId: pet!.id,
          status: 'DRAFT',
          subtotalAmount: subtotal,
          totalAmount: subtotal,
          items: {
            create: services.map((s) => ({
              serviceId: s.id,
              serviceName: s.name,
              quantity: 1,
              unitPrice: s.basePrice,
              amount: s.basePrice,
            })),
          },
        },
        select: { id: true },
      })
      return appointment
    })

    return {
      ok: true,
      data: { appointmentId: appt.id, needsOnlineSign: d.signOnline },
    }
  } catch (e) {
    console.error('[submitBooking]', e)
    return { ok: false, error: '預約送出失敗，請稍後再試' }
  }
}
