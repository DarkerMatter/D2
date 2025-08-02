// routes/account.js
const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const cache = require('../utils/cache');
const { isAuthenticated } = require('../middleware/auth');
const achievementService = require('../services/achievementService');

const router = express.Router();
const saltRounds = 10;

// GET route for the main account page
router.get('/', isAuthenticated, async (req, res, next) => {
    try {
        const userId = req.session.user.id;

        const [
            userResults,
            avgRageResults,
            phraseResults,
            codesResults,
            lastCodeResults,
            allAchievementsResults,
            userAchievementsResults
        ] = await Promise.all([
            db.execute('SELECT * FROM users WHERE id = ?', [userId]),
            db.execute('SELECT AVG(rage_level) as averageRage FROM rage_logs WHERE user_id = ?', [userId]),
            db.execute(`
                SELECT rage_phrase as mostCommonPhrase FROM rage_logs WHERE user_id = ?
                GROUP BY rage_phrase ORDER BY COUNT(rage_phrase) DESC LIMIT 1
            `, [userId]),
            db.execute('SELECT code FROM invite_codes WHERE created_by_user_id = ? AND used_by_user_id IS NULL', [userId]),
            db.execute('SELECT created_at FROM invite_codes WHERE created_by_user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]),
            db.execute('SELECT id, name, description, icon FROM achievements ORDER BY id'),
            db.execute('SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ?', [userId]),
        ]);

        const user = userResults[0][0];
        if (!user) {
            req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'User not found.' }));
            return res.redirect('/login');
        }
        const stats = {
            total_rage: user.total_rage,
            total_deaths: user.total_deaths,
            averageRage: avgRageResults[0][0]?.averageRage ? parseFloat(avgRageResults[0][0].averageRage).toFixed(1) : 'N/A',
            mostCommonPhrase: phraseResults[0][0]?.mostCommonPhrase ?? 'N/A'
        };

        const inviteCodes = codesResults[0];

        let canGenerateCode = false;
        if (req.session.user.permission_level === 5) {
            canGenerateCode = true;
        } else {
            const lastCode = lastCodeResults[0];
            if (lastCode.length === 0) {
                canGenerateCode = true;
            } else {
                const lastCodeDate = new Date(lastCode[0].created_at);
                const now = new Date();
                if (lastCodeDate.getFullYear() < now.getFullYear() || lastCodeDate.getMonth() < now.getMonth()) {
                    canGenerateCode = true;
                }
            }
        }

        const userAchievements = userAchievementsResults[0];
        const earnedAchievements = new Map(userAchievements.map(a => [a.achievement_id, a.earned_at]));

        res.render('account', {
            user,
            stats,
            inviteCodes,
            canGenerateCode,
            achievements: allAchievementsResults[0],
            earnedAchievements
        });
    } catch (error) {
        next(error);
    }
});

router.post('/update-phrases', isAuthenticated, async (req, res, next) => {
    try {
        const userId = req.session.user.id;
        const { phrase1, phrase2, phrase3 } = req.body;

        await db.execute(
            'UPDATE users SET quick_phrase_1 = ?, quick_phrase_2 = ?, quick_phrase_3 = ? WHERE id = ?',
            [phrase1.trim() || null, phrase2.trim() || null, phrase3.trim() || null, userId]
        );

        req.flash('toast_notification', JSON.stringify({ type: 'success', message: 'Your custom phrases have been saved!' }));
        res.redirect('/account');
    } catch (error) {
        next(error);
    }
});

router.post('/generate-invite', isAuthenticated, async (req, res, next) => {
    const userId = req.session.user.id;
    const userPerms = req.session.user.permission_level;

    try {
        if (userPerms !== 5) {
            const [lastCode] = await db.execute(
                'SELECT created_at FROM invite_codes WHERE created_by_user_id = ? ORDER BY created_at DESC LIMIT 1',
                [userId]
            );
            if (lastCode.length > 0) {
                const lastCodeDate = new Date(lastCode[0].created_at);
                const now = new Date();
                if (lastCodeDate.getFullYear() === now.getFullYear() && lastCodeDate.getMonth() === now.getMonth()) {
                    req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'You have already generated an invite code this month.' }));
                    return res.redirect('/account');
                }
            }
        }

        const newCode = uuidv4();
        await db.execute(
            'INSERT INTO invite_codes (code, created_by_user_id) VALUES (?, ?)',
            [newCode, userId]
        );
        await achievementService.grantAchievement(req, userId, 6);
        req.flash('toast_notification', JSON.stringify({ type: 'success', message: 'New invite code generated successfully!' }));
        res.redirect('/account');

    } catch (error) {
        next(error);
    }
});

router.get('/analytics/rage-progression', isAuthenticated, async (req, res, next) => {
    try {
        const userId = req.session.user.id;
        const [chartRows] = await db.execute(`
            WITH NumberedDeaths AS (
                SELECT
                    rage_level,
                    ROW_NUMBER() OVER(PARTITION BY session_id ORDER BY created_at ASC) as death_number
                FROM rage_logs
                WHERE user_id = ?
            )
            SELECT
                death_number,
                AVG(rage_level) as average_rage
            FROM NumberedDeaths
            GROUP BY death_number
            ORDER BY death_number ASC
                LIMIT 50;
        `, [userId]);
        res.json(chartRows);
    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({ message: 'Failed to fetch chart data.' });
    }
});

router.get('/analytics/swear-words', isAuthenticated, async (req, res, next) => {
    try {
        const userId = req.session.user.id;

        // 1. Fetch all of the user's rage phrases from the database
        const [logs] = await db.execute('SELECT rage_phrase FROM rage_logs WHERE user_id = ?', [userId]);

        // 2. Define the patterns to search for and group variations
        const swearWordPatterns = {
            'fuck': /\b(fuck(er|ing)?)\b/ig,
            'shit': /\b(shit(ty)?)\b/ig,
            'bitch': /\b(bitch)\b/ig,
            'ass': /\b(ass(hole)?)\b/ig,
            'whore': /\b(whore)\b/ig,
            'n-word': /\b(nigg(a|er))\b/ig
        };

        // 3. Initialize a counter for each base word
        const counts = { 'fuck': 0, 'shit': 0, 'bitch': 0, 'ass': 0, 'whore': 0, 'n-word': 0 };

        // 4. Iterate through every log and count the occurrences
        for (const log of logs) {
            if (!log.rage_phrase) continue;
            for (const baseWord in swearWordPatterns) {
                const matches = log.rage_phrase.match(swearWordPatterns[baseWord]);
                if (matches) {
                    counts[baseWord] += matches.length;
                }
            }
        }

        // 5. Sort the results, take the top 5, and filter out any that were never used
        const sortedSwears = Object.entries(counts)
            .map(([name, count]) => ({ name, count })) // Convert to array of objects
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .filter(item => item.count > 0);

        res.json(sortedSwears);

    } catch (error) {
        console.error('Error fetching swear word analytics:', error);
        res.status(500).json({ message: 'Failed to fetch analytics data.' });
    }
});

router.post('/change-password', isAuthenticated, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user.id;

    if (!currentPassword || !newPassword || !confirmPassword) {
        req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'All password fields are required.' }));
        return res.redirect('/account');
    }
    if (newPassword !== confirmPassword) {
        req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'New passwords do not match.' }));
        return res.redirect('/account');
    }
    if (newPassword.length < 8) {
        req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'New password must be at least 8 characters long.' }));
        return res.redirect('/account');
    }

    try {
        const [userRows] = await db.execute('SELECT password FROM users WHERE id = ?', [userId]);
        const user = userRows[0];

        const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordMatch) {
            req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'Incorrect current password.' }));
            return res.redirect('/account');
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);

        req.flash('toast_notification', JSON.stringify({ type: 'success', message: 'Password changed successfully.' }));
        res.redirect('/account');

    } catch (error) {
        console.error('Password change error:', error);
        req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'A server error occurred while changing your password.' }));
        res.redirect('/account');
    }
});

router.post('/clear-data', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        await connection.execute('DELETE FROM sessions WHERE user_id = ?', [userId]);
        await connection.execute('UPDATE users SET total_rage = 0, total_deaths = 0 WHERE id = ?', [userId]);

        await connection.commit();
        cache.clear();

        req.flash('toast_notification', JSON.stringify({ type: 'success', message: 'All of your session data has been successfully deleted.' }));
        res.redirect('/account');

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error clearing user data:', error);
        req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'A server error occurred while clearing your data.' }));
        res.redirect('/account');
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;