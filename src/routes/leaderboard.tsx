import { Hono } from 'hono'
import type { Env } from '../types'
import { getLeaderboardData } from '../services/leaderboard'
import { Layout } from '../components/Layout'
import { LeaderboardPage } from '../components/pages/Leaderboard'

export const leaderboardRoutes = new Hono<Env>()

leaderboardRoutes.get('/', async (c) => {
  const gameSlug = c.req.query('game')
  const { rageLeaders, deathLeaders } = await getLeaderboardData(
    c.env.DB,
    c.env.CACHE,
    gameSlug
  )

  const games = await c.env.DB.prepare(
    'SELECT slug, name FROM games WHERE is_active = 1 ORDER BY name'
  ).all()

  return c.html(
    <Layout user={c.get('user')} flash={c.get('flash')}>
      <LeaderboardPage
        rageLeaders={rageLeaders}
        deathLeaders={deathLeaders}
        games={games.results as any[]}
        currentGame={gameSlug}
      />
    </Layout>
  )
})
