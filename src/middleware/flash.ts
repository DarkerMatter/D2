import type { MiddlewareHandler, Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Env, ToastNotification, FlashMessages } from '../types'
import { verifyToken } from '../services/auth'

const FLASH_COOKIE = '__flash'
const AUTH_COOKIE = 'auth_token'

export const flashMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  // try to identify the user from JWT so the nav renders correctly on ALL pages,
  // not just auth-protected ones. don't redirect, don't block, just peek.
  c.set('user', null)
  const token = getCookie(c, AUTH_COOKIE)
  if (token) {
    try {
      const payload = await verifyToken(token, c.env.JWT_SECRET)
      if (payload) c.set('user', payload)
    } catch { /* token is garbage, user stays null, life goes on */ }
  }

  const raw = getCookie(c, FLASH_COOKIE)
  let flash: FlashMessages = { toasts: [] }
  if (raw) {
    try {
      flash = JSON.parse(decodeURIComponent(raw))
    } catch { /* cookie is mangled garbage? cool, don't care, moving on */ }
    deleteCookie(c, FLASH_COOKIE, { path: '/' })
  }
  c.set('flash', flash)
  c.set('pendingFlash', { toasts: [] })

  await next()
}

export function addToast(c: Context<Env>, toast: ToastNotification) {
  const pending = c.get('pendingFlash')
  pending.toasts.push(toast)
}

export function redirectWithFlash(
  c: Context<Env>,
  url: string,
  status: 301 | 302 | 303 | 307 | 308 = 302
) {
  const pending = c.get('pendingFlash')
  if (pending.toasts.length > 0) {
    setCookie(c, FLASH_COOKIE, encodeURIComponent(JSON.stringify(pending)), {
      path: '/',
      httpOnly: true,
      maxAge: 60,
      sameSite: 'Lax',
    })
  }
  return c.redirect(url, status)
}
