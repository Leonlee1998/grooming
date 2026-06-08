'use server'

import { z } from 'zod'
import { prismaAdmin } from '@repo/db'
import { fillTemplate, generatePdf, uploadContractPdf } from '@repo/contract'
import type { ContractData } from '@repo/contract'

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ─── finalizeOrder ────────────────────────────────────────────────────────

const orderItemSchema = z.object({
  serviceId: z.string().min(1),
  serviceName: z.string().min(1),
  unitPrice: z.number().int().nonnegative(),
  quantity: z.number().int().positive().max(20),
})

const finalizeOrderSchema = z.object({
  customerId: z.string().min(1),
  petId: z.string().min(1),
  staffId: z.string().optional(),
  orderItems: z.array(orderItemSchema).min(1, '至少需要一項服務'),
  subtotalAmount: z.number().int().nonnegative(),
  discountAmount: z.number().int().nonnegative(),
  totalAmount: z.number().int().nonnegative(),
  contractData: z.record(z.unknown()),
  signatureDataUrl: z.string().startsWith('data:image/'),
  customFieldValues: z.record(z.string()).optional(),
  notes: z.string().optional(),
})

export type FinalizeOrderInput = z.infer<typeof finalizeOrderSchema>

export async function finalizeOrder(
  raw: unknown,
): Promise<
  ActionResult<{ orderId: string; contractId: string; pdfUrl: string }>
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
  } = parsed.data

  // ── Phase 0: Fetch active template ──────────────────────────────────────
  let templateId: string
  let templateHtml: string
  try {
    const template = await prismaAdmin.contractTemplate.findFirst({
      where: { type: 'SINGLE_SERVICE', isActive: true },
      select: { id: true, htmlContent: true },
      orderBy: { version: 'desc' },
    })
    if (!template)
      return { ok: false, error: '找不到契約模板，請先執行 db:seed' }
    templateId = template.id
    templateHtml = template.htmlContent
  } catch (e) {
    console.error('finalizeOrder Phase 0 failed:', e)
    return { ok: false, error: '讀取契約模板失敗' }
  }

  // ── Phase 1: Create Order + OrderItems (transaction) ────────────────────
  let orderId: string
  try {
    const order = await prismaAdmin.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          customerId,
          petId,
          ...(staffId ? { staffId } : {}),
          status: 'CONFIRMED',
          subtotalAmount,
          discountAmount,
          overtimeFee: 0,
          totalAmount,
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

  // ── Phase 2: Fill template, generate PDF, upload ─────────────────────────
  const filledData = { ...contractData, signatureDataUrl } as ContractData
  let pdfUrl: string
  try {
    const filledHtml = fillTemplate(templateHtml, filledData)
    const pdfBuffer = await generatePdf(filledHtml)
    pdfUrl = await uploadContractPdf(pdfBuffer, orderId)
  } catch (e) {
    console.error('finalizeOrder Phase 2 failed:', e)
    await prismaAdmin.order
      .update({ where: { id: orderId }, data: { status: 'CANCELLED' } })
      .catch(console.error)
    return {
      ok: false,
      error: 'PDF 產出失敗，請稍後再試（約 3-5 秒，網路逾時請重試）',
    }
  }

  // ── Phase 3: Create Contract + PointTransaction (transaction) ────────────
  let contractId: string
  try {
    const now = new Date()
    const result = await prismaAdmin.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          orderId,
          templateId,
          customerId,
          petId,
          filledData: filledData as object,
          ...(customFieldValues ? { customFieldValues } : {}),
          signatureDataUrl,
          signedAt: now,
          pdfUrl,
          pdfGeneratedAt: now,
        },
        select: { id: true },
      })

      // Member point reward
      const member = await tx.member.findUnique({
        where: { customerId },
        select: {
          id: true,
          expiresAt: true,
          plan: { select: { pointRate: true, isActive: true } },
        },
      })

      if (
        member &&
        member.plan.isActive &&
        (!member.expiresAt || member.expiresAt > now) &&
        totalAmount > 0
      ) {
        const earnedPoints = Math.floor(
          totalAmount * Number(member.plan.pointRate),
        )
        if (earnedPoints > 0) {
          await tx.pointTransaction.create({
            data: {
              memberId: member.id,
              orderId,
              amount: earnedPoints,
              type: 'EARN',
              note: '消費獲得點數',
            },
          })
          await tx.member.update({
            where: { id: member.id },
            data: { points: { increment: earnedPoints } },
          })
        }
      }

      return { contractId: contract.id }
    })
    contractId = result.contractId
  } catch (e) {
    console.error('finalizeOrder Phase 3 failed:', e)
    await prismaAdmin.order
      .update({ where: { id: orderId }, data: { status: 'CANCELLED' } })
      .catch(console.error)
    return { ok: false, error: '建立契約紀錄失敗，請稍後再試' }
  }

  return { ok: true, data: { orderId, contractId, pdfUrl } }
}

// ─── sendContractToLine ───────────────────────────────────────────────────

const sendLineSchema = z.object({
  customerId: z.string().min(1),
  orderId: z.string().min(1),
  pdfUrl: z.string().min(1),
})

export async function sendContractToLine(
  raw: unknown,
): Promise<ActionResult<{ sent: boolean }>> {
  const parsed = sendLineSchema.safeParse(raw)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? '資料格式錯誤',
    }

  const { customerId, orderId, pdfUrl } = parsed.data

  try {
    const customer = await prismaAdmin.customer.findUnique({
      where: { id: customerId },
      select: { lineUserId: true, name: true },
    })

    if (!customer?.lineUserId) return { ok: true, data: { sent: false } }

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!token) return { ok: false, error: 'LINE_CHANNEL_ACCESS_TOKEN 未設定' }

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
            altText: `美容服務契約已簽署（訂單 #${orderId.slice(-6).toUpperCase()}）`,
            contents: {
              type: 'bubble',
              header: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#065f46',
                paddingAll: 'lg',
                contents: [
                  {
                    type: 'text',
                    text: '美容服務契約',
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
                    text: '您的寵物美容服務契約已完成簽署，請點選下方按鈕查閱或下載 PDF 存檔。',
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
                    action: {
                      type: 'uri',
                      label: '查看契約 PDF',
                      uri: pdfUrl,
                    },
                    style: 'primary',
                    color: '#059669',
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
      const body = await res.text()
      console.error('LINE push failed:', res.status, body)
      return {
        ok: false,
        error: `LINE 傳送失敗（${res.status}），請確認 LINE 設定`,
      }
    }

    return { ok: true, data: { sent: true } }
  } catch (e) {
    console.error('sendContractToLine error:', e)
    return { ok: false, error: 'LINE 通知傳送失敗，請稍後再試' }
  }
}
