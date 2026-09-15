import type { FC } from 'hono/jsx'

type ErrorProps = {
  title: string
  message: string
}

export const ErrorPage: FC<ErrorProps> = ({ title, message }) => (
  <div class="home-container">
    <div class="hero-section">
      <h2>{title}</h2>
      <p class="subtitle">{message}</p>
      <div class="cta-buttons">
        <a href="/" class="btn btn-primary">
          Go to Home
        </a>
      </div>
    </div>
  </div>
)
