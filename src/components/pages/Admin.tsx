import type { FC } from 'hono/jsx'

type AdminProps = {
  users: any[]
  achievements: any[]
  achievementsByUser: Record<number, Set<number>>
  games: any[]
  appStats: {
    total_users: number
    total_sessions: number
    total_deaths: number
    total_rage: number
  }
  currentUserId: number
}

export const AdminPage: FC<AdminProps> = ({
  users,
  achievements,
  achievementsByUser,
  games,
  appStats,
  currentUserId,
}) => (
  <div class="admin-container">
    <h2>Admin Panel</h2>

    {/* the numbers that tell you how much collective suffering your platform has caused */}
    <div class="admin-section-card">
      <h3>App Stats</h3>
      <div class="metrics-grid">
        <div class="metric-item">
          <h4>Total Users</h4>
          <p class="metric-value large-text">{appStats.total_users}</p>
        </div>
        <div class="metric-item">
          <h4>Total Sessions</h4>
          <p class="metric-value large-text">{appStats.total_sessions}</p>
        </div>
        <div class="metric-item">
          <h4>Total Deaths Logged</h4>
          <p class="metric-value large-text">
            {appStats.total_deaths.toLocaleString()}
          </p>
        </div>
        <div class="metric-item">
          <h4>Total Rage Points</h4>
          <p class="metric-value large-text">
            {appStats.total_rage.toLocaleString()}
          </p>
        </div>
      </div>
    </div>

    {/* add games, disable games, watch people rage at new games */}
    <div class="admin-section-card">
      <h3>Game Management</h3>
      <form
        action="/admin/add-game"
        method="post"
        class="user-creation-form"
        style="margin-bottom: 1.5rem;"
      >
        <div class="form-group">
          <label for="gameName">Name</label>
          <input id="gameName" type="text" name="name" required placeholder="Elden Ring 2" />
        </div>
        <div class="form-group">
          <label for="gameSlug">Slug</label>
          <input id="gameSlug" type="text" name="slug" required placeholder="elden-ring-2" />
        </div>
        <div class="form-group">
          <label for="gameDesc">Snarky Description</label>
          <input id="gameDesc" type="text" name="description" placeholder="Another reason to suffer." />
        </div>
        <div class="form-group">
          <label for="gameIcon">Icon (Bootstrap)</label>
          <input id="gameIcon" type="text" name="icon" placeholder="bi-controller" />
        </div>
        <div class="form-group">
          <label for="gameColor">Color</label>
          <input id="gameColor" type="text" name="color" placeholder="#dc3545" />
        </div>
        <div class="form-group form-button-group">
          <button class="btn-primary" type="submit">Add Game</button>
        </div>
      </form>

      <div class="user-table-container">
        <table class="user-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game: any) => (
              <tr>
                <td style={`color: ${game.color || 'inherit'}`}>{game.name}</td>
                <td style="font-family: monospace;">{game.slug}</td>
                <td>
                  {game.is_active ? (
                    <span class="status-verified">Active</span>
                  ) : (
                    <span class="status-used">Disabled</span>
                  )}
                </td>
                <td>
                  <form action={`/admin/toggle-game/${game.id}`} method="post" style="margin: 0;">
                    <button class="btn-secondary" type="submit" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                      {game.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* the god complex section. ban people, delete people, grant achievements */}
    <div class="admin-section-card">
      <h3>Manage Users</h3>
      <div class="user-table-container">
        <table class="user-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Discord</th>
              <th>Permissions</th>
              <th>Actions</th>
              <th>Manage Achievements</th>
            </tr>
          </thead>
          <tbody>
            {users.map((listUser: any) => (
              <tr>
                <td class="user-username">
                  {listUser.discord_avatar && (
                    <img
                      src={`https://cdn.discordapp.com/avatars/${listUser.discord_username ? '' : ''}${listUser.discord_avatar ? `https://cdn.discordapp.com/avatars/0/${listUser.discord_avatar}.png` : ''}`}
                      alt=""
                      style="width: 24px; height: 24px; border-radius: 50%; vertical-align: middle; margin-right: 0.5rem;"
                    />
                  )}
                  {listUser.username}
                </td>
                <td style="color: var(--text-muted); font-size: 0.85rem;">
                  {listUser.discord_username ? `@${listUser.discord_username}` : '—'}
                </td>
                <td>
                  <form
                    action={`/admin/edit-user/${listUser.id}`}
                    method="post"
                    style="margin: 0;"
                  >
                    <select
                      name="permission_level"
                      onchange="this.form.submit()"
                      disabled={listUser.id === currentUserId}
                    >
                      <option value="0" selected={listUser.permission_level === 0}>Banned</option>
                      <option value="1" selected={listUser.permission_level === 1}>User</option>
                      <option value="5" selected={listUser.permission_level === 5}>Admin</option>
                    </select>
                  </form>
                </td>
                <td>
                  <div class="action-forms">
                    {listUser.id !== currentUserId && (
                      <form
                        action={`/admin/delete-user/${listUser.id}`}
                        method="post"
                        data-confirm={`Are you sure you want to permanently delete "${listUser.username}"? This cannot be undone.`}
                        data-confirm-title="Delete User"
                        style="margin: 0;"
                      >
                        <button class="delete-btn" type="submit">Delete</button>
                      </form>
                    )}
                  </div>
                </td>
                <td>
                  <div class="achievements-management">
                    <form class="achievements-management-form" method="post">
                      <input type="hidden" name="userId" value={listUser.id} />
                      <select name="achievementId" required>
                        {achievements.map((ach: any) => {
                          const hasAch = achievementsByUser[listUser.id] && achievementsByUser[listUser.id].has(ach.id)
                          return (
                            <option value={ach.id}>
                              {ach.name} {hasAch ? '\u2713' : ''}
                            </option>
                          )
                        })}
                      </select>
                      <div class="form-button-group">
                        <button class="btn-achievement grantable" type="submit" formaction="/admin/grant-achievement">Grant</button>
                        <button class="btn-achievement revokable" type="submit" formaction="/admin/revoke-achievement">Revoke</button>
                      </div>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* nuke the cache when the leaderboard is being a liar */}
    <div class="admin-section-card">
      <h3>Cache Management</h3>
      <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
        The leaderboard data is cached for 5 minutes. Purge to force a refresh.
      </p>
      <form action="/admin/purge-cache" method="post">
        <button class="btn-danger" type="submit">Purge Leaderboard Cache</button>
      </form>
    </div>
  </div>
)
