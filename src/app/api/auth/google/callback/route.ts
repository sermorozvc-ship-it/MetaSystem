import { NextRequest, NextResponse } from 'next/server'

/**
 * OAuth2 callback для получения Google refresh token.
 * Это一次性 операция для настройки — обычный пользователь сюда не попадает.
 *
 * Использование:
 * 1. Открой /api/auth/google/login в браузере
 * 2. Авторизуйся через Google
 * 3. Refresh token отобразится на экране — скопируй в .env.local
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ error: 'Нет code параметра' }, { status: 400 })
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID или GOOGLE_CLIENT_SECRET не заданы в .env.local' }, { status: 500 })
  }

  const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px">
        <h2>Ошибка обмена кода</h2>
        <pre style="background:#fee;padding:16px;border-radius:8px">${err}</pre>
        <p>Убедись что redirect URI совпадает: <code>${redirectUri}</code></p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  const data = await res.json()
  const refreshToken = data.refresh_token

  if (!refreshToken) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px">
        <h2>Refresh token не получен</h2>
        <p>Возможно, нужно добавить параметр <code>access_type=offline</code> при авторизации.</p>
        <pre style="background:#f5f5f5;padding:16px;border-radius:8px">${JSON.stringify(data, null, 2)}</pre>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px">
      <h2 style="color:#16a34a">Refresh token получен!</h2>
      <p>Скопируй эту строку в <code>.env.local</code>:</p>
      <div style="background:#f0fdf4;border:2px solid #16a34a;padding:16px;border-radius:8px;margin:16px 0">
        <code style="word-break:break-all;font-size:14px">GOOGLE_REFRESH_TOKEN=${refreshToken}</code>
      </div>
      <p>После этого удали этот роут (или оставь — он не мешает).</p>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
