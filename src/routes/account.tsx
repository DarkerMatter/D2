import { Hono } from 'hono'
import type { Env } from '../types'
import { isAuthenticated } from '../middleware/auth'
import { addToast, redirectWithFlash } from '../middleware/flash'
import { hashPassword, verifyPassword } from '../services/auth'
import { grantAchievement } from '../services/achievement'
import { Layout } from '../components/Layout'
import { AccountPage } from '../components/pages/Account'

export const accountRoutes = new Hono<Env>()
accountRoutes.use('*', isAuthenticated)

accountRoutes.get('/', async (c) => {
  const user = c.get('user')!

  const [userRow, avgRage, topPhrase, inviteCodes, lastCode, allAchievements, userAchievements] =
    await Promise.all([
      c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(user.userId)
        .first<any>(),
      c.env.DB.prepare(
        'SELECT AVG(rage_level) as avg FROM rage_logs WHERE user_id = ?'
      )
        .bind(user.userId)
        .first<{ avg: number | null }>(),
      c.env.DB.prepare(
        'SELECT rage_phrase FROM rage_logs WHERE user_id = ? GROUP BY rage_phrase ORDER BY COUNT(*) DESC LIMIT 1'
      )
        .bind(user.userId)
        .first<{ rage_phrase: string }>(),
      c.env.DB.prepare(
        'SELECT code FROM invite_codes WHERE created_by_user_id = ? AND used_by_user_id IS NULL'
      )
        .bind(user.userId)
        .all(),
      c.env.DB.prepare(
        'SELECT created_at FROM invite_codes WHERE created_by_user_id = ? ORDER BY created_at DESC LIMIT 1'
      )
        .bind(user.userId)
        .first<{ created_at: string }>(),
      c.env.DB.prepare(
        'SELECT id, name, description, icon FROM achievements ORDER BY id'
      ).all(),
      c.env.DB.prepare(
        'SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ?'
      )
        .bind(user.userId)
        .all(),
    ])

  if (!userRow) {
    addToast(c, { type: 'error', message: 'User not found.' })
    return redirectWithFlash(c, '/login')
  }

  const stats = {
    total_rage: userRow.total_rage,
    total_deaths: userRow.total_deaths,
    averageRage: avgRage?.avg
      ? parseFloat(String(avgRage.avg)).toFixed(1)
      : 'N/A',
    mostCommonPhrase: topPhrase?.rage_phrase ?? 'N/A',
  }

  let canGenerateCode = false
  if (user.permissionLevel === 5) {
    canGenerateCode = true
  } else if (!lastCode) {
    canGenerateCode = true
  } else {
    const lastDate = new Date(lastCode.created_at)
    const now = new Date()
    if (
      lastDate.getFullYear() < now.getFullYear() ||
      lastDate.getMonth() < now.getMonth()
    ) {
      canGenerateCode = true
    }
  }

  const earnedMap = new Map(
    (userAchievements.results as any[]).map((a: any) => [
      a.achievement_id,
      a.earned_at,
    ])
  )

  return c.html(
    <Layout
      user={c.get('user')}
      flash={c.get('flash')}
      scripts={['/js/charts.js']}
    >
      <AccountPage
        userData={userRow}
        stats={stats}
        inviteCodes={inviteCodes.results as any[]}
        canGenerateCode={canGenerateCode}
        achievements={allAchievements.results as any[]}
        earnedAchievements={earnedMap}
        permissionLevel={user.permissionLevel}
      />
    </Layout>
  )
})

accountRoutes.post('/update-phrases', async (c) => {
  const user = c.get('user')!
  const body = await c.req.parseBody<{
    phrase1: string
    phrase2: string
    phrase3: string
  }>()

  await c.env.DB.prepare(
    'UPDATE users SET quick_phrase_1 = ?, quick_phrase_2 = ?, quick_phrase_3 = ? WHERE id = ?'
  )
    .bind(
      body.phrase1?.trim() || null,
      body.phrase2?.trim() || null,
      body.phrase3?.trim() || null,
      user.userId
    )
    .run()

  addToast(c, { type: 'success', message: 'Your custom phrases have been saved!' })
  return redirectWithFlash(c, '/account')
})

accountRoutes.post('/generate-invite', async (c) => {
  const user = c.get('user')!

  if (user.permissionLevel !== 5) {
    const lastCode = await c.env.DB.prepare(
      'SELECT created_at FROM invite_codes WHERE created_by_user_id = ? ORDER BY created_at DESC LIMIT 1'
    )
      .bind(user.userId)
      .first<{ created_at: string }>()

    if (lastCode) {
      const lastDate = new Date(lastCode.created_at)
      const now = new Date()
      if (
        lastDate.getFullYear() === now.getFullYear() &&
        lastDate.getMonth() === now.getMonth()
      ) {
        addToast(c, {
          type: 'error',
          message:
            'You already generated an invite code this month. Patience, grasshopper.',
        })
        return redirectWithFlash(c, '/account')
      }
    }
  }

  const code = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO invite_codes (code, created_by_user_id) VALUES (?, ?)'
  )
    .bind(code, user.userId)
    .run()

  await grantAchievement(c, user.userId, 6)

  addToast(c, {
    type: 'success',
    message: 'New invite code generated! Spread the misery.',
  })
  return redirectWithFlash(c, '/account')
})

accountRoutes.get('/analytics/rage-progression', async (c) => {
  const user = c.get('user')!

  const result = await c.env.DB.prepare(
    `WITH NumberedDeaths AS (
       SELECT rage_level,
              ROW_NUMBER() OVER(PARTITION BY session_id ORDER BY created_at ASC) as death_number
       FROM rage_logs WHERE user_id = ?
     )
     SELECT death_number, AVG(rage_level) as average_rage
     FROM NumberedDeaths
     GROUP BY death_number
     ORDER BY death_number ASC
     LIMIT 50`
  )
    .bind(user.userId)
    .all()

  return c.json(result.results)
})

accountRoutes.get('/analytics/swear-words', async (c) => {
  const user = c.get('user')!

  const logs = await c.env.DB.prepare(
    'SELECT rage_phrase FROM rage_logs WHERE user_id = ?'
  )
    .bind(user.userId)
    .all()

  const patterns: Record<string, RegExp> = {
    fuck: /\b(fuck(er|ing)?)\b/gi,
    shit: /\b(shit(ty)?)\b/gi,
    bitch: /\b(bitch)\b/gi,
    ass: /\b(ass(hole)?)\b/gi,
    whore: /\b(whore)\b/gi,
    damn: /\b(damn(it)?)\b/gi,
  }

  const counts: Record<string, number> = {}
  for (const key of Object.keys(patterns)) counts[key] = 0

  for (const row of logs.results as any[]) {
    if (!row.rage_phrase) continue
    for (const [word, regex] of Object.entries(patterns)) {
      const matches = row.rage_phrase.match(regex)
      if (matches) counts[word] += matches.length
    }
  }

  const sorted = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .filter((item) => item.count > 0)

  return c.json(sorted)
})

accountRoutes.post('/change-password', async (c) => {
  const user = c.get('user')!
  const body = await c.req.parseBody<{
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }>()

  if (!body.currentPassword || !body.newPassword || !body.confirmPassword) {
    addToast(c, {
      type: 'error',
      message: 'All password fields are required.',
    })
    return redirectWithFlash(c, '/account')
  }
  if (body.newPassword !== body.confirmPassword) {
    addToast(c, { type: 'error', message: 'New passwords do not match.' })
    return redirectWithFlash(c, '/account')
  }
  if (body.newPassword.length < 8) {
    addToast(c, {
      type: 'error',
      message: 'New password must be at least 8 characters.',
    })
    return redirectWithFlash(c, '/account')
  }

  const userRow = await c.env.DB.prepare(
    'SELECT password FROM users WHERE id = ?'
  )
    .bind(user.userId)
    .first<{ password: string }>()

  const valid = await verifyPassword(body.currentPassword, userRow!.password)
  if (!valid) {
    addToast(c, { type: 'error', message: 'Incorrect current password.' })
    return redirectWithFlash(c, '/account')
  }

  const hashed = await hashPassword(body.newPassword)
  await c.env.DB.prepare('UPDATE users SET password = ? WHERE id = ?')
    .bind(hashed, user.userId)
    .run()

  addToast(c, { type: 'success', message: 'Password changed successfully.' })
  return redirectWithFlash(c, '/account')
})

accountRoutes.post('/clear-data', async (c) => {
  const user = c.get('user')!

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(
      user.userId
    ),
    c.env.DB.prepare(
      'UPDATE users SET total_rage = 0, total_deaths = 0 WHERE id = ?'
    ).bind(user.userId),
  ])

  await c.env.CACHE.delete('leaderboard')

  addToast(c, {
    type: 'success',
    message: 'All session data has been nuked. Fresh start!',
  })
  return redirectWithFlash(c, '/account')
})
