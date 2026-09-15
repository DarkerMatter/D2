import type { MiddlewareHandler } from 'hono'
import { getCookie, deleteCookie } from 'hono/cookie'
import type { Env } from '../types'
import { verifyToken } from '../services/auth'
import { addToast, redirectWithFlash } from './flash'

export const AUTH_COOKIE = 'auth_token'

export const isAuthenticated: MiddlewareHandler<Env> = async (c, next) => {
  const token = getCookie(c, AUTH_COOKIE)
  if (!token) {
    addToast(c, { type: 'error', message: 'You must be logged in to view this page.' })
    return redirectWithFlash(c, '/login')
  }

  const payload = await verifyToken(token, c.env.JWT_SECRET)
  if (!payload) {
    deleteCookie(c, AUTH_COOKIE, { path: '/' })
    addToast(c, { type: 'error', message: 'Your session has expired. Please log in again.' })
    return redirectWithFlash(c, '/login')
  }

  // Check KV for revoked sessions
  const revoked = await c.env.SESSIONS.get(`revoked:${payload.sessionId}`)
  if (revoked) {
    deleteCookie(c, AUTH_COOKIE, { path: '/' })
    addToast(c, { type: 'error', message: 'Your session has been revoked.' })
    return redirectWithFlash(c, '/login')
  }

  // Live DB check for ban/deletion
  const user = await c.env.DB.prepare(
    'SELECT id, username, permission_level FROM users WHERE id = ?'
  )
    .bind(payload.userId)
    .first<{ id: number; username: string; permission_level: number }>()

  if (!user) {
    deleteCookie(c, AUTH_COOKIE, { path: '/' })
    addToast(c, { type: 'error', message: 'Your account could not be found.' })
    return redirectWithFlash(c, '/login')
  }

  if (user.permission_level === 0) {
    deleteCookie(c, AUTH_COOKIE, { path: '/' })
    await c.env.SESSIONS.put(`revoked:${payload.sessionId}`, '1', {
      expirationTtl: 86400,
    })
    addToast(c, { type: 'error', message: 'Your account has been suspended.' })
    return redirectWithFlash(c, '/login')
  }

  c.set('user', {
    userId: user.id,
    username: user.username,
    permissionLevel: user.permission_level,
    sessionId: payload.sessionId,
    exp: payload.exp,
  })

  await next()
}

export const isAdmin: MiddlewareHandler<Env> = async (c, next) => {
  const user = c.get('user')
  if (!user || user.permissionLevel !== 5) {
    addToast(c, {
      type: 'error',
      message: 'You do not have permission to access this resource.',
    })
    return redirectWithFlash(c, '/dashboard')
  }
  await next()
}
