declare module 'web-push' {
  interface PushSubscription {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  }

  interface VapidKeys {
    publicKey: string
    privateKey: string
  }

  interface RequestOptions {
    gcmAPIKey?: string
    vapidDetails?: {
      subject: string
      publicKey: string
      privateKey: string
    }
    TTL?: number
    headers?: Record<string, string>
    contentEncoding?: string
    proxy?: string
    agent?: unknown
    timeout?: number
  }

  interface SendResult {
    statusCode: number
    body: string
    headers: Record<string, string>
  }

  function setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  function generateVAPIDKeys(): VapidKeys
  function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer | null,
    options?: RequestOptions
  ): Promise<SendResult>

  export { setVapidDetails, generateVAPIDKeys, sendNotification }
  export type { PushSubscription, VapidKeys, RequestOptions, SendResult }
}
