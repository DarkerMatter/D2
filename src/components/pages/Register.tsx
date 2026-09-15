import type { FC } from 'hono/jsx'

export const RegisterPage: FC = () => (
  <div class="form-container auth-form">
    <h2>Register</h2>
    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
      You need a valid invite code to join. Know someone on the inside? Good luck.
    </p>
    <form action="/auth/discord" method="post">
      <div class="form-group">
        <label for="invite_code">Invite Code</label>
        <input
          type="text"
          id="invite_code"
          name="invite_code"
          required
          placeholder="Paste your invite code"
        />
      </div>
      <button class="btn btn-discord" type="submit" style="width: 100%;">
        <i class="bi bi-discord" /> Register with Discord
      </button>
    </form>
    <div class="auth-switch">
      <p>
        Already have an account? <a href="/login">Log In</a>
      </p>
    </div>
  </div>
)
