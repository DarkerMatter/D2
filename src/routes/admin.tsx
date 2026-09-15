import { Hono } from 'hono'
import type { Env } from '../types'
import { isAuthenticated, isAdmin } from '../middleware/auth'
import { addToast, redirectWithFlash } from '../middleware/flash'
import { Layout } from '../components/Layout'
import { AdminPage } from '../components/pages/Admin'

export const adminRoutes = new Hono<Env>()
adminRoutes.use('*', isAuthenticated, isAdmin)

adminRoutes.get('/', async (c) => {
  const [users, allAchievements, allUserAchievements, games, appStats] =
    await Promise.all([
      c.env.DB.prepare(
        'SELECT id, username, discord_username, discord_avatar, permission_level FROM users ORDER BY id DESC'
      ).all(),
      c.env.DB.prepare('SELECT id, name FROM achievements ORDER BY id').all(),
      c.env.DB.prepare(
        'SELECT user_id, achievement_id FROM user_achievements'
      ).all(),
      c.env.DB.prepare(
        'SELECT id, name, slug, is_active, color FROM games ORDER BY id'
      ).all(),
      c.env.DB.prepare(
        `SELECT
           (SELECT COUNT(*) FROM users) as total_users,
           (SELECT COUNT(*) FROM sessions) as total_sessions,
           (SELECT COUNT(*) FROM rage_logs) as total_deaths,
           (SELECT COALESCE(SUM(rage_level), 0) FROM rage_logs) as total_rage`
      ).first(),
    ])

  const achievementsByUser: Record<number, Set<number>> = {}
  for (const ua of allUserAchievements.results as any[]) {
    if (!achievementsByUser[ua.user_id])
      achievementsByUser[ua.user_id] = new Set()
    achievementsByUser[ua.user_id].add(ua.achievement_id)
  }

  return c.html(
    <Layout user={c.get('user')} flash={c.get('flash')}>
      <AdminPage
        users={users.results as any[]}
        achievements={allAchievements.results as any[]}
        achievementsByUser={achievementsByUser}
        games={games.results as any[]}
        appStats={appStats as any}
        currentUserId={c.get('user')!.userId}
      />
    </Layout>
  )
})

adminRoutes.post('/grant-achievement', async (c) => {
  const body = await c.req.parseBody<{ userId: string; achievementId: string }>()
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)'
  ).bind(parseInt(body.userId, 10), parseInt(body.achievementId, 10)).run()
  addToast(c, { type: 'success', message: 'Achievement granted.' })
  return redirectWithFlash(c, '/admin')
})

adminRoutes.post('/revoke-achievement', async (c) => {
  const body = await c.req.parseBody<{ userId: string; achievementId: string }>()
  await c.env.DB.prepare(
    'DELETE FROM user_achievements WHERE user_id = ? AND achievement_id = ?'
  ).bind(parseInt(body.userId, 10), parseInt(body.achievementId, 10)).run()
  addToast(c, { type: 'success', message: 'Achievement revoked.' })
  return redirectWithFlash(c, '/admin')
})

adminRoutes.post('/purge-cache', async (c) => {
  await c.env.CACHE.delete('leaderboard')
  addToast(c, { type: 'success', message: 'Cache has been purged.' })
  return redirectWithFlash(c, '/admin')
})

adminRoutes.post('/edit-user/:id', async (c) => {
  const userIdToEdit = parseInt(c.req.param('id'), 10)
  const user = c.get('user')!
  const body = await c.req.parseBody<{ permission_level: string }>()
  const permLevel = parseInt(body.permission_level, 10)

  if (userIdToEdit === user.userId) {
    addToast(c, { type: 'error', message: 'You cannot change your own permission level.' })
    return redirectWithFlash(c, '/admin')
  }
  if (![0, 1, 5].includes(permLevel)) {
    addToast(c, { type: 'error', message: 'Invalid permission level.' })
    return redirectWithFlash(c, '/admin')
  }

  await c.env.DB.prepare('UPDATE users SET permission_level = ? WHERE id = ?')
    .bind(permLevel, userIdToEdit).run()
  addToast(c, { type: 'success', message: 'User permissions updated.' })
  return redirectWithFlash(c, '/admin')
})

adminRoutes.post('/delete-user/:id', async (c) => {
  const userIdToDelete = parseInt(c.req.param('id'), 10)
  const user = c.get('user')!

  if (userIdToDelete === user.userId) {
    addToast(c, { type: 'error', message: 'You cannot delete yourself. Nice try though.' })
    return redirectWithFlash(c, '/admin')
  }

  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userIdToDelete).run()
  addToast(c, { type: 'success', message: 'User has been deleted.' })
  return redirectWithFlash(c, '/admin')
})

adminRoutes.post('/add-game', async (c) => {
  const body = await c.req.parseBody<{
    name: string; slug: string; description: string; icon: string; color: string
  }>()
  const name = body.name?.trim()
  const slug = body.slug?.trim()

  if (!name || !slug) {
    addToast(c, { type: 'error', message: 'Game name and slug are required.' })
    return redirectWithFlash(c, '/admin')
  }

  await c.env.DB.prepare(
    'INSERT INTO games (slug, name, description, icon, color) VALUES (?, ?, ?, ?, ?)'
  ).bind(slug, name, body.description?.trim() || null, body.icon?.trim() || 'bi-controller', body.color?.trim() || '#0070f3').run()

  addToast(c, { type: 'success', message: `Game "${name}" added.` })
  return redirectWithFlash(c, '/admin')
})

adminRoutes.post('/toggle-game/:id', async (c) => {
  const gameId = parseInt(c.req.param('id'), 10)
  await c.env.DB.prepare(
    'UPDATE games SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?'
  ).bind(gameId).run()
  addToast(c, { type: 'success', message: 'Game status updated.' })
  return redirectWithFlash(c, '/admin')
})
