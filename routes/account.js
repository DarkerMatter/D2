// routes/account.js
const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid'); // Import UUID generator
const db = require('../db');
const cache = require('../utils/cache');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();
const saltRounds = 10;

// --- GET route for the main account page ---
// FIX: Now fetches invite codes and checks generation eligibility.
router.get('/', isAuthenticated, async (req, res, next) => {
    try {
        const userId = req.session.user.id;

        // 1. Fetch lifetime stats (unchanged)
        const [statsRows] = await db.execute('SELECT total_rage, total_deaths FROM users WHERE id = ?', [userId]);
        const stats = statsRows[0] || { total_rage: 0, total_deaths: 0 };
        const [avgRageRows] = await db.execute('SELECT AVG(rage_level) as averageRage FROM rage_logs WHERE user_id = ?', [userId]);
        stats.averageRage = avgRageRows[0]?.averageRage ? parseFloat(avgRageRows[0].averageRage).toFixed(1) : 'N/A';
        const [phraseRows] = await db.execute(`
            SELECT rage_phrase as mostCommonPhrase FROM rage_logs WHERE user_id = ?
            GROUP BY rage_phrase ORDER BY COUNT(rage_phrase) DESC LIMIT 1
        `, [userId]);
        stats.mostCommonPhrase = phraseRows[0]?.mostCommonPhrase ?? 'N/A';

        // 2. NEW: Fetch available invite codes
        const [codes] = await db.execute('SELECT code FROM invite_codes WHERE created_by_user_id = ? AND used_by_user_id IS NULL', [userId]);

        // 3. NEW: Determine if the user can generate a new code
        let canGenerateCode = false;
        if (req.session.user.permission_level === 5) {
            canGenerateCode = true; // Admins can always generate
        } else {
            const [lastCode] = await db.execute(
                'SELECT created_at FROM invite_codes WHERE created_by_user_id = ? ORDER BY created_at DESC LIMIT 1',
                [userId]
            );
            if (lastCode.length === 0) {
                canGenerateCode = true; // Never generated one before
            } else {
                const lastCodeDate = new Date(lastCode[0].created_at);
                const now = new Date();
                // Check if the last code was generated in a previous month
                if (lastCodeDate.getFullYear() < now.getFullYear() || lastCodeDate.getMonth() < now.getMonth()) {
                    canGenerateCode = true;
                }
            }
        }

        // Renders the account.pug view with the new data
        res.render('account', {
            stats,
            inviteCodes: codes,
            canGenerateCode
        });
    } catch (error) {
        next(error);
    }
});

// --- NEW: Route to generate an invite code ---
router.post('/generate-invite', isAuthenticated, async (req, res, next) => {
    const userId = req.session.user.id;
    const userPerms = req.session.user.permission_level;

    try {
        // Server-side check to enforce generation rules
        if (userPerms !== 5) {
            const [lastCode] = await db.execute(
                'SELECT created_at FROM invite_codes WHERE created_by_user_id = ? ORDER BY created_at DESC LIMIT 1',
                [userId]
            );
            if (lastCode.length > 0) {
                const lastCodeDate = new Date(lastCode[0].created_at);
                const now = new Date();
                if (lastCodeDate.getFullYear() === now.getFullYear() && lastCodeDate.getMonth() === now.getMonth()) {
                    req.flash('error', 'You have already generated an invite code this month.');
                    return res.redirect('/account');
                }
            }
        }

        const newCode = uuidv4();
        await db.execute(
            'INSERT INTO invite_codes (code, created_by_user_id) VALUES (?, ?)',
            [newCode, userId]
        );
        req.flash('success', 'New invite code generated successfully!');
        res.redirect('/account');

    } catch (error) {
        next(error);
    }
});


// --- (The rest of the file remains the same) ---
// Dedicated route to fetch chart data on-demand
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
        res.json(chartRows); // Send data as JSON
    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({ message: 'Failed to fetch chart data.' });
    }
});

// Route to handle password changes
router.post('/change-password', isAuthenticated, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user.id;

    if (!currentPassword || !newPassword || !confirmPassword) {
        req.flash('error', 'All password fields are required.');
        return res.redirect('/account');
    }
    if (newPassword !== confirmPassword) {
        req.flash('error', 'New passwords do not match.');
        return res.redirect('/account');
    }
    if (newPassword.length < 8) {
        req.flash('error', 'New password must be at least 8 characters long.');
        return res.redirect('/account');
    }

    try {
        const [userRows] = await db.execute('SELECT password FROM users WHERE id = ?', [userId]);
        const user = userRows[0];

        const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordMatch) {
            req.flash('error', 'Incorrect current password.');
            return res.redirect('/account');
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);

        req.flash('success', 'Password changed successfully.');
        res.redirect('/account');

    } catch (error) {
        console.error('Password change error:', error);
        req.flash('error', 'A server error occurred while changing your password.');
        res.redirect('/account');
    }
});


// POST /account/clear-data - Deletes all of a user's session data
router.post('/clear-data', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Delete all sessions owned by the user.
        await connection.execute('DELETE FROM sessions WHERE user_id = ?', [userId]);

        // 2. Reset the user's aggregate stats on the users table.
        await connection.execute('UPDATE users SET total_rage = 0, total_deaths = 0 WHERE id = ?', [userId]);

        await connection.commit();

        // 3. Clear the cache since this user's stats are now gone
        cache.clear();
        console.log('[Cache] Purged cache due to user data deletion.');

        req.flash('success', 'All of your session data has been successfully deleted.');
        res.redirect('/account');

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error clearing user data:', error);
        req.flash('error', 'A server error occurred while clearing your data.');
        res.redirect('/account');
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;