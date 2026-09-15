import type { Context } from 'hono'
import type { Env } from '../types'
import { addToast } from '../middleware/flash'

async function hasAchievement(
  db: D1Database,
  userId: number,
  achievementId: number
): Promise<boolean> {
  const row = await db
    .prepare(
      'SELECT 1 FROM user_achievements WHERE user_id = ? AND achievement_id = ?'
    )
    .bind(userId, achievementId)
    .first()
  return !!row
}

export async function grantAchievement(
  c: Context<Env>,
  userId: number,
  achievementId: number
) {
  if (await hasAchievement(c.env.DB, userId, achievementId)) return

  const achievement = await c.env.DB.prepare(
    'SELECT name, description, icon FROM achievements WHERE id = ?'
  )
    .bind(achievementId)
    .first<{ name: string; description: string; icon: string }>()

  if (!achievement) return

  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)'
  )
    .bind(userId, achievementId)
    .run()

  addToast(c, {
    type: 'achievement',
    name: achievement.name,
    description: achievement.description,
    icon: achievement.icon,
  })
}

export async function checkAllAchievementsOnSessionEnd(
  c: Context<Env>,
  userId: number,
  session: any
) {
  const db = c.env.DB

  const sessionLogs = await db
    .prepare(
      'SELECT rage_level, rage_phrase, created_at FROM rage_logs WHERE session_id = ? ORDER BY created_at ASC'
    )
    .bind(session.id)
    .all()
  const logs = sessionLogs.results as any[]

  const userStats = await db
    .prepare('SELECT total_deaths, total_rage FROM users WHERE id = ?')
    .bind(userId)
    .first<{ total_deaths: number; total_rage: number }>()
  if (!userStats) return

  const deathCount = logs.length
  const firstDeath = deathCount > 0 ? logs[0] : null
  const sessionStart = new Date(session.created_at)
  const sessionEnd = new Date(session.ended_at)

  // --- Achievements requiring deaths ---
  if (deathCount > 0) {
    if (logs.some((l: any) => l.rage_level === 10)) {
      await grantAchievement(c, userId, 2) // Maximum Over-Rage
    }
    if (logs.some((l: any) => new Date(l.created_at).getDay() === 0)) {
      await grantAchievement(c, userId, 4) // The Cycle of Pain
    }
    const timeDiff =
      (new Date(firstDeath.created_at).getTime() - sessionStart.getTime()) /
      1000
    if (timeDiff <= 62) {
      await grantAchievement(c, userId, 8) // Speed Run
    }
    if (
      logs.some((l: any) => {
        const hour = new Date(l.created_at).getHours()
        return hour >= 1 && hour < 4
      })
    ) {
      await grantAchievement(c, userId, 11) // Night Owl
    }
    if (deathCount >= 3) {
      const uniquePhrases = new Set(logs.map((l: any) => l.rage_phrase))
      if (uniquePhrases.size === 1) {
        await grantAchievement(c, userId, 12) // The Specialist
      }
    }
    const durationAfterFirst =
      (sessionEnd.getTime() - new Date(firstDeath.created_at).getTime()) /
      (1000 * 60)
    if (durationAfterFirst <= 5) {
      await grantAchievement(c, userId, 13) // Rage Quit
    }
    const offensiveRegex =
      /\b(fuck(er|ing)?|shit(ty)?|bitch|ass(hole)?|whore|damn(it)?)\b/i
    if (logs.some((l: any) => offensiveRegex.test(l.rage_phrase))) {
      await grantAchievement(c, userId, 15) // Tilted
    }
  }

  // --- Zero-death achievements ---
  if (deathCount === 0) {
    await grantAchievement(c, userId, 5) // Flawless Victory
    const sessionHours =
      (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60)
    if (sessionHours > 1) {
      await grantAchievement(c, userId, 14) // The Pacifist
    }
  }

  if (deathCount > 20) {
    await grantAchievement(c, userId, 9) // Marathon of Misery
  }

  // --- Aggregate achievements ---
  if (deathCount > 0 && userStats.total_deaths === deathCount) {
    await grantAchievement(c, userId, 1) // First Blood
  }
  if (userStats.total_deaths >= 100) {
    await grantAchievement(c, userId, 3) // Centurion
  }

  const phraseCount = await db
    .prepare(
      'SELECT COUNT(DISTINCT rage_phrase) as cnt FROM rage_logs WHERE user_id = ?'
    )
    .bind(userId)
    .first<{ cnt: number }>()
  if (phraseCount && phraseCount.cnt >= 5) {
    await grantAchievement(c, userId, 7) // Wordsmith of Fury
  }

  if (userStats.total_rage >= 1000) {
    await grantAchievement(c, userId, 10) // The Collector
  }
}
