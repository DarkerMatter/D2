const CACHE_KEY = 'leaderboard'
const CACHE_TTL = 300 // 5 minutes before it goes stale. any shorter and the DB cries, any longer and the data lies

export async function getLeaderboardData(
  db: D1Database,
  cache: KVNamespace,
  gameSlug?: string
): Promise<{ rageLeaders: any[]; deathLeaders: any[] }> {
  const cacheKey = gameSlug ? `${CACHE_KEY}:${gameSlug}` : CACHE_KEY

  const cached = await cache.get(cacheKey, 'json')
  if (cached) return cached as any

  let rageStmt: D1PreparedStatement
  let deathStmt: D1PreparedStatement

  if (gameSlug) {
    const query = `
      SELECT u.username, SUM(re.rage_level) AS total_rage, COUNT(re.id) AS total_deaths
      FROM users u
      JOIN rage_logs re ON u.id = re.user_id
      JOIN sessions s ON re.session_id = s.id
      JOIN games g ON s.game_id = g.id
      WHERE g.slug = ?
      GROUP BY u.id, u.username
      HAVING COUNT(re.id) > 0
    `
    rageStmt = db
      .prepare(`${query} ORDER BY total_rage DESC LIMIT 10`)
      .bind(gameSlug)
    deathStmt = db
      .prepare(`${query} ORDER BY total_deaths DESC LIMIT 10`)
      .bind(gameSlug)
  } else {
    const query = `
      SELECT u.username, SUM(re.rage_level) AS total_rage, COUNT(re.id) AS total_deaths
      FROM users u
      JOIN rage_logs re ON u.id = re.user_id
      GROUP BY u.id, u.username
      HAVING COUNT(re.id) > 0
    `
    rageStmt = db.prepare(`${query} ORDER BY total_rage DESC LIMIT 10`)
    deathStmt = db.prepare(`${query} ORDER BY total_deaths DESC LIMIT 10`)
  }

  const [rageResult, deathResult] = await Promise.all([
    rageStmt.all(),
    deathStmt.all(),
  ])

  const data = {
    rageLeaders: rageResult.results,
    deathLeaders: deathResult.results,
  }

  await cache.put(cacheKey, JSON.stringify(data), { expirationTtl: CACHE_TTL })

  return data
}
