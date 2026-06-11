import type { webhook, messagingApi } from '@line/bot-sdk'
import { getClient } from '../client'
import { getSession, setSession, clearSession } from '../session'
import { prismaAdmin, getAllStaffSlots, createBookingFromLine } from '@repo/db'
import type { StaffSlots } from '@repo/db'
import { sendBookingConfirmation } from '../notify'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const truncate = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s

// ─── Calendar Flex Message（14 天，每頁 7 天）──────────────────────────────────

function buildCalendarFlex(page: 0 | 1): messagingApi.FlexMessage {
  const now = Date.now()
  const start = page * 7 + 1

  const days = Array.from({ length: 7 }, (_, i) => {
    const ms = now + (start + i) * 86_400_000
    const tpe = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
    }).format(new Date(ms))
    const dow = new Date(`${tpe}T12:00:00+08:00`).getDay()
    const parts = tpe.split('-')
    return {
      wd: WEEKDAYS[dow] ?? '',
      dd: parseInt(parts[2] ?? '1', 10),
      mm: parseInt(parts[1] ?? '1', 10),
      value: tpe,
      isWeekend: dow === 0 || dow === 6,
    }
  })

  const bubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#FFF8F0',
      paddingMd: 'md',
      contents: [
        {
          type: 'text',
          text: page === 0 ? '請選擇日期（本週）' : '請選擇日期（下週）',
          weight: 'bold',
          color: '#78573A',
          size: 'sm',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'horizontal',
      spacing: 'none',
      contents: days.map((d) => ({
        type: 'box',
        layout: 'vertical',
        flex: 1,
        action: {
          type: 'postback',
          label: `${d.mm}/${d.dd}`,
          data: `action=date&value=${d.value}`,
        },
        paddingAll: 'xs',
        contents: [
          {
            type: 'text',
            text: d.wd,
            align: 'center',
            size: 'xxs',
            color: d.isWeekend ? '#CC4444' : '#888888',
          },
          {
            type: 'text',
            text: String(d.dd),
            align: 'center',
            size: 'sm',
            weight: 'bold',
            color: d.isWeekend ? '#CC4444' : '#333333',
          },
        ],
      })),
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      contents:
        page === 0
          ? [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '下週 ▶',
                  data: 'action=cal_page&page=1',
                },
                style: 'link',
              },
            ]
          : [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '◀ 上週',
                  data: 'action=cal_page&page=0',
                },
                style: 'link',
              },
            ],
    },
  } as messagingApi.FlexBubble

  return {
    type: 'flex',
    altText: page === 0 ? '請選擇日期（本週）' : '請選擇日期（下週）',
    contents: bubble,
  }
}

// ─── Slot Carousel（每個美容師一個 Bubble）─────────────────────────────────────

function buildStaffBubble(staffSlot: StaffSlots): messagingApi.FlexBubble {
  const { staff, slots } = staffSlot
  const available = slots.filter((s) => s.available).slice(0, 20)

  const rows: object[] = []
  for (let i = 0; i < available.length; i += 4) {
    const row = available.slice(i, i + 4)
    rows.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'xs',
      margin: i === 0 ? 'none' : 'xs',
      contents: row.map((s) => ({
        type: 'button',
        flex: 1,
        style: 'secondary',
        height: 'sm',
        action: {
          type: 'postback',
          label: s.time,
          data: `action=slot&staffId=${staff.id}&value=${s.time}`,
        },
      })),
    })
  }

  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#EBF5FF',
      contents: [
        {
          type: 'text',
          text: staff.name,
          weight: 'bold',
          size: 'md',
          color: '#1A3A5C',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'none',
      contents:
        available.length === 0
          ? [
              {
                type: 'text',
                text: '今日客滿',
                color: '#999999',
                align: 'center',
                size: 'sm',
              },
            ]
          : rows,
    },
  } as messagingApi.FlexBubble
}

// ─── Service Selection（QuickReply，支援多選）──────────────────────────────────

async function sendServiceSelection(
  replyToken: string,
  lineUserId: string,
  customerId: string,
  petId: string,
  selectedIds: string[],
): Promise<void> {
  const client = getClient()
  const allServices = await prismaAdmin.service.findMany({
    where: { isActive: true },
    select: { id: true, name: true, basePrice: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    take: 12,
  })

  const remaining = allServices.filter((s) => !selectedIds.includes(s.id))
  const selectedNames = allServices
    .filter((s) => selectedIds.includes(s.id))
    .map((s) => s.name)

  await setSession(lineUserId, {
    step: 'select_services',
    customerId,
    petId,
    selectedIds,
  })

  const selectedText =
    selectedNames.length > 0 ? `已選：${selectedNames.join('、')}\n\n` : ''

  const serviceItems: messagingApi.QuickReplyItem[] = remaining
    .slice(0, selectedIds.length > 0 ? 12 : 13)
    .map((s) => ({
      type: 'action',
      action: {
        type: 'postback',
        label: truncate(`${s.name} $${s.basePrice}`, 20),
        data: `action=service&id=${s.id}`,
        displayText: s.name,
      },
    }))

  const doneItems: messagingApi.QuickReplyItem[] =
    selectedIds.length > 0
      ? [
          {
            type: 'action',
            action: {
              type: 'postback',
              label: '✓ 完成選擇',
              data: 'action=done_services',
              displayText: '完成選擇',
            },
          },
        ]
      : []

  await client.replyMessage({
    replyToken,
    messages: [
      {
        type: 'text',
        text: `${selectedText}請選擇服務項目：`,
        quickReply: { items: [...serviceItems, ...doneItems].slice(0, 13) },
      },
    ],
  })
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

export async function handlePostback(
  event: webhook.PostbackEvent,
): Promise<void> {
  const lineUserId = event.source?.userId
  if (!lineUserId) return

  const replyToken = event.replyToken
  if (!replyToken) return

  const client = getClient()
  const params = new URLSearchParams(event.postback.data)
  const action = params.get('action')

  switch (action) {
    // ── 開始預約流程 ────────────────────────────────────────────────────────────
    case 'book': {
      const customer = await prismaAdmin.customer.findUnique({
        where: { lineUserId },
        select: { id: true, name: true },
      })

      if (!customer) {
        await setSession(lineUserId, { step: 'awaiting_phone' })
        await client.replyMessage({
          replyToken,
          messages: [
            {
              type: 'text',
              text: '請先輸入您的手機號碼綁定帳號（例：0912345678）：',
            },
          ],
        })
        return
      }

      const pets = await prismaAdmin.pet.findMany({
        where: { customerId: customer.id },
        select: { id: true, name: true },
      })

      if (pets.length === 0) {
        await client.replyMessage({
          replyToken,
          messages: [
            {
              type: 'text',
              text: `${customer.name} 您好！\n目前沒有寵物資料，請至門市登記寵物資訊後再預約。`,
            },
          ],
        })
        return
      }

      if (pets.length === 1) {
        await sendServiceSelection(
          replyToken,
          lineUserId,
          customer.id,
          pets[0].id,
          [],
        )
        return
      }

      await setSession(lineUserId, {
        step: 'select_pet',
        customerId: customer.id,
      })
      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: `${customer.name} 您好！請選擇要預約的寵物：`,
            quickReply: {
              items: pets.slice(0, 13).map((p) => ({
                type: 'action' as const,
                action: {
                  type: 'postback' as const,
                  label: truncate(p.name, 20),
                  data: `action=pet&id=${p.id}`,
                  displayText: p.name,
                },
              })),
            },
          },
        ],
      })
      break
    }

    // ── 查詢預約 ────────────────────────────────────────────────────────────────
    case 'check': {
      const customer = await prismaAdmin.customer.findUnique({
        where: { lineUserId },
        select: { id: true, name: true },
      })

      if (!customer) {
        await setSession(lineUserId, { step: 'awaiting_phone' })
        await client.replyMessage({
          replyToken,
          messages: [
            { type: 'text', text: '尚未綁定帳號，請輸入您的手機號碼：' },
          ],
        })
        return
      }

      const upcoming = await prismaAdmin.appointment.findMany({
        where: {
          customerId: customer.id,
          scheduledAt: { gte: new Date() },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        include: { pet: { select: { name: true } } },
        orderBy: { scheduledAt: 'asc' },
        take: 3,
      })

      if (upcoming.length === 0) {
        await client.replyMessage({
          replyToken,
          messages: [
            {
              type: 'text',
              text: '目前沒有待處理的預約。\n\n點「我要預約」建立新預約！',
            },
          ],
        })
        return
      }

      const fmt = new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      const lines = upcoming.map(
        (a) => `• ${a.pet.name} ${fmt.format(new Date(a.scheduledAt))}`,
      )
      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: `${customer.name} 您的預約：\n\n${lines.join('\n')}`,
          },
        ],
      })
      break
    }

    // ── 選擇寵物 ────────────────────────────────────────────────────────────────
    case 'pet': {
      const petId = params.get('id')
      if (!petId) return

      const session = await getSession(lineUserId)
      if (session?.step !== 'select_pet') return

      await sendServiceSelection(
        replyToken,
        lineUserId,
        session.customerId,
        petId,
        [],
      )
      break
    }

    // ── 選擇服務（toggle 多選）─────────────────────────────────────────────────
    case 'service': {
      const serviceId = params.get('id')
      if (!serviceId) return

      const session = await getSession(lineUserId)
      if (session?.step !== 'select_services') return

      const newIds = session.selectedIds.includes(serviceId)
        ? session.selectedIds.filter((id) => id !== serviceId)
        : [...session.selectedIds, serviceId]

      await sendServiceSelection(
        replyToken,
        lineUserId,
        session.customerId,
        session.petId,
        newIds,
      )
      break
    }

    // ── 服務選完，顯示日曆（Flex Message）──────────────────────────────────────
    case 'done_services': {
      const session = await getSession(lineUserId)
      if (session?.step !== 'select_services') return

      if (session.selectedIds.length === 0) {
        await client.replyMessage({
          replyToken,
          messages: [{ type: 'text', text: '請至少選擇一項服務後再繼續。' }],
        })
        return
      }

      const services = await prismaAdmin.service.findMany({
        where: { id: { in: session.selectedIds } },
        select: { estimatedMinutes: true },
      })
      const estimatedMinutes = services.reduce(
        (sum, s) => sum + s.estimatedMinutes,
        0,
      )

      await setSession(lineUserId, {
        step: 'select_date',
        customerId: session.customerId,
        petId: session.petId,
        serviceIds: session.selectedIds,
        estimatedMinutes,
      })

      await client.replyMessage({
        replyToken,
        messages: [buildCalendarFlex(0)],
      })
      break
    }

    // ── 日曆翻頁（本週 ↔ 下週）────────────────────────────────────────────────
    case 'cal_page': {
      const session = await getSession(lineUserId)
      if (session?.step !== 'select_date') return

      const page = (parseInt(params.get('page') ?? '0') === 1 ? 1 : 0) as 0 | 1
      await client.replyMessage({
        replyToken,
        messages: [buildCalendarFlex(page)],
      })
      break
    }

    // ── 選擇日期，顯示時段 Carousel ─────────────────────────────────────────────
    case 'date': {
      const dateValue = params.get('value')
      if (!dateValue) return

      const session = await getSession(lineUserId)
      if (session?.step !== 'select_date') return

      const staffSlots = await getAllStaffSlots(dateValue)
      const anyAvailable = staffSlots.some((ss) =>
        ss.slots.some((s) => s.available),
      )

      if (!anyAvailable) {
        await client.replyMessage({
          replyToken,
          messages: [
            {
              type: 'text',
              text: `${dateValue} 當天所有時段已滿，請選擇其他日期。`,
            },
          ],
        })
        return
      }

      await setSession(lineUserId, {
        step: 'select_slot',
        customerId: session.customerId,
        petId: session.petId,
        serviceIds: session.serviceIds,
        estimatedMinutes: session.estimatedMinutes,
        date: dateValue,
      })

      const [, mm, dd] = dateValue.split('-')
      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'flex',
            altText: `${mm}/${dd} 可預約時段`,
            contents: {
              type: 'carousel',
              contents: staffSlots.map(buildStaffBubble),
            } as messagingApi.FlexCarousel,
          },
        ],
      })
      break
    }

    // ── 選擇時段，顯示確認 Bubble ──────────────────────────────────────────────
    case 'slot': {
      const slotValue = params.get('value')
      const staffId = params.get('staffId')
      if (!slotValue || !staffId) return

      const session = await getSession(lineUserId)
      if (session?.step !== 'select_slot') return

      await setSession(lineUserId, {
        step: 'booking_confirm',
        customerId: session.customerId,
        petId: session.petId,
        serviceIds: session.serviceIds,
        estimatedMinutes: session.estimatedMinutes,
        date: session.date,
        staffId,
        slot: slotValue,
      })

      const [pet, services, staff] = await Promise.all([
        prismaAdmin.pet.findUnique({
          where: { id: session.petId },
          select: { name: true },
        }),
        prismaAdmin.service.findMany({
          where: { id: { in: session.serviceIds } },
          select: { name: true, basePrice: true },
        }),
        prismaAdmin.staff.findUnique({
          where: { id: staffId },
          select: { name: true },
        }),
      ])

      const totalPrice = services.reduce((sum, s) => sum + s.basePrice, 0)
      const serviceLines = services
        .map((s) => `• ${s.name} $${s.basePrice}`)
        .join('\n')

      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'flex',
            altText: `預約確認 ${session.date} ${slotValue}`,
            contents: {
              type: 'bubble',
              header: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#FFF8F0',
                contents: [
                  {
                    type: 'text',
                    text: '預約確認',
                    weight: 'bold',
                    size: 'lg',
                    color: '#78573A',
                  },
                ],
              },
              body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                  {
                    type: 'text',
                    text: `寵物：${pet?.name ?? '-'}`,
                    size: 'sm',
                  },
                  {
                    type: 'text',
                    text: `美容師：${staff?.name ?? '-'}`,
                    size: 'sm',
                  },
                  {
                    type: 'text',
                    text: `日期：${session.date} ${slotValue}`,
                    size: 'sm',
                  },
                  { type: 'separator' },
                  {
                    type: 'text',
                    text: '服務項目',
                    weight: 'bold',
                    size: 'sm',
                  },
                  { type: 'text', text: serviceLines, size: 'sm', wrap: true },
                  { type: 'separator' },
                  {
                    type: 'text',
                    text: `預估時間：約 ${session.estimatedMinutes} 分鐘`,
                    size: 'sm',
                    color: '#666666',
                  },
                  {
                    type: 'text',
                    text: `費用試算：$${totalPrice}`,
                    size: 'sm',
                    weight: 'bold',
                  },
                ],
              },
              footer: {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  {
                    type: 'button',
                    action: {
                      type: 'postback',
                      label: '確認預約',
                      data: 'action=confirm',
                    },
                    style: 'primary',
                    color: '#78573A',
                  },
                  {
                    type: 'button',
                    action: {
                      type: 'postback',
                      label: '取消',
                      data: 'action=cancel',
                    },
                    style: 'secondary',
                  },
                ],
              },
            } as messagingApi.FlexBubble,
          },
        ],
      })
      break
    }

    // ── 確認建立預約（呼叫 createBookingFromLine）──────────────────────────────
    case 'confirm': {
      const session = await getSession(lineUserId)
      if (session?.step !== 'booking_confirm') return

      const scheduledAt = new Date(`${session.date}T${session.slot}:00+08:00`)

      const { appointmentId } = await createBookingFromLine({
        customerId: session.customerId,
        petId: session.petId,
        staffId: session.staffId,
        serviceIds: session.serviceIds,
        scheduledAt,
      })

      await clearSession(lineUserId)

      const [services] = await Promise.all([
        prismaAdmin.service.findMany({
          where: { id: { in: session.serviceIds } },
          select: { name: true },
        }),
      ])

      const fmtTime = new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(scheduledAt)

      // 推播確認通知，不佔用 replyToken
      sendBookingConfirmation(lineUserId, {
        appointmentId,
        scheduledAt: fmtTime,
        services: services.map((s) => s.name),
      }).catch((err) => console.error('[confirm] push failed:', err))

      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: [
              '預約成功！✓',
              '',
              `📅 ${session.date} ${session.slot}`,
              `預約編號：#${appointmentId.slice(-6).toUpperCase()}`,
              '',
              '我們會在預約前一天提醒您。',
              '如需更改或取消，請聯絡門市。',
            ].join('\n'),
          },
        ],
      })
      break
    }

    // ── 取消預約流程 ────────────────────────────────────────────────────────────
    case 'cancel': {
      await clearSession(lineUserId)
      await client.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: '已取消，可隨時重新使用選單預約。' }],
      })
      break
    }

    default: {
      await client.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: '請使用下方選單進行操作。' }],
      })
    }
  }
}
