'use server'

import { z } from 'zod'
import { prismaAdmin } from '@repo/db'
import { getStoreIdFromCustomer } from '../../lib/store'
import {
  fillTemplate,
  fillSupplementaryTemplate,
  generatePdf,
  uploadContractPdf,
  createContractSignedUrl,
  deleteContractPdf,
} from '@repo/contract'
import type { ContractData, SupplementaryContractData } from '@repo/contract'
import { readFileSync } from 'fs'
import { join } from 'path'

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ─── Shared Schemas ────────────────────────────────────────────────────────

const orderItemSchema = z.object({
  serviceId: z.string().min(1),
  serviceName: z.string().min(1),
  unitPrice: z.number().int().nonnegative(),
  quantity: z.number().int().positive().max(20),
})

const serviceItemSchema = z.object({
  serviceName: z.string(),
  unitPrice: z.number(),
})

const customFieldSchema = z.object({
  label: z.string(),
  value: z.string(),
})

const contractBaseSchema = z.object({
  storeName: z.string(),
  storeAddress: z.string(),
  storePhone: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  customerEmail: z.string(),
  emergencyContact: z.string(),
  emergencyPhone: z.string(),
  petName: z.string(),
  petSpecies: z.string(),
  petBreed: z.string(),
  petWeight: z.string(),
  petGender: z.string(),
  petBirthDate: z.string(),
  isAggressive: z.string(),
  hasDisease: z.string(),
  diseaseNotes: z.string(),
  isVaccinated: z.string(),
  isDewormed: z.string(),
  preferredVetName: z.string(),
  preferredVetPhone: z.string(),
  services: z.array(serviceItemSchema),
  staffName: z.string(),
  staffSurcharge: z.number(),
  subtotalAmount: z.number(),
  discountAmount: z.number(),
  totalAmount: z.number(),
  scheduledAt: z.string(),
  estimatedDuration: z.number(),
  pickupDeadlineAt: z.string(),
  customFields: z.array(customFieldSchema),
  signedAt: z.string(),
})

// ─── getContractPreviewHtml ────────────────────────────────────────────────

export async function getContractPreviewHtml(
  data: z.infer<typeof contractBaseSchema>,
): Promise<string | null> {
  try {
    const template = await prismaAdmin.contractTemplate.findFirst({
      where: { type: 'SINGLE_SERVICE', isActive: true },
      select: { htmlContent: true },
      orderBy: { version: 'desc' },
    })
    if (!template) return null

    return fillTemplate(template.htmlContent, {
      ...data,
      signatureDataUrl: '', // 預覽時無簽名
    } as ContractData)
  } catch (e) {
    console.error('getContractPreviewHtml failed:', e)
    return null
  }
}

// ─── finalizeOrder ────────────────────────────────────────────────────────

const finalizeOrderSchema = z.object({
  customerId: z.string().min(1),
  petId: z.string().min(1),
  staffId: z.string().optional(),
  orderItems: z.array(orderItemSchema).min(1, '至少需要一項服務'),
  subtotalAmount: z.number().int().nonnegative(),
  discountAmount: z.number().int().nonnegative(),
  totalAmount: z.number().int().nonnegative(),
  contractData: contractBaseSchema,
  signatureDataUrl: z.string().startsWith('data:image/'),
  customFieldValues: z.record(z.string()).optional(),
  notes: z.string().optional(),
  paymentMethod: z
    .enum(['CASH', 'CARD', 'TRANSFER', 'MEMBER_BALANCE'])
    .optional(),
})

export type FinalizeOrderInput = z.infer<typeof finalizeOrderSchema>

export async function finalizeOrder(
  raw: unknown,
): Promise<
  ActionResult<{
    orderId: string
    contractId: string
    earnedPoints: number | null
  }>
> {
  const parsed = finalizeOrderSchema.safeParse(raw)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? '資料格式錯誤',
    }

  const {
    customerId,
    petId,
    staffId,
    orderItems,
    subtotalAmount,
    discountAmount,
    totalAmount,
    contractData,
    signatureDataUrl,
    customFieldValues,
    notes,
    paymentMethod,
  } = parsed.data

  // ── Phase 0: Fetch active template ──────────────────────────────────────
  let templateId: string
  try {
    const template = await prismaAdmin.contractTemplate.findFirst({
      where: { type: 'SINGLE_SERVICE', isActive: true },
      select: { id: true },
      orderBy: { version: 'desc' },
    })
    if (!template)
      return { ok: false, error: '找不到契約模板，請先執行 db:seed' }
    templateId = template.id
  } catch (e) {
    console.error('finalizeOrder Phase 0 failed:', e)
    return { ok: false, error: '讀取契約模板失敗' }
  }

  // ── Phase 1: Create Order + OrderItems ──────────────────────────────────
  const storeId = await getStoreIdFromCustomer(customerId)
  let orderId: string
  try {
    const order = await prismaAdmin.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          storeId,
          customerId,
          petId,
          ...(staffId ? { staffId } : {}),
          status: 'CONFIRMED',
          subtotalAmount,
          discountAmount,
          overtimeFee: 0,
          totalAmount,
          ...(paymentMethod ? { paymentMethod } : {}),
          ...(paymentMethod === 'MEMBER_BALANCE' ? { paidAt: new Date() } : {}),
          ...(notes ? { notes } : {}),
          items: {
            create: orderItems.map((item) => ({
              serviceId: item.serviceId,
              serviceName: item.serviceName,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              amount: item.unitPrice * item.quantity,
            })),
          },
        },
        select: { id: true },
      })
    })
    orderId = order.id
  } catch (e) {
    console.error('finalizeOrder Phase 1 failed:', e)
    return { ok: false, error: '建立訂單失敗，請稍後再試' }
  }

  // ── Phase 2: Create Contract + Points/Balance (transaction) ──────────────
  const filledData = { ...contractData, signatureDataUrl } as ContractData
  let contractId: string
  let earnedPoints: number | null = null

  try {
    const now = new Date()
    const result = await prismaAdmin.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          storeId,
          orderId,
          templateId,
          customerId,
          petId,
          filledData: filledData as object,
          ...(customFieldValues ? { customFieldValues } : {}),
          signatureDataUrl,
          signedAt: now,
          pdfUrl: null, // PDF 非同步產出，先存 null
          pdfGeneratedAt: null,
        },
        select: { id: true },
      })

      const member = await tx.member.findUnique({
        where: { customerId },
        select: {
          id: true,
          balance: true,
          expiresAt: true,
          plan: { select: { pointRate: true, isActive: true } },
        },
      })

      let earned = 0
      if (
        member &&
        member.plan.isActive &&
        (!member.expiresAt || member.expiresAt > now) &&
        totalAmount > 0
      ) {
        earned = Math.floor(totalAmount * Number(member.plan.pointRate))
        if (earned > 0) {
          await tx.pointTransaction.create({
            data: {
              memberId: member.id,
              orderId,
              amount: earned,
              type: 'EARN',
              note: '消費獲得點數',
            },
          })
          await tx.member.update({
            where: { id: member.id },
            data: { points: { increment: earned } },
          })
        }
      }

      if (paymentMethod === 'MEMBER_BALANCE') {
        if (!member) {
          throw new Error('此客戶尚未申辦會員，無法使用儲值金付款')
        }
        if (member.balance < totalAmount) {
          throw new Error('會員儲值金餘額不足，請改用其他付款方式')
        }
        await tx.balanceTransaction.create({
          data: {
            memberId: member.id,
            orderId,
            amount: -totalAmount,
            type: 'SPEND',
            note: `訂單 ${orderId} 儲值金付款`,
          },
        })
        await tx.member.update({
          where: { id: member.id },
          data: { balance: { decrement: totalAmount } },
        })
      }

      await tx.orderAuditLog.create({
        data: {
          orderId,
          action: 'CREATED',
          newValue: JSON.stringify({
            status: 'CONFIRMED',
            totalAmount,
            paymentMethod,
          }),
          note: '報到流程完成簽約',
        },
      })

      return {
        contractId: contract.id,
        earnedPoints: earned > 0 ? earned : null,
      }
    })
    contractId = result.contractId
    earnedPoints = result.earnedPoints
  } catch (e) {
    console.error('finalizeOrder Phase 2 failed:', e)
    await prismaAdmin.order
      .update({ where: { id: orderId }, data: { status: 'CANCELLED' } })
      .catch(console.error)
    if (
      e instanceof Error &&
      (e.message === '此客戶尚未申辦會員，無法使用儲值金付款' ||
        e.message === '會員儲值金餘額不足，請改用其他付款方式')
    ) {
      return { ok: false, error: e.message }
    }
    return { ok: false, error: '建立契約紀錄失敗，請稍後再試' }
  }

  return { ok: true, data: { orderId, contractId, earnedPoints } }
}

// ─── getSupplementaryContractPreviewHtml ─────────────────────────────────

const supplementaryContractBaseSchema = z.object({
  storeName: z.string(),
  storePhone: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  petName: z.string(),
  parentContractRef: z.string(),
  services: z.array(serviceItemSchema),
  staffName: z.string(),
  staffSurcharge: z.number(),
  supplementaryAmount: z.number(),
  signedAt: z.string(),
})

export async function getSupplementaryContractPreviewHtml(
  data: z.infer<typeof supplementaryContractBaseSchema>,
): Promise<string | null> {
  try {
    const template = await prismaAdmin.contractTemplate.findFirst({
      where: { type: 'SUPPLEMENTARY', isActive: true },
      select: { htmlContent: true },
      orderBy: { version: 'desc' },
    })

    let htmlContent: string
    if (template) {
      htmlContent = template.htmlContent
    } else {
      // 從本地模板文件讀取並建立 DB 記錄
      const templatePath = join(
        process.cwd(),
        '..',
        '..',
        'packages',
        'contract',
        'templates',
        'supplementary.html',
      )
      htmlContent = readFileSync(templatePath, 'utf-8')
      await prismaAdmin.contractTemplate.create({
        data: {
          name: '補充契約模板 v1',
          type: 'SUPPLEMENTARY',
          version: 1,
          htmlContent,
          isActive: true,
        },
      })
    }

    return fillSupplementaryTemplate(htmlContent, {
      ...data,
      signatureDataUrl: '', // 預覽時無簽名
    } as SupplementaryContractData)
  } catch (e) {
    console.error('getSupplementaryContractPreviewHtml failed:', e)
    return null
  }
}

// ─── finalizeSupplementaryOrder ──────────────────────────────────────────

const finalizeSupplementaryOrderSchema = z.object({
  customerId: z.string().min(1),
  petId: z.string().min(1),
  staffId: z.string().optional(),
  appointmentId: z.string().min(1),
  originalDraftOrderId: z.string().min(1),
  parentContractId: z.string().min(1),
  allOrderItems: z.array(orderItemSchema).min(1, '至少需要一項服務'),
  newOrderItems: z.array(orderItemSchema).min(1, '補充契約需至少一項新服務'),
  subtotalAmount: z.number().int().nonnegative(),
  discountAmount: z.number().int().nonnegative(),
  totalAmount: z.number().int().nonnegative(),
  supplementaryAmount: z.number().int().nonnegative(),
  contractData: supplementaryContractBaseSchema,
  signatureDataUrl: z.string().startsWith('data:image/'),
  paymentMethod: z
    .enum(['CASH', 'CARD', 'TRANSFER', 'MEMBER_BALANCE'])
    .optional(),
  notes: z.string().optional(),
})

export type FinalizeSupplementaryOrderInput = z.infer<
  typeof finalizeSupplementaryOrderSchema
>

export async function finalizeSupplementaryOrder(raw: unknown): Promise<
  ActionResult<{
    orderId: string
    contractId: string
    supplementaryContractId: string
    earnedPoints: number | null
  }>
> {
  const parsed = finalizeSupplementaryOrderSchema.safeParse(raw)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? '資料格式錯誤',
    }

  const {
    customerId,
    petId,
    staffId,
    originalDraftOrderId,
    parentContractId,
    allOrderItems,
    subtotalAmount,
    discountAmount,
    totalAmount,
    supplementaryAmount,
    contractData,
    signatureDataUrl,
    paymentMethod,
    notes,
  } = parsed.data

  // ── Phase 0: Fetch SUPPLEMENTARY template ───────────────────────────────
  let suppTemplateId: string
  try {
    let suppTemplate = await prismaAdmin.contractTemplate.findFirst({
      where: { type: 'SUPPLEMENTARY', isActive: true },
      select: { id: true },
      orderBy: { version: 'desc' },
    })
    if (!suppTemplate) {
      const templatePath = join(
        process.cwd(),
        '..',
        '..',
        'packages',
        'contract',
        'templates',
        'supplementary.html',
      )
      const htmlContent = readFileSync(templatePath, 'utf-8')
      suppTemplate = await prismaAdmin.contractTemplate.create({
        data: {
          name: '補充契約模板 v1',
          type: 'SUPPLEMENTARY',
          version: 1,
          htmlContent,
          isActive: true,
        },
        select: { id: true },
      })
    }
    suppTemplateId = suppTemplate.id
  } catch (e) {
    console.error('finalizeSupplementaryOrder Phase 0 failed:', e)
    return { ok: false, error: '讀取補充契約模板失敗' }
  }

  const storeId = await getStoreIdFromCustomer(customerId)

  // ── Phase 1: Update DRAFT order to CONFIRMED ────────────────────────────
  try {
    await prismaAdmin.$transaction(async (tx) => {
      // 刪除舊的訂單項目再重建
      await tx.orderItem.deleteMany({
        where: { orderId: originalDraftOrderId },
      })

      await tx.order.update({
        where: { id: originalDraftOrderId },
        data: {
          ...(staffId ? { staffId } : {}),
          status: 'CONFIRMED',
          subtotalAmount,
          discountAmount,
          overtimeFee: 0,
          totalAmount,
          ...(paymentMethod ? { paymentMethod } : {}),
          ...(paymentMethod === 'MEMBER_BALANCE' ? { paidAt: new Date() } : {}),
          ...(notes ? { notes } : {}),
          items: {
            create: allOrderItems.map((item) => ({
              serviceId: item.serviceId,
              serviceName: item.serviceName,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              amount: item.unitPrice * item.quantity,
            })),
          },
        },
      })
    })
  } catch (e) {
    console.error('finalizeSupplementaryOrder Phase 1 failed:', e)
    return { ok: false, error: '更新訂單失敗，請稍後再試' }
  }

  const orderId = originalDraftOrderId

  // ── Phase 2: Create Supplementary Contract + Points/Balance ─────────────
  const filledData = {
    ...contractData,
    signatureDataUrl,
  } as SupplementaryContractData
  let supplementaryContractId: string
  let earnedPoints: number | null = null

  try {
    const now = new Date()
    const result = await prismaAdmin.$transaction(async (tx) => {
      const suppContract = await tx.contract.create({
        data: {
          storeId,
          orderId,
          templateId: suppTemplateId,
          customerId,
          petId,
          isSupplementary: true,
          parentContractId,
          filledData: filledData as object,
          signatureDataUrl,
          signedAt: now,
          pdfUrl: null,
          pdfGeneratedAt: null,
        },
        select: { id: true },
      })

      const member = await tx.member.findUnique({
        where: { customerId },
        select: {
          id: true,
          balance: true,
          expiresAt: true,
          plan: { select: { pointRate: true, isActive: true } },
        },
      })

      let earned = 0
      if (
        member &&
        member.plan.isActive &&
        (!member.expiresAt || member.expiresAt > now) &&
        supplementaryAmount > 0
      ) {
        earned = Math.floor(supplementaryAmount * Number(member.plan.pointRate))
        if (earned > 0) {
          await tx.pointTransaction.create({
            data: {
              memberId: member.id,
              orderId,
              amount: earned,
              type: 'EARN',
              note: '加購補簽獲得點數',
            },
          })
          await tx.member.update({
            where: { id: member.id },
            data: { points: { increment: earned } },
          })
        }
      }

      if (paymentMethod === 'MEMBER_BALANCE') {
        if (!member) throw new Error('此客戶尚未申辦會員，無法使用儲值金付款')
        if (member.balance < totalAmount)
          throw new Error('會員儲值金餘額不足，請改用其他付款方式')
        await tx.balanceTransaction.create({
          data: {
            memberId: member.id,
            orderId,
            amount: -totalAmount,
            type: 'SPEND',
            note: `訂單 ${orderId} 儲值金付款（含加購）`,
          },
        })
        await tx.member.update({
          where: { id: member.id },
          data: { balance: { decrement: totalAmount } },
        })
      }

      await tx.orderAuditLog.create({
        data: {
          orderId,
          action: 'UPDATED',
          newValue: JSON.stringify({
            status: 'CONFIRMED',
            totalAmount,
            supplementaryAmount,
            paymentMethod,
            supplementaryContractId: suppContract.id,
          }),
          note: '加購補簽流程完成',
        },
      })

      return {
        supplementaryContractId: suppContract.id,
        earnedPoints: earned > 0 ? earned : null,
      }
    })
    supplementaryContractId = result.supplementaryContractId
    earnedPoints = result.earnedPoints
  } catch (e) {
    console.error('finalizeSupplementaryOrder Phase 2 failed:', e)
    if (
      e instanceof Error &&
      (e.message === '此客戶尚未申辦會員，無法使用儲值金付款' ||
        e.message === '會員儲值金餘額不足，請改用其他付款方式')
    ) {
      return { ok: false, error: e.message }
    }
    return { ok: false, error: '建立補充契約記錄失敗，請稍後再試' }
  }

  return {
    ok: true,
    data: {
      orderId,
      contractId: parentContractId,
      supplementaryContractId,
      earnedPoints,
    },
  }
}

// ─── generateAndSendContract ──────────────────────────────────────────────
// 非同步：產出 PDF → 上傳 Storage → 更新 DB → 發送 LINE
// 由完成頁在背景呼叫，不阻塞簽約流程

const sendSchema = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
})

export async function generateAndSendContract(
  raw: unknown,
): Promise<ActionResult<{ sent: boolean }>> {
  const parsed = sendSchema.safeParse(raw)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? '資料格式錯誤',
    }

  const { orderId, customerId } = parsed.data

  try {
    // 1. 從 DB 取得契約與模板（優先取補充契約，fallback 主契約）
    const contract = await prismaAdmin.contract.findFirst({
      where: { orderId },
      orderBy: { signedAt: 'desc' },
      select: {
        id: true,
        filledData: true,
        signatureDataUrl: true,
        isSupplementary: true,
        template: { select: { htmlContent: true, type: true } },
      },
    })
    if (!contract) return { ok: false, error: '找不到契約紀錄' }

    // 2. 產出 PDF（依契約類型選擇渲染函式）
    const filledHtml = contract.isSupplementary
      ? fillSupplementaryTemplate(
          contract.template.htmlContent,
          contract.filledData as unknown as SupplementaryContractData,
        )
      : fillTemplate(
          contract.template.htmlContent,
          contract.filledData as unknown as ContractData,
        )
    const pdfBuffer = await generatePdf(filledHtml)

    // 3. 上傳到 Supabase Storage
    const pdfStoragePath = await uploadContractPdf(pdfBuffer, orderId)

    // 4. 更新 DB contract.pdfUrl（儲存 storagePath，不儲存 signed URL）
    await prismaAdmin.contract.update({
      where: { id: contract.id },
      data: { pdfUrl: pdfStoragePath, pdfGeneratedAt: new Date() },
    })

    // 5. 嘗試發送 LINE
    const customer = await prismaAdmin.customer.findUnique({
      where: { id: customerId },
      select: { lineUserId: true, name: true },
    })

    if (!customer?.lineUserId) {
      return { ok: true, data: { sent: false } }
    }

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!token) return { ok: true, data: { sent: false } }

    const pdfUrl = await createContractSignedUrl(pdfStoragePath, 7 * 86400)

    const isSupp = contract.isSupplementary
    const altText = isSupp
      ? `加購補充契約已簽署（訂單 #${orderId.slice(-6).toUpperCase()}）`
      : `美容服務契約已簽署（訂單 #${orderId.slice(-6).toUpperCase()}）`
    const headerColor = isSupp ? '#b45309' : '#065f46'
    const headerText = isSupp ? '加購補充契約' : '美容服務契約'
    const bodyText = isSupp
      ? '您的加購補充契約已完成簽署，請點選下方按鈕查閱 PDF。補充契約與原契約合併適用。'
      : '您的寵物美容服務契約已完成簽署，請點選下方按鈕查閱或下載 PDF 存檔。'

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
            altText,
            contents: {
              type: 'bubble',
              header: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: headerColor,
                paddingAll: 'lg',
                contents: [
                  {
                    type: 'text',
                    text: headerText,
                    color: '#ffffff',
                    weight: 'bold',
                    size: 'lg',
                  },
                ],
              },
              body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                paddingAll: 'lg',
                contents: [
                  {
                    type: 'text',
                    text: `${customer.name} 您好！`,
                    size: 'md',
                    weight: 'bold',
                  },
                  {
                    type: 'text',
                    text: bodyText,
                    size: 'sm',
                    color: '#6b7280',
                    wrap: true,
                  },
                  {
                    type: 'text',
                    text: `訂單編號 #${orderId.slice(-6).toUpperCase()}`,
                    size: 'xs',
                    color: '#9ca3af',
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
                    action: { type: 'uri', label: '查看契約 PDF', uri: pdfUrl },
                    style: 'primary',
                    color: isSupp ? '#d97706' : '#059669',
                    height: 'sm',
                  },
                ],
              },
            },
          },
        ],
      }),
    })

    if (!res.ok) {
      // LINE 發送失敗不視為致命錯誤（PDF 已上傳成功）
      const body = await res.text()
      console.error('LINE push failed:', res.status, body)
      return { ok: true, data: { sent: false } }
    }

    return { ok: true, data: { sent: true } }
  } catch (e) {
    console.error('generateAndSendContract error:', e)
    const msg = e instanceof Error ? e.message : '未知錯誤'
    if (
      msg.includes('executablePath') ||
      msg.includes('chromium') ||
      msg.includes('browser')
    ) {
      return {
        ok: false,
        error:
          'PDF 產出失敗：瀏覽器核心未找到。本地開發請設定 PUPPETEER_EXECUTABLE_PATH（見 .env.example）',
      }
    }
    return { ok: false, error: 'PDF 產出或發送失敗，請稍後再試或聯絡技術人員' }
  }
}

// 補償：PDF 上傳失敗或合約記錄失敗時清理
export { deleteContractPdf }
