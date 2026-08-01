import { google } from 'googleapis'
import type { OAuth2Client, JWT } from 'google-auth-library'

export function normalizePrivateKey(raw: string | undefined): string | null {
  if (!raw) return null
  let key = raw.trim()
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1)
  }
  key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
  return key
}

export function getDriveAuth(): { drive: ReturnType<typeof google.drive>; auth: JWT } {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_PRIVATE_KEY
  const key = normalizePrivateKey(rawKey)

  if (!email || !key) {
    console.error('[getDriveAuth] Missing credentials:', {
      hasEmail: !!email,
      hasRawKey: !!rawKey,
      normalizedKeyLength: key?.length || 0,
    })
    throw new Error('Google Drive credentials not configured')
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })

  return { drive: google.drive({ version: 'v3', auth }), auth }
}
