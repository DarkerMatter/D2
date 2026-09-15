import type { FC } from 'hono/jsx'

export const RegisterPage: FC = () => (
  <div class="form-container auth-form">
    <h2>Register</h2>
    <p>You need a valid invite code to create an account. Know someone on the inside?</p>
    <form action="/register" method="post">
      <div class="form-group">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" required />
      </div>
      <div class="form-group">
        <label for="invite_code">Invite Code</label>
        <input type="text" id="invite_code" name="invite_code" required />
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input
          type="password"
          id="password"
          name="password"
          required
          minLength={8}
        />
        <small>Password must be at least 8 characters.</small>
      </div>
      <button class="btn-primary" type="submit">
        Register
      </button>
    </form>
    <div class="auth-switch">
      <p>
        Already have an account? <a href="/login">Log In</a>
      </p>
    </div>
  </div>
)
