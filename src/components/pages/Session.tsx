import type { FC } from 'hono/jsx'

type SessionProps = {
  session: any
  logs: any[]
  stats: {
    totalRage: number
    totalDeaths: number
    averageRage: string
    mostCommonPhrase: string
  }
  customPhrases: string[]
}

export const SessionPage: FC<SessionProps> = ({
  session,
  logs,
  stats,
  customPhrases,
}) => (
  <div class="session-container">
    <div id="session-title">
      <h2 id="session-name-display">{session.name}</h2>
      {session.is_active ? (
        <span class="status-badge status-verified">Active</span>
      ) : (
        <span class="status-badge status-used">Inactive</span>
      )}
      {session.game_name && (
        <span
          style={`font-size: 0.85rem; color: ${session.game_color || 'var(--text-secondary)'}; font-weight: 500;`}
        >
          {session.game_name}
        </span>
      )}
    </div>
    <div id="session-date-container">
      <span id="session-date-display" data-timestamp={session.created_at} />
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <h3>Session Total Rage</h3>
        <p class="rage-score">{stats.totalRage}</p>
      </div>
      <div class="stat-card">
        <h3>Deaths This Session</h3>
        <p class="rage-score">{stats.totalDeaths}</p>
      </div>
      <div class="stat-card">
        <h3>Session Avg. Rage</h3>
        <p class="stat-value">{stats.averageRage}</p>
      </div>
      <div class="stat-card">
        <h3>Session Go-To Phrase</h3>
        <p class="stat-value">{stats.mostCommonPhrase}</p>
      </div>
    </div>

    {session.is_active ? (
      <div class="admin-section-card">
        <h3>Log a New Death</h3>
        <form
          class="log-death-form"
          action={`/session/${session.id}/log-death`}
          method="post"
        >
          <div class="form-group">
            <label>Rage Level (1-10)</label>
            <div class="rage-slider-container">
              <input
                id="rageSlider"
                type="range"
                min="1"
                max="10"
                value="5"
              />
              <span id="rageValue">5</span>
            </div>
            <input type="hidden" name="rageLevel" value="5" required />
          </div>

          <div class="form-group">
            <label>Rage Phrase</label>
            {customPhrases.length > 0 ? (
              <div class="choice-grid quick-phrase-grid">
                {customPhrases.map((phrase) => (
                  <button class="choice-btn quick-phrase" type="button">
                    {phrase}
                  </button>
                ))}
              </div>
            ) : (
              <div class="quick-phrase-prompt">
                <p>
                  You haven't set any custom quick phrases yet.{' '}
                  <a href="/account">Create some here</a> for faster logging!
                </p>
              </div>
            )}
            <input
              id="ragePhraseInput"
              type="text"
              name="ragePhrase"
              placeholder="Select a quick phrase or type your own"
              required
            />
          </div>

          <div class="form-group form-button-group">
            <button class="btn-rage" type="submit">
              Log Death
            </button>
          </div>
        </form>
      </div>
    ) : null}

    <div class="admin-section-card">
      <h3>Session Logs</h3>
      {logs.length > 0 ? (
        <div class="user-table-container">
          <table class="user-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Rage Level</th>
                <th>Rage Phrase</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr>
                  <td data-timestamp={log.created_at} />
                  <td>{log.rage_level}</td>
                  <td>{log.rage_phrase}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No deaths have been logged for this session yet.</p>
      )}
    </div>

    <div class="session-actions">
      <a class="btn btn-secondary" href="/dashboard">
        Return to Dashboard
      </a>
      {session.is_active ? (
        <form
          action={`/session/${session.id}/end`}
          method="post"
          data-confirm={`Are you sure you want to end "${session.name}"? This will calculate your final achievements.`}
          data-confirm-title="End Session"
        >
          <button class="btn btn-primary" type="submit">
            End Session & Check Achievements
          </button>
        </form>
      ) : null}
      <form
        action={`/session/${session.id}/delete`}
        method="post"
        data-confirm={`Are you sure you want to permanently delete "${session.name}" and all its logs? This cannot be undone.`}
        data-confirm-title="Delete Session"
      >
        <button class="btn btn-danger" type="submit">
          Delete Session
        </button>
      </form>
    </div>
  </div>
)
