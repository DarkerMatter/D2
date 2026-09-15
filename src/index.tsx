import { Hono } from 'hono'
import type { Env } from './types'
import { flashMiddleware } from './middleware/flash'
import { authRoutes } from './routes/auth'
import { dashboardRoutes } from './routes/dashboard'
import { sessionRoutes } from './routes/session'
import { accountRoutes } from './routes/account'
import { adminRoutes } from './routes/admin'
import { leaderboardRoutes } from './routes/leaderboard'
import { getLeaderboardData } from './services/leaderboard'
import { Layout } from './components/Layout'
import { HomePage } from './components/pages/Home'
import { ErrorPage } from './components/pages/Error'

const app = new Hono<Env>()

// Flash middleware on all routes (also sets default user to null)
app.use('*', flashMiddleware)

// Home page
app.get('/', async (c) => {
  const { rageLeaders } = await getLeaderboardData(c.env.DB, c.env.CACHE)
  const topRager = rageLeaders.length > 0 ? rageLeaders[0] : null

  const games = await c.env.DB.prepare(
    'SELECT id, name, slug, icon, color FROM games WHERE is_active = 1 ORDER BY name'
  ).all()

  return c.html(
    <Layout user={c.get('user')} flash={c.get('flash')}>
      <HomePage
        topRager={topRager}
        games={games.results}
        user={c.get('user')}
      />
    </Layout>
  )
})

// Mount route groups
app.route('/', authRoutes)
app.route('/dashboard', dashboardRoutes)
app.route('/session', sessionRoutes)
app.route('/account', accountRoutes)
app.route('/admin', adminRoutes)
app.route('/leaderboard', leaderboardRoutes)

// 404
app.notFound((c) => {
  return c.html(
    <Layout
      user={c.get('user') ?? null}
      flash={c.get('flash') ?? { toasts: [] }}
    >
      <ErrorPage
        title="Page Not Found"
        message="Sorry, we couldn't find that page. Maybe it rage-quit too."
      />
    </Layout>,
    404
  )
})

// Global error handler
app.onError((err, c) => {
  console.error('Error:', err)
  return c.html(
    <Layout
      user={c.get('user') ?? null}
      flash={c.get('flash') ?? { toasts: [] }}
    >
      <ErrorPage
        title="Server Error"
        message="Something broke on our end. We're probably more upset about it than you are."
      />
    </Layout>,
    500
  )
})

export default app
