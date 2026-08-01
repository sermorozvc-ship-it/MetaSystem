import { NextRequest, NextResponse } from 'next/server'

/**
 * Редирект на Google OAuth consent screen.
 * Используется ОДИН РАЗ для получения refresh token.
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID не задан в .env.local' }, { status: 500 })
  }

  const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.file')

  return NextResponse.redirect(authUrl.toString())
}
