import type { FC } from 'hono/jsx'

type AccountProps = {
  userData: any
  stats: {
    total_rage: number
    total_deaths: number
    averageRage: string
    mostCommonPhrase: string
  }
  inviteCodes: any[]
  canGenerateCode: boolean
  achievements: any[]
  earnedAchievements: Map<number, string>
  permissionLevel: number
}

export const AccountPage: FC<AccountProps> = ({
  userData,
  stats,
  inviteCodes,
  canGenerateCode,
  achievements,
  earnedAchievements,
  permissionLevel,
}) => (
  <>
    <h2>Account Settings</h2>

    <div class="dashboard-container">
      <h3>Lifetime Analytics</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Lifetime Rage</h3>
          <p class="rage-score">{stats.total_rage.toLocaleString()}</p>
        </div>
        <div class="stat-card">
          <h3>Total Lifetime Deaths</h3>
          <p class="rage-score">{stats.total_deaths.toLocaleString()}</p>
        </div>
        <div class="stat-card">
          <h3>Lifetime Avg. Rage</h3>
          <p class="rage-score">{stats.averageRage}</p>
        </div>
        <div class="stat-card">
          <h3>Lifetime Go-To Phrase</h3>
          <p class="stat-value">{stats.mostCommonPhrase}</p>
        </div>
      </div>

      <div class="charts-wrapper">
        <div class="chart-container">
          <h4>Rage Progression</h4>
          <p class="chart-description">
            Average rage level for each subsequent death across all sessions.
          </p>
          <canvas id="rageProgressionChart" />
          <div class="chart-actions">
            <button class="btn btn-primary" id="generateChartBtn">
              Generate Graph
            </button>
          </div>
        </div>
        <div class="chart-container">
          <h4>"Colorful" Language Usage</h4>
          <p class="chart-description">
            Your top 5 most frequently used swear words. We're not judging.
          </p>
          <canvas id="swearWordChart" />
          <div class="chart-actions">
            <button class="btn btn-primary" id="generateSwearChartBtn">
              Generate Graph
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="form-container">
      <h3>Customize Quick Phrases</h3>
      <p>
        Set up to three phrases that will appear as buttons for faster logging.
        Make them count.
      </p>
      <form action="/account/update-phrases" method="post">
        <div class="form-group">
          <label for="phrase1">Quick Phrase 1</label>
          <input
            id="phrase1"
            type="text"
            name="phrase1"
            value={userData.quick_phrase_1 || ''}
            placeholder="e.g., 'Not again!'"
          />
        </div>
        <div class="form-group">
          <label for="phrase2">Quick Phrase 2</label>
          <input
            id="phrase2"
            type="text"
            name="phrase2"
            value={userData.quick_phrase_2 || ''}
            placeholder="e.g., 'This game is broken.'"
          />
        </div>
        <div class="form-group">
          <label for="phrase3">Quick Phrase 3</label>
          <input
            id="phrase3"
            type="text"
            name="phrase3"
            value={userData.quick_phrase_3 || ''}
            placeholder="e.g., 'I give up.'"
          />
        </div>
        <button class="btn-primary" type="submit">
          Save Phrases
        </button>
      </form>
    </div>

    <div class="form-container">
      <h3>Achievements</h3>
      <div class="achievements-grid">
        {achievements.map((ach: any) => {
          const earned = earnedAchievements.has(ach.id)
          return (
            <div
              class={`achievement-card ${earned ? 'earned' : 'unearned'}`}
              title={
                earned
                  ? `Earned on: ${new Date(earnedAchievements.get(ach.id)!).toLocaleDateString()}`
                  : 'Not yet earned'
              }
            >
              <div class="achievement-icon">
                <i class={`bi ${ach.icon}`} />
              </div>
              <div class="achievement-details">
                <h4 class="achievement-name">{ach.name}</h4>
                <p class="achievement-description">{ach.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>

    <div class="form-container">
      <h3>Invite Codes</h3>
      <p>
        As a trusted member, you can generate invite codes for others to join.
        Misery loves company.
      </p>
      {inviteCodes.length > 0 && (
        <>
          <p>Your available invite codes:</p>
          <ul class="invite-code-list">
            {inviteCodes.map((item: any) => (
              <li class="invite-code-item">
                <span class="invite-code">{item.code}</span>
                <button class="btn-copy" data-code={item.code}>
                  Copy
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {inviteCodes.length === 0 && <p>You have no available invite codes.</p>}

      {canGenerateCode ? (
        <div class="chart-actions">
          <form action="/account/generate-invite" method="post">
            <button class="btn btn-primary" type="submit">
              Generate New Invite Code
            </button>
          </form>
        </div>
      ) : (
        permissionLevel !== 5 && (
          <p class="text-secondary">
            You can generate a new code next month. Patience.
          </p>
        )
      )}
    </div>

    <div class="form-container">
      <form action="/account/change-password" method="post">
        <h3>Change Password</h3>
        <div class="form-group">
          <label for="currentPassword">Current Password</label>
          <input
            id="currentPassword"
            type="password"
            name="currentPassword"
            required
          />
        </div>
        <div class="form-group">
          <label for="newPassword">New Password</label>
          <input
            id="newPassword"
            type="password"
            name="newPassword"
            required
          />
        </div>
        <div class="form-group">
          <label for="confirmPassword">Confirm New Password</label>
          <input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            required
          />
        </div>
        <button class="btn-primary" type="submit">
          Update Password
        </button>
      </form>
    </div>

    <div class="danger-zone">
      <h3>Clear All Session Data</h3>
      <p>
        This will permanently delete all of your recorded sessions and rage
        logs. Your account will not be deleted, but your stats will be reset to
        zero. This action cannot be undone.
      </p>
      <form
        action="/account/clear-data"
        method="post"
        data-confirm="Are you absolutely sure you want to delete all of your session data? This action is irreversible."
        data-confirm-title="Confirm Data Deletion"
      >
        <button class="delete-btn" type="submit">
          Delete All My Data
        </button>
      </form>
    </div>
  </>
)
