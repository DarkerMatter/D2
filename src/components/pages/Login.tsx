import type { FC } from 'hono/jsx'

export const LoginPage: FC = () => (
  <div class="form-container auth-form">
    <h2>Login</h2>
    <p style="color: var(--text-secondary); margin-bottom: 2rem;">
      Sign in with Discord to continue your descent into madness.
    </p>
    <a href="/auth/discord" class="btn btn-discord" style="width: 100%;">
      <i class="bi bi-discord" /> Continue with Discord
    </a>
  </div>
)
