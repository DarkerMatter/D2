import type { MiddlewareHandler, Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Env, ToastNotification, FlashMessages } from '../types'

const FLASH_COOKIE = '__flash'

export const flashMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  c.set('user', null)

  const raw = getCookie(c, FLASH_COOKIE)
  let flash: FlashMessages = { toasts: [] }
  if (raw) {
    try {
      flash = JSON.parse(decodeURIComponent(raw))
    } catch { /* ignore malformed cookie */ }
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
