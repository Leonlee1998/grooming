import { messagingApi } from '@line/bot-sdk'
import { getClient } from './client'

type RichMenuUriArea = messagingApi.RichMenuArea & {
  action: messagingApi.URIAction
}

type RichMenuUriAreas = [RichMenuUriArea, RichMenuUriArea]

function buildRichMenuAreas(): RichMenuUriAreas {
  const customerAppUrl =
    process.env.CUSTOMER_APP_URL ?? 'https://customer.example.com'
  const storeSlug = process.env.STORE_SLUG ?? 'default'
  const liffId = process.env.LINE_LIFF_ID ?? ''

  const bookingUrl = `${customerAppUrl}/book/${storeSlug}`
  // 「我的預約」透過 LIFF 開啟，帶 liff.state 讓 login 頁知道要導向哪裡
  const appointmentsUrl = liffId
    ? `https://liff.line.me/${liffId}?liff.state=%2Fappointments`
    : `${customerAppUrl}/appointments`

  return [
    {
      bounds: { x: 0, y: 0, width: 1250, height: 843 },
      action: {
        type: 'uri',
        label: '立即預約',
        uri: bookingUrl,
      },
    },
    {
      bounds: { x: 1250, y: 0, width: 1250, height: 843 },
      action: {
        type: 'uri',
        label: '我的預約',
        uri: appointmentsUrl,
      },
    },
  ]
}

const RICH_MENU_BASE: Omit<messagingApi.RichMenuRequest, 'areas'> = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: '寵物美容預約選單',
  chatBarText: '預約管理',
}

/**
 * 建立並設定預設 Rich Menu。
 * imagePath: 2500x843 px PNG/JPEG（左半「立即預約」，右半「我的預約」）。
 * 使用環境變數：CUSTOMER_APP_URL、STORE_SLUG、LINE_LIFF_ID
 */
export async function setupRichMenu(imagePath: string): Promise<string> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set')

  const client = getClient()
  const blobClient = new messagingApi.MessagingApiBlobClient({
    channelAccessToken: token,
  })

  const areas = buildRichMenuAreas()
  const richMenu: messagingApi.RichMenuRequest = {
    ...RICH_MENU_BASE,
    areas,
  }

  const { richMenuId } = await client.createRichMenu(richMenu)
  console.log(`[richmenu] created: ${richMenuId}`)
  console.log(`[richmenu] booking URL: ${areas[0].action.uri ?? ''}`)
  console.log(`[richmenu] appointments URL: ${areas[1].action.uri ?? ''}`)

  const { readFileSync } = await import('fs')
  const buf = readFileSync(imagePath)
  const contentType = imagePath.toLowerCase().endsWith('.png')
    ? 'image/png'
    : 'image/jpeg'
  await blobClient.setRichMenuImage(
    richMenuId,
    new Blob([buf], { type: contentType }),
  )
  console.log('[richmenu] image uploaded')

  await client.setDefaultRichMenu(richMenuId)
  console.log('[richmenu] set as default')

  return richMenuId
}

export async function cancelDefaultRichMenu(): Promise<void> {
  await getClient().cancelDefaultRichMenu()
  console.log('[richmenu] default removed')
}

// 直接執行：tsx src/richmenu.ts <image-path>
if (
  process.argv[1]?.endsWith('richmenu.ts') ||
  process.argv[1]?.endsWith('richmenu.js')
) {
  const imagePath = process.argv[2]
  if (!imagePath) {
    console.error('Usage: tsx src/richmenu.ts <path-to-image.png>')
    console.error('Env: CUSTOMER_APP_URL, STORE_SLUG, LINE_LIFF_ID')
    process.exit(1)
  }
  setupRichMenu(imagePath).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
