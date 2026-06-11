'use server'

import { z } from 'zod'
import { prismaAdmin } from '@repo/db'
import {
  fillTemplate,
  generatePdf,
  uploadContractPdf,
  createContractSignedUrl,
} from '@repo/contract'
import type { ContractData } from '@repo/contract'

// 線上簽約專屬備注（插入契約自訂欄位）
const ONLINE_SIGN_NOTE =
  '本次為線上簽約。如到店有需要增加服務項目，將由店家協助補簽「補充服務契約」，原契約費用不變。'

function contractDataFromJson(value: unknown): Partial<ContractData> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {}
  }

  return value as Partial<ContractData>
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ─── Input Schema ──────────────────────────────────────────────────────────

const serviceItemSchema = z.object({
  serviceName: z.string().min(1),
  unitPrice: z.number().int().nonnegative(),
  serviceId: z.string().min(1),
  quantity: z.number().int().positive(),
})

const finalizeOnlineBookingSchema = z.object({
  storeSlug: z.string().min(1),
  // 客戶資訊
  customerName: z.string().min(1, '姓名必填'),
  customerPhone: z.string().min(8),
  customerEmail: z.string().default(''),
  emergencyContact: z.string().default(''),
  emergencyPhone: z.string().default(''),
  // 寵物資訊
  petName: z.string().min(1, '寵物姓名必填'),
  petSpecies: z.string(),
  petBreed: z.string().default(''),
  petWeight: z.string().default(''),
  petGender: z.string(),
  petBirthDate: z.string().default(''),
  isAggressive: z.boolean(),
  hasDisease: z.boolean(),
  diseaseNotes: z.string().default(''),
  isVaccinated: z.boolean(),
  isDewormed: z.boolean(),
  preferredVetName: z.string().default(''),
  preferredVetPhone: z.string().default(''),
  // 服務
  services: z.array(serviceItemSchema).min(1),
  staffId: z.string().optional(),
  staffName: z.string().default(''),
  staffSurcharge: z.number().int().nonnegative(),
  subtotalAmount: z.number().int().nonnegative(),
  discountAmount: z.number().int().nonnegative(),
  totalAmount: z.number().int().nonnegative(),
  // 時間
  scheduledAt: z.string(),
  estimatedDuration: z.number().int().positive(),
  pickupDeadlineAt: z.string(),
  // 簽名
  signatureDataUrl: z.string().startsWith('data:image/'),
  signedAt: z.string(),
})

export type FinalizeOnlineBookingInput = z.infer<
  typeof finalizeOnlineBookingSchema
>

// ─── Server Action ─────────────────────────────────────────────────────────

export async function finalizeOnlineBooking(raw: unknown): Promise<
  ActionResult<{
    appointmentId: string
    contractId: string
    orderId: string
    pdfSent: boolean
  }>
> {
  const parsed = finalizeOnlineBookingSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? '資料格式錯誤',
    }
  }

  const data = parsed.data

  // ── Phase 0: 找店家 + 模板 ──────────────────────────────────────────────
  let storeId: string
  let templateId: string
  let templateHtml: string
  try {
    const store = await prismaAdmin.store.findUnique({
      where: { slug: data.storeSlug, isActive: true },
      select: { id: true },
    })
    if (!store) return { ok: false, error: '找不到指定店家' }
    storeId = store.id

    const template = await prismaAdmin.contractTemplate.findFirst({
      where: { type: 'SINGLE_SERVICE', isActive: true },
      select: { id: true, htmlContent: true },
      orderBy: { version: 'desc' },
    })
    if (!template) return { ok: false, error: '找不到契約模板，請聯絡店家' }
    templateId = template.id
    templateHtml = template.htmlContent
  } catch (e) {
    console.error('[finalizeOnlineBooking] Phase 0 failed:', e)
    return { ok: false, error: '讀取店家資料失敗，請稍後再試' }
  }

  // ── Phase 1: 建立或查找客戶 + 寵物 ─────────────────────────────────────
  let customerId: string
  let petId: string
  try {
    const customer = await prismaAdmin.customer.upsert({
      where: { storeId_phone: { storeId, phone: data.customerPhone } },
      create: {
        storeId,
        phone: data.customerPhone,
        name: data.customerName,
        email: data.customerEmail || null,
        emergencyContact: data.emergencyContact || null,
        emergencyPhone: data.emergencyPhone || null,
      },
      update: {
        name: data.customerName,
        email: data.customerEmail || null,
        emergencyContact: data.emergencyContact || null,
        emergencyPhone: data.emergencyPhone || null,
      },
      select: { id: true },
    })
    customerId = customer.id

    const pet = await prismaAdmin.pet.create({
      data: {
        storeId,
        customerId,
        name: data.petName,
        species: data.petSpecies === 'DOG' ? 'DOG' : 'CAT',
        breed: data.petBreed || null,
        gender: (['MALE', 'FEMALE', 'UNKNOWN'].includes(data.petGender)
          ? data.petGender
          : 'UNKNOWN') as 'MALE' | 'FEMALE' | 'UNKNOWN',
        birthDate: data.petBirthDate ? new Date(data.petBirthDate) : null,
        weightKg: data.petWeight ? parseFloat(data.petWeight) : null,
        isAggressive: data.isAggressive,
        hasDisease: data.hasDisease,
        diseaseNotes: data.diseaseNotes || null,
        isVaccinated: data.isVaccinated,
        isDewormed: data.isDewormed,
        preferredVetName: data.preferredVetName || null,
        preferredVetPhone: data.preferredVetPhone || null,
      },
      select: { id: true },
    })
    petId = pet.id
  } catch (e) {
    console.error('[finalizeOnlineBooking] Phase 1 failed:', e)
    return { ok: false, error: '建立客戶或寵物資料失敗，請稍後再試' }
  }

  // ── Phase 2: 建立 Appointment + Order + Contract（transaction）─────────
  let appointmentId: string
  let orderId: string
  let contractId: string
  const signedAt = new Date(data.signedAt)

  try {
    const result = await prismaAdmin.$transaction(async (tx) => {
      const appt = await tx.appointment.create({
        data: {
          storeId,
          customerId,
          petId,
          ...(data.staffId ? { staffId: data.staffId } : {}),
          scheduledAt: new Date(data.scheduledAt),
          estimatedDuration: data.estimatedDuration,
          pickupDeadlineAt: data.pickupDeadlineAt
            ? new Date(data.pickupDeadlineAt)
            : null,
          status: 'CONFIRMED',
          source: 'ONLINE',
          signedOnline: true,
        },
        select: { id: true },
      })

      const order = await tx.order.create({
        data: {
          storeId,
          customerId,
          petId,
          ...(data.staffId ? { staffId: data.staffId } : {}),
          appointmentId: appt.id,
          status: 'CONFIRMED',
          subtotalAmount: data.subtotalAmount,
          discountAmount: data.discountAmount,
          overtimeFee: 0,
          totalAmount: data.totalAmount,
          items: {
            create: data.services.map((s) => ({
              serviceId: s.serviceId,
              serviceName: s.serviceName,
              unitPrice: s.unitPrice,
              quantity: s.quantity,
              amount: s.unitPrice * s.quantity,
            })),
          },
        },
        select: { id: true },
      })

      const contractData: ContractData = {
        storeName: '', // 由 Phase 0 取得，但 Store model 沒有讀 name
        storeAddress: '',
        storePhone: '',
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        emergencyContact: data.emergencyContact,
        emergencyPhone: data.emergencyPhone,
        petName: data.petName,
        petSpecies: data.petSpecies,
        petBreed: data.petBreed,
        petWeight: data.petWeight,
        petGender: data.petGender,
        petBirthDate: data.petBirthDate,
        isAggressive: data.isAggressive ? '是' : '否',
        hasDisease: data.hasDisease ? '是' : '否',
        diseaseNotes: data.diseaseNotes,
        isVaccinated: data.isVaccinated ? '是' : '否',
        isDewormed: data.isDewormed ? '是' : '否',
        preferredVetName: data.preferredVetName,
        preferredVetPhone: data.preferredVetPhone,
        services: data.services.map((s) => ({
          serviceName: s.serviceName,
          unitPrice: s.unitPrice,
        })),
        staffName: data.staffName,
        staffSurcharge: data.staffSurcharge,
        subtotalAmount: data.subtotalAmount,
        discountAmount: data.discountAmount,
        totalAmount: data.totalAmount,
        scheduledAt: data.scheduledAt,
        estimatedDuration: data.estimatedDuration,
        pickupDeadlineAt: data.pickupDeadlineAt,
        customFields: [
          { label: '簽約方式', value: '線上簽約' },
          { label: '線上簽約說明', value: ONLINE_SIGN_NOTE },
        ],
        signatureDataUrl: data.signatureDataUrl,
        signedAt: data.signedAt,
      }

      const contract = await tx.contract.create({
        data: {
          storeId,
          orderId: order.id,
          templateId,
          customerId,
          petId,
          filledData: contractData as object,
          signatureDataUrl: data.signatureDataUrl,
          signedAt,
          signMethod: 'ONLINE',
          pdfUrl: null,
          pdfGeneratedAt: null,
        },
        select: { id: true },
      })

      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          action: 'CREATED',
          newValue: JSON.stringify({
            status: 'CONFIRMED',
            source: 'ONLINE',
            signMethod: 'ONLINE',
          }),
          note: '線上簽約完成',
        },
      })

      return { apptId: appt.id, orderId: order.id, contractId: contract.id }
    })

    appointmentId = result.apptId
    orderId = result.orderId
    contractId = result.contractId
  } catch (e) {
    console.error('[finalizeOnlineBooking] Phase 2 failed:', e)
    return { ok: false, error: '建立預約失敗，請稍後再試' }
  }

  // ── Phase 3: 補上 store info 後重查並產 PDF ────────────────────────────
  let pdfSent = false
  try {
    const [store, contract] = await Promise.all([
      prismaAdmin.store.findUnique({
        where: { id: storeId },
        select: { name: true, address: true, phone: true },
      }),
      prismaAdmin.contract.findUnique({
        where: { id: contractId },
        select: { filledData: true },
      }),
    ])

    const filledData = {
      ...contractDataFromJson(contract?.filledData),
      storeName: store?.name ?? '',
      storeAddress: store?.address ?? '',
      storePhone: store?.phone ?? '',
    } as ContractData

    const filledHtml = fillTemplate(templateHtml, filledData)
    const pdfBuffer = await generatePdf(filledHtml)
    const pdfStoragePath = await uploadContractPdf(pdfBuffer, orderId)

    await prismaAdmin.contract.update({
      where: { id: contractId },
      data: { pdfUrl: pdfStoragePath, pdfGeneratedAt: new Date() },
    })

    // LINE 推播
    const customer = await prismaAdmin.customer.findUnique({
      where: { id: customerId },
      select: { lineUserId: true, name: true },
    })
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (customer?.lineUserId && token) {
      const pdfUrl = await createContractSignedUrl(pdfStoragePath, 7 * 86400)
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: customer.lineUserId,
          messages: [
            {
              type: 'flex',
              altText: `預約確認：${filledData.storeName} ${filledData.scheduledAt}`,
              contents: {
                type: 'bubble',
                header: {
                  type: 'box',
                  layout: 'vertical',
                  backgroundColor: '#78573A',
                  paddingAll: 'lg',
                  contents: [
                    {
                      type: 'text',
                      text: '🐾 預約確認',
                      color: '#ffffff',
                      weight: 'bold',
                      size: 'lg',
                    },
                  ],
                },
                body: {
                  type: 'box',
                  layout: 'vertical',
                  spacing: 'sm',
                  paddingAll: 'lg',
                  contents: [
                    {
                      type: 'text',
                      text: `${customer.name} 您好！`,
                      weight: 'bold',
                    },
                    {
                      type: 'text',
                      text: `預約時間：${filledData.scheduledAt}`,
                      size: 'sm',
                      color: '#6b7280',
                      wrap: true,
                    },
                    {
                      type: 'text',
                      text: `服務：${filledData.services.map((s) => s.serviceName).join('、')}`,
                      size: 'sm',
                      color: '#6b7280',
                      wrap: true,
                    },
                    {
                      type: 'text',
                      text: ONLINE_SIGN_NOTE,
                      size: 'xs',
                      color: '#9ca3af',
                      wrap: true,
                    },
                  ],
                },
                footer: {
                  type: 'box',
                  layout: 'vertical',
                  paddingAll: 'lg',
                  contents: [
                    {
                      type: 'button',
                      action: {
                        type: 'uri',
                        label: '查看契約 PDF',
                        uri: pdfUrl,
                      },
                      style: 'primary',
                      color: '#78573A',
                      height: 'sm',
                    },
                  ],
                },
              },
            },
          ],
        }),
      })
      pdfSent = res.ok
      if (!res.ok) {
        console.error('[finalizeOnlineBooking] LINE push failed:', res.status)
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('executablePath') || msg.includes('chromium')) {
      console.error('[finalizeOnlineBooking] PDF engine missing:', msg)
    } else {
      console.error('[finalizeOnlineBooking] Phase 3 failed:', e)
    }
    // PDF/LINE 失敗不視為致命錯誤，預約已建立
  }

  return {
    ok: true,
    data: { appointmentId, contractId, orderId, pdfSent },
  }
}

// ─── 取得契約 HTML 預覽（給 sign page 顯示完整條文）───────────────────────

export async function getOnlineContractHtml(storeSlug: string): Promise<{
  html: string | null
  error?: string
}> {
  try {
    const store = await prismaAdmin.store.findUnique({
      where: { slug: storeSlug, isActive: true },
      select: { name: true, address: true, phone: true },
    })
    const template = await prismaAdmin.contractTemplate.findFirst({
      where: { type: 'SINGLE_SERVICE', isActive: true },
      select: { htmlContent: true },
      orderBy: { version: 'desc' },
    })
    if (!template) return { html: null, error: '找不到契約模板' }

    // 用佔位資料預覽（顯示條文本文）
    const html = fillTemplate(template.htmlContent, {
      storeName: store?.name ?? '店家',
      storeAddress: store?.address ?? '',
      storePhone: store?.phone ?? '',
      customerName: '（您的姓名）',
      customerPhone: '（手機）',
      customerEmail: '',
      emergencyContact: '',
      emergencyPhone: '',
      petName: '（寵物名稱）',
      petSpecies: '（犬/貓）',
      petBreed: '',
      petWeight: '',
      petGender: '',
      petBirthDate: '',
      isAggressive: '否',
      hasDisease: '否',
      diseaseNotes: '',
      isVaccinated: '否',
      isDewormed: '否',
      preferredVetName: '',
      preferredVetPhone: '',
      services: [{ serviceName: '（選取的服務）', unitPrice: 0 }],
      staffName: '',
      staffSurcharge: 0,
      subtotalAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
      scheduledAt: '（預約時間）',
      estimatedDuration: 60,
      pickupDeadlineAt: '',
      customFields: [
        { label: '簽約方式', value: '線上簽約' },
        { label: '線上簽約說明', value: ONLINE_SIGN_NOTE },
      ],
      signatureDataUrl: '',
      signedAt: new Date().toISOString(),
    })
    return { html }
  } catch (e) {
    console.error('[getOnlineContractHtml] failed:', e)
    return { html: null, error: '讀取契約模板失敗' }
  }
}
