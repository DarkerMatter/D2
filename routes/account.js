// routes/account.js
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();
const saltRounds = 10;

// GET /account - Show account page with overall stats
router.get('/', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    try {
        // The overall stats are now stored on the user record, so this is very fast.
        const [userRows] = await db.execute(
            'SELECT total_rage, total_deaths FROM users WHERE id = ?',
            [userId]
        );
        const userStats = userRows[0];

        // We still need to calculate the overall average and go-to phrase.
        const [aggRows] = await db.execute(`
            SELECT
                COALESCE(AVG(rage_level), 0) AS averageRage,
                (SELECT rage_phrase FROM rage_logs WHERE user_id = ? GROUP BY rage_phrase ORDER BY COUNT(*) DESC, MAX(created_at) DESC LIMIT 1) AS mostCommonPhrase
            FROM rage_logs
            WHERE user_id = ?
        `, [userId, userId]);

        const overallStats = {
            totalRage: userStats.total_rage || 0,
            totalDeaths: userStats.total_deaths || 0,
            averageRage: parseFloat(aggRows[0].averageRage).toFixed(1),
            mostCommonPhrase: aggRows[0].mostCommonPhrase || 'N/A'
        };

        res.render('account', {
            user: req.session.user,
            overallStats,
            error: req.flash('error'), // Using connect-flash is great for this
            success: req.flash('success')
        });

    } catch (error) {
        console.error('Error fetching account stats:', error);
        res.status(500).send('Server error.');
    }
});

// POST /account/change-password (move logic from old routes file)
router.post('/change-password', isAuthenticated, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user.id;

    if (!currentPassword || !newPassword || newPassword.length < 8) {
        req.flash('error', 'All fields are required and new password must be at least 8 characters.');
        return res.redirect('/account');
    }

    try {
        const [rows] = await db.execute('SELECT password FROM users WHERE id = ?', [userId]);
        const match = await bcrypt.compare(currentPassword, rows[0].password);

        if (!match) {
            req.flash('error', 'Incorrect current password.');
            return res.redirect('/account');
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);

        req.flash('success', 'Password changed successfully.');
        res.redirect('/account');
    } catch (error) {
        console.error('Password change error:', error);
        req.flash('error', 'A server error occurred.');
        res.redirect('/account');
    }
});

// POST /account/delete-history (move and update logic)
router.post('/delete-history', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Delete all rage logs for the user
        await connection.execute('DELETE FROM rage_logs WHERE user_id = ?', [userId]);
        // 2. Delete all sessions for the user
        await connection.execute('DELETE FROM sessions WHERE user_id = ?', [userId]);
        // 3. Reset the counters in the users table
        await connection.execute('UPDATE users SET total_rage = 0, total_deaths = 0 WHERE id = ?', [userId]);

        await connection.commit();
        req.flash('success', 'Your entire account history has been deleted.');
        res.redirect('/account');
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Delete history error:', error);
        req.flash('error', 'A server error occurred while deleting your history.');
        res.redirect('/account');
    } finally {
        if (connection) connection.release();
    }
});


// NEW: API endpoint to provide data for the rage phrase chart
router.get('/chart-data', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    try {
        const [rows] = await db.execute(`
            SELECT rage_phrase, COUNT(*) as phrase_count
            FROM rage_logs
            WHERE user_id = ?
            GROUP BY rage_phrase
            ORDER BY phrase_count DESC
            LIMIT 5
        `, [userId]);

        // Format the data for Chart.js
        const labels = rows.map(row => row.rage_phrase);
        const data = rows.map(row => row.phrase_count);

        res.json({ labels, data });

    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({ error: 'Failed to fetch chart data' });
    }
});

module.exports = router;