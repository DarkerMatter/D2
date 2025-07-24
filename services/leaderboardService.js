// services/leaderboardService.js
const db = require('../db');
const cache = require('../utils/cache');

const LEADERBOARD_CACHE_KEY = 'leaderboardData';

/**
 * Fetches leaderboard data, utilizing a cache to avoid frequent DB calls.
 * @returns {Promise<{rageLeaders: Array, deathLeaders: Array}>}
 */
async function getLeaderboardData() {
    // First, try to get data from the cache
    const cachedData = cache.get(LEADERBOARD_CACHE_KEY);
    if (cachedData) {
        return cachedData;
    }

    // If cache miss, query the database
    const baseQuery = `
        SELECT
            u.username,
            SUM(re.rage_level) AS total_rage,
            COUNT(re.id) AS total_deaths
        FROM users u
                 JOIN rage_logs re ON u.id = re.user_id -- FIX: Point to the correct 'rage_logs' table
        GROUP BY u.id, u.username
        HAVING total_deaths > 0
    `;

    const rageQuery = `${baseQuery} ORDER BY total_rage DESC LIMIT 10;`;
    const deathQuery = `${baseQuery} ORDER BY total_deaths DESC LIMIT 10;`;

    // Run queries in parallel for maximum efficiency
    const [[rageLeaders], [deathLeaders]] = await Promise.all([
        db.execute(rageQuery),
        db.execute(deathQuery)
    ]);

    const data = { rageLeaders, deathLeaders };

    // Store the fresh data in the cache for next time
    cache.set(LEADERBOARD_CACHE_KEY, data);

    return data;
}

module.exports = { getLeaderboardData };