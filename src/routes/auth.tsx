import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import type { Env } from '../types'
import { hashPassword, verifyPassword, createToken } from '../services/auth'
import { addToast, redirectWithFlash } from '../middleware/flash'
import { AUTH_COOKIE } from '../middleware/auth'
import { Layout } from '../components/Layout'
import { LoginPage } from '../components/pages/Login'
import { RegisterPage } from '../components/pages/Register'

export const authRoutes = new Hono<Env>()

authRoutes.get('/login', (c) => {
  return c.html(
    <Layout user={c.get('user')} flash={c.get('flash')}>
      <LoginPage />
    </Layout>
  )
})

authRoutes.post('/login', async (c) => {
  const { username, password } = await c.req.parseBody<{
    username: string
    password: string
  }>()

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?')
    .bind(username)
    .first<any>()

  if (!user) {
    addToast(c, { type: 'error', message: 'Invalid username or password.' })
    return redirectWithFlash(c, '/login')
  }

  if (user.permission_level === 0) {
    addToast(c, { type: 'error', message: 'This account has been suspended.' })
    return redirectWithFlash(c, '/login')
  }

  const valid = await verifyPassword(password, user.password)
  if (!valid) {
    addToast(c, { type: 'error', message: 'Invalid username or password.' })
    return redirectWithFlash(c, '/login')
  }

  const sessionId = crypto.randomUUID()
  const token = await createToken(
    {
      userId: user.id,
      username: user.username,
      permissionLevel: user.permission_level,
      sessionId,
    },
    c.env.JWT_SECRET
  )

  setCookie(c, AUTH_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 86400,
  })

  return c.redirect('/dashboard')
})

authRoutes.get('/register', (c) => {
  return c.html(
    <Layout user={c.get('user')} flash={c.get('flash')}>
      <RegisterPage />
    </Layout>
  )
})

authRoutes.post('/register', async (c) => {
  const body = await c.req.parseBody<{
    username: string
    password: string
    invite_code: string
  }>()
  const { username, password, invite_code: inviteCode } = body

  if (!username || !password || !inviteCode) {
    addToast(c, {
      type: 'error',
      message: 'Username, password, and invite code are required.',
    })
    return redirectWithFlash(c, '/register')
  }

  if (password.length < 8) {
    addToast(c, {
      type: 'error',
      message: 'Password must be at least 8 characters long.',
    })
    return redirectWithFlash(c, '/register')
  }

  // does this invite code even exist or are they just making stuff up
  const invite = await c.env.DB.prepare(
    'SELECT id, used_by_user_id FROM invite_codes WHERE code = ?'
  )
    .bind(inviteCode)
    .first<{ id: number; used_by_user_id: number | null }>()

  if (!invite) {
    addToast(c, { type: 'error', message: 'Invalid invite code.' })
    return redirectWithFlash(c, '/register')
  }
  if (invite.used_by_user_id) {
    addToast(c, {
      type: 'error',
      message: 'This invite code has already been used.',
    })
    return redirectWithFlash(c, '/register')
  }

  // someone already took this name? of course they did
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE username = ?'
  )
    .bind(username)
    .first()
  if (existing) {
    addToast(c, { type: 'error', message: 'That username is already taken.' })
    return redirectWithFlash(c, '/register')
  }

  // FINALLY just make the account already
  const hashedPassword = await hashPassword(password)
  const userResult = await c.env.DB.prepare(
    'INSERT INTO users (username, password, permission_level) VALUES (?, ?, 1)'
  )
    .bind(username, hashedPassword)
    .run()

  const newUserId = userResult.meta.last_row_id as number

  // burn the invite code. one and done.
  await c.env.DB.prepare(
    "UPDATE invite_codes SET used_by_user_id = ?, used_at = datetime('now') WHERE id = ?"
  )
    .bind(newUserId, invite.id)
    .run()

  // log them in immediately because making them log in again after registering is actual insanity
  const sessionId = crypto.randomUUID()
  const token = await createToken(
    { userId: newUserId, username, permissionLevel: 1, sessionId },
    c.env.JWT_SECRET
  )

  setCookie(c, AUTH_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 86400,
  })

  addToast(c, {
    type: 'success',
    message: 'Welcome! Your account has been created.',
  })
  return redirectWithFlash(c, '/dashboard')
})

authRoutes.get('/logout', async (c) => {
  const user = c.get('user')
  if (user) {
    await c.env.SESSIONS.put(`revoked:${user.sessionId}`, '1', {
      expirationTtl: 86400,
    })
  }
  deleteCookie(c, AUTH_COOKIE, { path: '/' })
  return c.redirect('/')
})
