import { messagingApi } from '@line/bot-sdk'
import { getClient } from './client'

const RICH_MENU: messagingApi.RichMenuRequest = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: '寵物美容預約選單',
  chatBarText: '預約管理',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 1250, height: 843 },
      action: {
        type: 'postback',
        label: '我要預約',
        data: 'action=book',
        displayText: '我要預約',
      },
    },
    {
      bounds: { x: 1250, y: 0, width: 1250, height: 843 },
      action: {
        type: 'postback',
        label: '查詢預約',
        data: 'action=check',
        displayText: '查詢預約',
      },
    },
  ],
}

/**
 * 建立並設定預設 Rich Menu。
 * imagePath: 2500x843 px PNG/JPEG（左半「我要預約」，右半「查詢預約」）。
 */
export async function setupRichMenu(imagePath: string): Promise<string> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set')

  const client = getClient()
  const blobClient = new messagingApi.MessagingApiBlobClient({
    channelAccessToken: token,
  })

  const { richMenuId } = await client.createRichMenu(RICH_MENU)
  console.log(`[richmenu] created: ${richMenuId}`)

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
    process.exit(1)
  }
  setupRichMenu(imagePath).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
