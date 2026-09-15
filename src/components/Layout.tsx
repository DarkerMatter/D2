import type { FC, PropsWithChildren } from 'hono/jsx'
import { raw } from 'hono/html'
import type { JWTPayload, FlashMessages } from '../types'

type LayoutProps = PropsWithChildren<{
  title?: string
  user: JWTPayload | null
  flash: FlashMessages
  scripts?: string[]
}>

export const Layout: FC<LayoutProps> = ({
  title,
  user,
  flash,
  scripts,
  children,
}) => {
  const pageTitle = title
    ? `${title} | Rage Tracker`
    : 'FTS.GG | Rage Tracker'

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <title>{pageTitle}</title>
        <link rel="icon" type="image/png" href="/images/logo.png" />
        <link rel="stylesheet" href="/css/base.css" />
        <link rel="stylesheet" href="/css/layout.css" />
        <link rel="stylesheet" href="/css/components.css" />
        <link rel="stylesheet" href="/css/pages.css" />
        <link rel="stylesheet" href="/css/animations.css" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
        />
      </head>
      <body class="loading">
        <div class="loader-wrapper">
          <div class="loader" />
        </div>

        <div class="container">
          <nav>
            <h1>
              <a href="/">Rage Tracker</a>
            </h1>
            <ul>
              <li>
                <a href="/leaderboard">Leaderboard</a>
              </li>
              <li>
                <a
                  href="https://fts.gg/discord"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Discord
                </a>
              </li>
              {user ? (
                <>
                  <li>
                    <a href="/dashboard">Dashboard</a>
                  </li>
                  <li>
                    <a href="/account">Account</a>
                  </li>
                  {user.permissionLevel === 5 && (
                    <li>
                      <a href="/admin">Admin Panel</a>
                    </li>
                  )}
                  <li>
                    <a href="/logout">Logout ({user.username})</a>
                  </li>
                </>
              ) : (
                <li>
                  <a href="/login">Login</a>
                </li>
              )}
            </ul>
          </nav>

          <main>{children}</main>

          <footer>
            <div class="footer-links">
              <a
                href="https://fts.gg/discord"
                target="_blank"
                rel="noopener noreferrer"
              >
                Discord
              </a>
              <span class="separator">|</span>
              <a
                href="https://github.com/DarkerMatter/D2"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </div>
            <p>{raw('&copy;')} 2025 FTSGG LLC</p>
          </footer>
        </div>

        <div id="confirmation-modal" class="modal-overlay hidden">
          <div class="modal-dialog">
            <h3 class="modal-title">Confirmation Required</h3>
            <p class="modal-body">
              Are you sure you want to proceed with this action?
            </p>
            <div class="modal-actions">
              <button class="btn-secondary" id="modal-cancel-btn">
                Cancel
              </button>
              <button class="btn-danger" id="modal-confirm-btn">
                Confirm
              </button>
            </div>
          </div>
        </div>

        <div
          id="toast-container"
          data-flash={JSON.stringify(flash.toasts)}
        />

        <script src="https://cdn.jsdelivr.net/npm/chart.js" />
        <script src="/js/ui.js" />
        {scripts?.map((src) => (
          <script src={src} />
        ))}
      </body>
    </html>
  )
}
