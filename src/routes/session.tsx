import { Hono } from 'hono'
import type { Env } from '../types'
import { isAuthenticated } from '../middleware/auth'
import { addToast, redirectWithFlash } from '../middleware/flash'
import { Layout } from '../components/Layout'
import { SessionPage } from '../components/pages/Session'
import { checkAllAchievementsOnSessionEnd } from '../services/achievement'

export const sessionRoutes = new Hono<Env>()
sessionRoutes.use('*', isAuthenticated)

sessionRoutes.get('/:id', async (c) => {
  const user = c.get('user')!
  const sessionId = parseInt(c.req.param('id'), 10)

  const session = await c.env.DB.prepare(
    `SELECT s.*, g.name as game_name, g.color as game_color
     FROM sessions s JOIN games g ON s.game_id = g.id
     WHERE s.id = ? AND s.user_id = ?`
  )
    .bind(sessionId, user.userId)
    .first()

  if (!session) {
    addToast(c, { type: 'error', message: 'Session not found.' })
    return redirectWithFlash(c, '/dashboard')
  }

  const logs = await c.env.DB.prepare(
    'SELECT * FROM rage_logs WHERE session_id = ? ORDER BY created_at ASC'
  )
    .bind(sessionId)
    .all()

  const userRow = await c.env.DB.prepare(
    'SELECT quick_phrase_1, quick_phrase_2, quick_phrase_3 FROM users WHERE id = ?'
  )
    .bind(user.userId)
    .first<any>()

  const customPhrases = [
    userRow?.quick_phrase_1,
    userRow?.quick_phrase_2,
    userRow?.quick_phrase_3,
  ].filter(Boolean) as string[]

  const logResults = logs.results as any[]
  let totalRage = 0
  const phraseCounts: Record<string, number> = {}
  for (const log of logResults) {
    totalRage += log.rage_level
    phraseCounts[log.rage_phrase] = (phraseCounts[log.rage_phrase] || 0) + 1
  }
  const totalDeaths = logResults.length
  const averageRage =
    totalDeaths > 0 ? (totalRage / totalDeaths).toFixed(1) : '0.0'
  const mostCommonPhrase =
    Object.keys(phraseCounts).length > 0
      ? Object.entries(phraseCounts).sort(([, a], [, b]) => b - a)[0][0]
      : 'N/A'

  return c.html(
    <Layout
      user={c.get('user')}
      flash={c.get('flash')}
      scripts={['/js/session.js']}
    >
      <SessionPage
        session={session}
        logs={logResults}
        stats={{ totalRage, totalDeaths, averageRage, mostCommonPhrase }}
        customPhrases={customPhrases}
      />
    </Layout>
  )
})

sessionRoutes.post('/:id/log-death', async (c) => {
  const user = c.get('user')!
  const sessionId = parseInt(c.req.param('id'), 10)
  const body = await c.req.parseBody<{
    rageLevel: string
    ragePhrase: string
  }>()
  const rageLevel = parseInt(body.rageLevel, 10)
  const ragePhrase = body.ragePhrase

  const session = await c.env.DB.prepare(
    'SELECT id FROM sessions WHERE id = ? AND user_id = ? AND is_active = 1'
  )
    .bind(sessionId, user.userId)
    .first()

  if (!session) {
    addToast(c, {
      type: 'error',
      message: 'Session not found or already closed.',
    })
    return redirectWithFlash(c, '/dashboard')
  }

  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO rage_logs (session_id, user_id, rage_level, rage_phrase) VALUES (?, ?, ?, ?)'
    ).bind(sessionId, user.userId, rageLevel, ragePhrase),
    c.env.DB.prepare(
      'UPDATE users SET total_rage = total_rage + ?, total_deaths = total_deaths + 1 WHERE id = ?'
    ).bind(rageLevel, user.userId),
  ])

  await c.env.CACHE.delete('leaderboard')

  addToast(c, { type: 'success', message: 'Death logged. The suffering continues.' })
  return redirectWithFlash(c, `/session/${sessionId}`)
})

sessionRoutes.post('/:id/end', async (c) => {
  const user = c.get('user')!
  const sessionId = parseInt(c.req.param('id'), 10)

  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ? AND user_id = ?'
  )
    .bind(sessionId, user.userId)
    .first()

  if (!session) {
    addToast(c, { type: 'error', message: 'Session could not be ended.' })
    return redirectWithFlash(c, '/dashboard')
  }

  await c.env.DB.prepare(
    "UPDATE sessions SET is_active = 0, ended_at = datetime('now') WHERE id = ?"
  )
    .bind(sessionId)
    .run()

  const updatedSession = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE id = ?'
  )
    .bind(sessionId)
    .first()

  await checkAllAchievementsOnSessionEnd(c, user.userId, updatedSession)

  addToast(c, {
    type: 'success',
    message: `Session "${(session as any).name}" has been closed.`,
  })
  return redirectWithFlash(c, '/dashboard')
})

sessionRoutes.post('/:id/delete', async (c) => {
  const user = c.get('user')!
  const sessionId = parseInt(c.req.param('id'), 10)

  const session = await c.env.DB.prepare(
    'SELECT id FROM sessions WHERE id = ? AND user_id = ?'
  )
    .bind(sessionId, user.userId)
    .first()

  if (!session) {
    addToast(c, { type: 'error', message: 'Session not found.' })
    return redirectWithFlash(c, '/dashboard')
  }

  const logStats = await c.env.DB.prepare(
    'SELECT COALESCE(SUM(rage_level), 0) as total_rage, COUNT(*) as total_deaths FROM rage_logs WHERE session_id = ?'
  )
    .bind(sessionId)
    .first<{ total_rage: number; total_deaths: number }>()

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId),
    c.env.DB.prepare(
      'UPDATE users SET total_rage = total_rage - ?, total_deaths = total_deaths - ? WHERE id = ?'
    ).bind(logStats!.total_rage, logStats!.total_deaths, user.userId),
  ])

  await c.env.CACHE.delete('leaderboard')

  addToast(c, {
    type: 'success',
    message: 'Session and all its data have been obliterated.',
  })
  return redirectWithFlash(c, '/dashboard')
})
