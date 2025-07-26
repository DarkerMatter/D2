// services/achievementService.js
const db = require('../db');

/**
 * Checks if a user has a specific achievement.
 * @param {number} userId The user's ID.
 * @param {number} achievementId The achievement's ID.
 * @returns {Promise<boolean>}
 */
async function hasAchievement(userId, achievementId) {
    const [rows] = await db.execute(
        'SELECT 1 FROM user_achievements WHERE user_id = ? AND achievement_id = ?',
        [userId, achievementId]
    );
    return rows.length > 0;
}

/**
 * Grants an achievement to a user if they don't already have it.
 * @param {object} req The Express request object for flashing messages.
 * @param {number} userId The user's ID.
 * @param {number} achievementId The achievement's ID.
 */
async function grantAchievement(req, userId, achievementId) {
    if (!req || !userId || !achievementId) return;

    const alreadyHas = await hasAchievement(userId, achievementId);
    if (!alreadyHas) {
        try {
            // Fetch achievement details to show in the toast
            const [achievementRows] = await db.execute('SELECT name, description, icon FROM achievements WHERE id = ?', [achievementId]);
            if (achievementRows.length === 0) return; // Achievement doesn't exist

            // Grant the achievement
            await db.execute(
                'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
                [userId, achievementId]
            );

            // If insert is successful, flash a message to the user for the toast notification
            const achievement = achievementRows[0];
            req.flash('achievement_unlocked', JSON.stringify(achievement));
            console.log(`[Achievement] User ${userId} earned achievement ${achievementId}: ${achievement.name}`);

        } catch (error) {
            // Ignore duplicate key errors, which can happen in race conditions
            if (error.code !== 'ER_DUP_ENTRY') {
                console.error(`Failed to grant achievement ${achievementId} to user ${userId}:`, error);
            }
        }
    }
}

/**
 * Checks ALL achievements for a user at the end of a session.
 * This is a consolidated function for robustness and simplicity.
 * @param {object} req The Express request object.
 * @param {number} userId The user's ID.
 * @param {object} session The full, updated session object from the database.
 */
async function checkAllAchievementsOnSessionEnd(req, userId, session) {
    // --- 1. GATHER ALL DATA ---

    // Get all logs for this specific session
    const [sessionLogs] = await db.execute(
        'SELECT rage_level, rage_phrase, created_at FROM rage_logs WHERE session_id = ? ORDER BY created_at ASC',
        [session.id]
    );

    // Get the user's final aggregate stats
    const [userStatsRows] = await db.execute('SELECT total_deaths, total_rage FROM users WHERE id = ?', [userId]);
    if (!userStatsRows[0]) return;
    const userStats = userStatsRows[0];

    // --- 2. CALCULATE SESSION-SPECIFIC METRICS ---
    const deathCount = sessionLogs.length;
    const firstDeath = deathCount > 0 ? sessionLogs[0] : null;
    const sessionStartTime = new Date(session.created_at);
    const sessionEndTime = new Date(session.ended_at);

    // --- 3. CHECK EACH ACHIEVEMENT ---

    // === Achievements based on session logs (only if there were deaths) ===
    if (deathCount > 0) {
        // ID 2: Maximum Over-Rage - Did any death have a rage level of 10?
        if (sessionLogs.some(log => log.rage_level === 10)) {
            await grantAchievement(req, userId, 2);
        }

        // ID 4: The Cycle of Pain - Was any death on a Sunday?
        if (sessionLogs.some(log => new Date(log.created_at).getDay() === 0)) {
            await grantAchievement(req, userId, 4);
        }

        // ID 8: Speed Run - Was the first death within 62 seconds of session start?
        const timeDiffSeconds = (new Date(firstDeath.created_at) - sessionStartTime) / 1000;
        if (timeDiffSeconds <= 62) {
            await grantAchievement(req, userId, 8);
        }

        // ID 11: Night Owl - Was any death between 1 AM and 4 AM?
        if (sessionLogs.some(log => {
            const hour = new Date(log.created_at).getHours();
            return hour >= 1 && hour < 4;
        })) {
            await grantAchievement(req, userId, 11);
        }

        // ID 12: The Specialist - 3+ deaths with only one unique phrase
        if (deathCount >= 3) {
            const uniquePhrases = new Set(sessionLogs.map(log => log.rage_phrase));
            if (uniquePhrases.size === 1) {
                await grantAchievement(req, userId, 12);
            }
        }

        // ID 13: Rage Quit - Session ended within 5 minutes of the first death
        const durationAfterFirstDeathMinutes = (sessionEndTime - new Date(firstDeath.created_at)) / (1000 * 60);
        if (durationAfterFirstDeathMinutes <= 5) {
            await grantAchievement(req, userId, 13);
        }
    }

    // === Achievements based on session-wide stats ===

    // ID 5: Flawless Victory - Zero deaths
    if (deathCount === 0) {
        await grantAchievement(req, userId, 5);

        // ID 14: The Pacifist - Flawless AND session lasted over an hour
        const sessionDurationHours = (sessionEndTime - sessionStartTime) / (1000 * 60 * 60);
        if (sessionDurationHours > 1) {
            await grantAchievement(req, userId, 14);
        }
    }

    // ID 9: Marathon of Misery - More than 20 deaths in the session
    if (deathCount > 20) {
        await grantAchievement(req, userId, 9);
    }

    // === Achievements based on user's total aggregate stats ===

    // ID 1: First Blood - Was the user's first-ever death in this session?
    // This is true if the user's total deaths now equals the number of deaths in this session.
    if (deathCount > 0 && userStats.total_deaths === deathCount) {
        await grantAchievement(req, userId, 1);
    }

    // ID 3: Centurion - 100+ total deaths
    if (userStats.total_deaths >= 100) {
        await grantAchievement(req, userId, 3);
    }

    // ID 7: Wordsmith of Fury - User has used 5+ distinct phrases in their lifetime
    const [phraseRows] = await db.execute('SELECT COUNT(DISTINCT rage_phrase) as unique_phrases FROM rage_logs WHERE user_id = ?', [userId]);
    if (phraseRows[0]?.unique_phrases >= 5) {
        await grantAchievement(req, userId, 7);
    }

    // ID 10: The Collector - 1000+ total rage
    if (userStats.total_rage >= 1000) {
        await grantAchievement(req, userId, 10);
    }
}

module.exports = {
    grantAchievement,
    checkAllAchievementsOnSessionEnd
};
