import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import type { Env } from '../types'
import { createToken, exchangeDiscordCode, getDiscordUser } from '../services/auth'
import { addToast, redirectWithFlash } from '../middleware/flash'
import { AUTH_COOKIE } from '../middleware/auth'
import { Layout } from '../components/Layout'
import { LoginPage } from '../components/pages/Login'

export const authRoutes = new Hono<Env>()

authRoutes.get('/login', (c) => {
  return c.html(
    <Layout user={c.get('user')} flash={c.get('flash')}>
      <LoginPage />
    </Layout>
  )
})

// discord oauth start — one button, one flow, no invite codes, no passwords, just vibes
authRoutes.get('/auth/discord', async (c) => {
  const state = crypto.randomUUID()
  setCookie(c, '__oauth_state', state, {
    path: '/',
    httpOnly: true,
    maxAge: 300,
    sameSite: 'Lax',
  })

  const origin = new URL(c.req.url).origin
  const params = new URLSearchParams({
    client_id: c.env.DISCORD_CLIENT_ID,
    redirect_uri: `${origin}/auth/discord/callback`,
    response_type: 'code',
    scope: 'identify',
    state,
  })

  return c.redirect(`https://discord.com/oauth2/authorize?${params}`)
})

// discord callback — where the magic happens (or doesn't)
authRoutes.get('/auth/discord/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const savedState = getCookie(c, '__oauth_state')

  deleteCookie(c, '__oauth_state', { path: '/' })

  if (!code || !state || state !== savedState) {
    addToast(c, { type: 'error', message: 'OAuth failed. Try again.' })
    return redirectWithFlash(c, '/login')
  }

  const origin = new URL(c.req.url).origin

  let discordUser
  try {
    const tokenData = await exchangeDiscordCode(
      code,
      c.env.DISCORD_CLIENT_ID,
      c.env.DISCORD_CLIENT_SECRET,
      `${origin}/auth/discord/callback`
    )
    discordUser = await getDiscordUser(tokenData.access_token)
  } catch (err) {
    console.error('Discord OAuth error:', err)
    addToast(c, { type: 'error', message: 'Failed to authenticate with Discord.' })
    return redirectWithFlash(c, '/login')
  }

  const displayName = discordUser.global_name || discordUser.username

  // check if they already exist
  let user = await c.env.DB.prepare('SELECT * FROM users WHERE discord_id = ?')
    .bind(discordUser.id)
    .first<any>()

  if (user) {
    // returning user — sync their discord info
    await c.env.DB.prepare(
      'UPDATE users SET username = ?, discord_username = ?, discord_avatar = ? WHERE id = ?'
    ).bind(displayName, discordUser.username, discordUser.avatar, user.id).run()

    if (user.permission_level === 0) {
      addToast(c, { type: 'error', message: 'Your account has been suspended.' })
      return redirectWithFlash(c, '/login')
    }

    const sessionId = crypto.randomUUID()
    const token = await createToken({
      userId: user.id,
      username: displayName,
      permissionLevel: user.permission_level,
      sessionId,
    }, c.env.JWT_SECRET)

    setCookie(c, AUTH_COOKIE, token, {
      path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 86400,
    })

    return c.redirect('/dashboard')
  }

  // brand new user — create account automatically from discord profile
  const result = await c.env.DB.prepare(
    'INSERT INTO users (username, discord_id, discord_username, discord_avatar, permission_level) VALUES (?, ?, ?, ?, 1)'
  ).bind(displayName, discordUser.id, discordUser.username, discordUser.avatar).run()

  const newUserId = result.meta.last_row_id as number

  const sessionId = crypto.randomUUID()
  const token = await createToken({
    userId: newUserId,
    username: displayName,
    permissionLevel: 1,
    sessionId,
  }, c.env.JWT_SECRET)

  setCookie(c, AUTH_COOKIE, token, {
    path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 86400,
  })

  addToast(c, { type: 'success', message: `Welcome ${displayName}! Your account has been created.` })
  return redirectWithFlash(c, '/dashboard')
})

authRoutes.get('/logout', async (c) => {
  const user = c.get('user')
  if (user) {
    await c.env.SESSIONS.put(`revoked:${user.sessionId}`, '1', { expirationTtl: 86400 })
  }
  deleteCookie(c, AUTH_COOKIE, { path: '/' })
  return c.redirect('/')
})
