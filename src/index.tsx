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

// this runs on EVERY request. yes, EVERY one. move it and enjoy your 3 hour debugging session
app.use('*', flashMiddleware)

// home page goes BEFORE route mounting or the auth routes eat it alive. ask me how i know.
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

// mount all the routes. order matters here and i found out the hard way at 2am
app.route('/', authRoutes)
app.route('/dashboard', dashboardRoutes)
app.route('/session', sessionRoutes)
app.route('/account', accountRoutes)
app.route('/admin', adminRoutes)
app.route('/leaderboard', leaderboardRoutes)

// congrats you found a page that doesn't exist. honestly same.
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

// when everything goes to hell, this catches the pieces. somehow.
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
