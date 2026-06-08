const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'

export type ReminderData = {
  petName: string
  pickupDeadlineAt: string
  storeName: string
}

export type OvertimeData = {
  petName: string
  overtimeMinutes: number
  fee: number
}

function getAccessToken(): string {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set')
  return token
}

async function pushMessage(to: string, messages: unknown[]): Promise<void> {
  const res = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({ to, messages }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`LINE push failed (${res.status}): ${body}`)
  }
}

export async function sendPickupReminder(
  lineUserId: string,
  data: ReminderData,
): Promise<void> {
  await pushMessage(lineUserId, [
    {
      type: 'text',
      text: [
        `📢 接回提醒`,
        ``,
        `您的寵物「${data.petName}」預計接回時間為 ${data.pickupDeadlineAt}，`,
        `距離接回時間剩約 30 分鐘，請準時前往 ${data.storeName} 接回。`,
        ``,
        `逾 30 分鐘依約計收逾時費，感謝配合。`,
      ].join('\n'),
    },
  ])
}

export async function sendOvertimeNotice(
  lineUserId: string,
  data: OvertimeData,
): Promise<void> {
  const h = Math.floor(data.overtimeMinutes / 60)
  const m = data.overtimeMinutes % 60
  const duration = h > 0 ? `${h} 小時${m > 0 ? ` ${m} 分` : ''}` : `${m} 分`

  await pushMessage(lineUserId, [
    {
      type: 'text',
      text: [
        `⏰ 逾時通知`,
        ``,
        `您的寵物「${data.petName}」已逾時 ${duration}，`,
        `依約計收逾時費 $${data.fee} 元。`,
        ``,
        `請盡快前來接回，如有疑問請來電洽詢。`,
      ].join('\n'),
    },
  ])
}

export async function sendBookingConfirmation(
  lineUserId: string,
  data: { appointmentId: string; scheduledAt: string; services: string[] },
): Promise<void> {
  await pushMessage(lineUserId, [
    {
      type: 'text',
      text: [
        `✅ 預約確認`,
        ``,
        `預約編號：#${data.appointmentId.slice(-6).toUpperCase()}`,
        `時間：${data.scheduledAt}`,
        `服務：${data.services.join('、')}`,
        ``,
        `如需更改或取消請提前告知，謝謝。`,
      ].join('\n'),
    },
  ])
}

export async function sendBookingReminder(
  lineUserId: string,
  data: { scheduledAt: string; petName: string },
): Promise<void> {
  await pushMessage(lineUserId, [
    {
      type: 'text',
      text: [
        `🐾 明日預約提醒`,
        ``,
        `「${data.petName}」明日 ${data.scheduledAt} 有美容預約，`,
        `請準時帶來，並確認疫苗接種記錄等相關文件。`,
      ].join('\n'),
    },
  ])
}
