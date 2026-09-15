import { Hono } from 'hono'
import type { Env } from '../types'
import { isAuthenticated } from '../middleware/auth'
import { addToast, redirectWithFlash } from '../middleware/flash'
import { Layout } from '../components/Layout'
import { DashboardPage } from '../components/pages/Dashboard'

export const dashboardRoutes = new Hono<Env>()
dashboardRoutes.use('*', isAuthenticated)

dashboardRoutes.get('/', async (c) => {
  const user = c.get('user')!
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const perPage = 10
  const offset = (page - 1) * perPage

  const countResult = await c.env.DB.prepare(
    'SELECT COUNT(*) as total FROM sessions WHERE user_id = ?'
  )
    .bind(user.userId)
    .first<{ total: number }>()
  const totalSessions = countResult?.total || 0
  const totalPages = Math.ceil(totalSessions / perPage)

  const sessions = await c.env.DB.prepare(
    `SELECT s.id, s.name, s.created_at, s.is_active, s.game_id,
            g.name as game_name, g.color as game_color, g.icon as game_icon,
            COUNT(rl.id) as death_count
     FROM sessions s
     LEFT JOIN rage_logs rl ON s.id = rl.session_id
     LEFT JOIN games g ON s.game_id = g.id
     WHERE s.user_id = ?
     GROUP BY s.id
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(user.userId, perPage, offset)
    .all()

  const games = await c.env.DB.prepare(
    'SELECT id, name, slug FROM games WHERE is_active = 1 ORDER BY name'
  ).all()

  return c.html(
    <Layout user={c.get('user')} flash={c.get('flash')}>
      <DashboardPage
        sessions={sessions.results}
        games={games.results}
        currentPage={page}
        totalPages={totalPages}
      />
    </Layout>
  )
})

dashboardRoutes.post('/sessions', async (c) => {
  const user = c.get('user')!
  const body = await c.req.parseBody<{ sessionName: string; gameId: string }>()
  const sessionName = body.sessionName?.trim()
  const gameId = parseInt(body.gameId, 10) || 1

  if (!sessionName) {
    addToast(c, { type: 'error', message: 'Session name cannot be empty.' })
    return redirectWithFlash(c, '/dashboard')
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO sessions (user_id, game_id, name) VALUES (?, ?, ?)'
  )
    .bind(user.userId, gameId, sessionName)
    .run()

  return c.redirect(`/session/${result.meta.last_row_id}`)
})
