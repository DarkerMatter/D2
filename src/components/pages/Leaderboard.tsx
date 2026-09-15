import type { FC } from 'hono/jsx'

type LeaderboardProps = {
  rageLeaders: any[]
  deathLeaders: any[]
  games: any[]
  currentGame?: string
}

export const LeaderboardPage: FC<LeaderboardProps> = ({
  rageLeaders,
  deathLeaders,
  games,
  currentGame,
}) => (
  <div class="leaderboard-container">
    <h2>Leaderboards</h2>
    <p>Top 10 users who have logged at least one death. Congratulations?</p>

    <div
      style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; margin-bottom: 2rem;"
    >
      <a
        href="/leaderboard"
        class={`btn ${!currentGame ? 'btn-primary' : 'btn-secondary'}`}
        style="padding: 0.4rem 1rem; font-size: 0.85rem;"
      >
        All Games
      </a>
      {games.map((game: any) => (
        <a
          href={`/leaderboard?game=${game.slug}`}
          class={`btn ${currentGame === game.slug ? 'btn-primary' : 'btn-secondary'}`}
          style="padding: 0.4rem 1rem; font-size: 0.85rem;"
        >
          {game.name}
        </a>
      ))}
    </div>

    <div class="leaderboard-grid">
      <div class="leaderboard-column">
        <h3>Top 10 by Total Rage</h3>
        <div class="leaderboard-table-container">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Username</th>
                <th>Total Rage</th>
              </tr>
            </thead>
            <tbody>
              {rageLeaders.length > 0 ? (
                rageLeaders.map((user: any, index: number) => (
                  <tr>
                    <td class="rank-cell">#{index + 1}</td>
                    <td>{user.username}</td>
                    <td class="numeric-cell">
                      {Number(user.total_rage).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>No data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div class="leaderboard-column">
        <h3>Top 10 by Total Deaths</h3>
        <div class="leaderboard-table-container">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Username</th>
                <th>Total Deaths</th>
              </tr>
            </thead>
            <tbody>
              {deathLeaders.length > 0 ? (
                deathLeaders.map((user: any, index: number) => (
                  <tr>
                    <td class="rank-cell">#{index + 1}</td>
                    <td>{user.username}</td>
                    <td class="numeric-cell">
                      {Number(user.total_deaths).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>No data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
)
