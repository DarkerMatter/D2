import type { FC } from 'hono/jsx'
import { raw } from 'hono/html'

type DashboardProps = {
  sessions: any[]
  games: any[]
  currentPage: number
  totalPages: number
}

export const DashboardPage: FC<DashboardProps> = ({
  sessions,
  games,
  currentPage,
  totalPages,
}) => (
  <div class="dashboard-container">
    <div class="admin-section-card session-creation-form">
      <h3>Start a New Session</h3>
      <form action="/dashboard/sessions" method="post">
        <div class="form-group">
          <label for="sessionName">Session Name</label>
          <input
            id="sessionName"
            type="text"
            name="sessionName"
            placeholder="e.g., 'Late Night Comp'"
            required
          />
        </div>
        <div class="form-group">
          <label for="gameId">Game</label>
          <select id="gameId" name="gameId" required>
            {games.map((game: any) => (
              <option value={game.id}>{game.name}</option>
            ))}
          </select>
        </div>
        <div class="form-group submit-container">
          <button class="btn-primary" type="submit">
            Create Session
          </button>
        </div>
      </form>
    </div>

    <h2>Your Sessions</h2>

    {sessions && sessions.length > 0 ? (
      sessions.map((session: any) => (
        <a class="session-item" href={`/session/${session.id}`}>
          <div class="session-info">
            <span class="session-name">{session.name}</span>
            <span class="session-date" data-timestamp={session.created_at} />
          </div>
          <div class="session-meta">
            {session.game_name && (
              <span
                style={`color: ${session.game_color || 'var(--text-secondary)'}; font-size: 0.85rem; font-weight: 500;`}
              >
                {session.game_name}
              </span>
            )}
            {session.is_active ? (
              <span class="status-verified">Active</span>
            ) : (
              <span class="status-used">Inactive</span>
            )}
            <span class="session-deaths">{session.death_count} deaths</span>
          </div>
        </a>
      ))
    ) : (
      <p>You haven't created any sessions yet. Start one above!</p>
    )}

    {totalPages > 1 && (
      <div class="pagination">
        {currentPage > 1 ? (
          <a href={`/dashboard?page=${currentPage - 1}`}>
            {raw('&laquo;')} Prev
          </a>
        ) : (
          <span class="disabled">{raw('&laquo;')} Prev</span>
        )}

        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) =>
          page === currentPage ? (
            <span class="active">{page}</span>
          ) : (
            <a href={`/dashboard?page=${page}`}>{page}</a>
          )
        )}

        {currentPage < totalPages ? (
          <a href={`/dashboard?page=${currentPage + 1}`}>
            Next {raw('&raquo;')}
          </a>
        ) : (
          <span class="disabled">Next {raw('&raquo;')}</span>
        )}
      </div>
    )}
  </div>
)
