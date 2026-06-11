import { messagingApi } from '@line/bot-sdk'

let _client: messagingApi.MessagingApiClient | null = null

export function getClient(): messagingApi.MessagingApiClient {
  if (!_client) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set')
    _client = new messagingApi.MessagingApiClient({ channelAccessToken: token })
  }
  return _client
}
