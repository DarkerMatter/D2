// services/achievementService.js
const db = require('../db');

async function hasAchievement(userId, achievementId) {
    const [rows] = await db.execute(
        'SELECT 1 FROM user_achievements WHERE user_id = ? AND achievement_id = ?',
        [userId, achievementId]
    );
    return rows.length > 0;
}

async function grantAchievement(req, userId, achievementId) {
    if (!req || !userId || !achievementId) return;

    const alreadyHas = await hasAchievement(userId, achievementId);
    if (!alreadyHas) {
        try {
            const [achievementRows] = await db.execute('SELECT name, description, icon FROM achievements WHERE id = ?', [achievementId]);
            if (achievementRows.length === 0) return;

            await db.execute(
                'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
                [userId, achievementId]
            );

            const achievement = achievementRows[0];
            // Use the new unified toast system
            const toastData = { type: 'achievement', ...achievement };
            req.flash('toast_notification', JSON.stringify(toastData));
            console.log(`[Achievement] User ${userId} earned achievement ${achievementId}: ${achievement.name}`);

        } catch (error) {
            if (error.code !== 'ER_DUP_ENTRY') {
                console.error(`Failed to grant achievement ${achievementId} to user ${userId}:`, error);
            }
        }
    }
}

async function checkAllAchievementsOnSessionEnd(req, userId, session) {
    // --- 1. GATHER ALL DATA ---
    const [sessionLogs] = await db.execute(
        'SELECT rage_level, rage_phrase, created_at FROM rage_logs WHERE session_id = ? ORDER BY created_at ASC',
        [session.id]
    );
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
        if (sessionLogs.some(log => log.rage_level === 10)) {
            await grantAchievement(req, userId, 2); // Maximum Over-Rage
        }
        if (sessionLogs.some(log => new Date(log.created_at).getDay() === 0)) {
            await grantAchievement(req, userId, 4); // The Cycle of Pain
        }
        const timeDiffSeconds = (new Date(firstDeath.created_at) - sessionStartTime) / 1000;
        if (timeDiffSeconds <= 62) {
            await grantAchievement(req, userId, 8); // Speed Run
        }
        if (sessionLogs.some(log => { const hour = new Date(log.created_at).getHours(); return hour >= 1 && hour < 4; })) {
            await grantAchievement(req, userId, 11); // Night Owl
        }
        if (deathCount >= 3) {
            const uniquePhrases = new Set(sessionLogs.map(log => log.rage_phrase));
            if (uniquePhrases.size === 1) {
                await grantAchievement(req, userId, 12); // The Specialist
            }
        }
        const durationAfterFirstDeathMinutes = (sessionEndTime - new Date(firstDeath.created_at)) / (1000 * 60);
        if (durationAfterFirstDeathMinutes <= 5) {
            await grantAchievement(req, userId, 13); // Rage Quit
        }
        const offensiveWordRegex = /\b(fuck(er|ing)?|shit(ty)?|bitch|ass(hole)?|whore|nigg(a|er))\b/i;
        if (sessionLogs.some(log => offensiveWordRegex.test(log.rage_phrase))) {
            await grantAchievement(req, userId, 15); // Tilted
        }
    }

    // === Achievements based on session-wide stats ===
    if (deathCount === 0) {
        await grantAchievement(req, userId, 5); // Flawless Victory
        const sessionDurationHours = (sessionEndTime - sessionStartTime) / (1000 * 60 * 60);
        if (sessionDurationHours > 1) {
            await grantAchievement(req, userId, 14); // The Pacifist
        }
    }
    if (deathCount > 20) {
        await grantAchievement(req, userId, 9); // Marathon of Misery
    }

    // === Achievements based on user's total aggregate stats ===
    if (deathCount > 0 && userStats.total_deaths === deathCount) {
        await grantAchievement(req, userId, 1); // First Blood
    }
    if (userStats.total_deaths >= 100) {
        await grantAchievement(req, userId, 3); // Centurion
    }
    const [phraseRows] = await db.execute('SELECT COUNT(DISTINCT rage_phrase) as unique_phrases FROM rage_logs WHERE user_id = ?', [userId]);
    if (phraseRows[0]?.unique_phrases >= 5) {
        await grantAchievement(req, userId, 7); // Wordsmith of Fury
    }
    if (userStats.total_rage >= 1000) {
        await grantAchievement(req, userId, 10); // The Collector
    }
}

module.exports = {
    grantAchievement,
    checkAllAchievementsOnSessionEnd
};