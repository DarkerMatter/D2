import type { FC } from 'hono/jsx'
import type { JWTPayload } from '../../types'

type HomeProps = {
  topRager: any
  games: any[]
  user: JWTPayload | null
}

export const HomePage: FC<HomeProps> = ({ topRager, games, user }) => (
  <div class="home-container">
    <div class="hero-section">
      <h2>Track Your Descent into Madness</h2>
      <p class="subtitle">
        A no-nonsense tool for quantifying your rage across every game that
        makes you question your life choices. Pick a game, start a session, and
        watch the numbers climb.
      </p>

      {topRager && (
        <div class="top-rager-spotlight">
          <h3>Current Rage Champion</h3>
          <p class="champion-name">{topRager.username}</p>
          <p class="champion-stats">
            with a staggering {Number(topRager.total_rage).toLocaleString()}{' '}
            total rage points.
          </p>
        </div>
      )}

      {games && games.length > 0 && (
        <div class="games-showcase" style="margin-top: 3rem;">
          <p
            style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;"
          >
            Currently Tracking
          </p>
          <div
            style="display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem;"
          >
            {games.map((game: any) => (
              <span
                style={`display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border: 1px solid ${game.color || 'var(--border-color)'}; border-radius: 20px; font-size: 0.9rem; color: ${game.color || 'var(--text-color)'};`}
              >
                <i class={`bi ${game.icon}`} />
                {game.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div class="cta-buttons" style="margin-top: 2.5rem;">
        {user ? (
          <a href="/dashboard" class="btn btn-primary">
            Go to Dashboard
          </a>
        ) : (
          <a href="/login" class="btn btn-primary">
            Get Started
          </a>
        )}
      </div>
    </div>
  </div>
)
