// routes/session.js
const express = require('express');
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');
const cache = require('../utils/cache');
const achievementService = require('../services/achievementService');

const router = express.Router();

// GET /session/:id - View a specific session and its logs
router.get('/:id', isAuthenticated, async (req, res, next) => {
    try {
        const sessionId = req.params.id;
        const userId = req.session.user.id;

        const [sessionRows] = await db.execute('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
        if (sessionRows.length === 0) {
            req.flash('error', 'Session not found.');
            return res.redirect('/dashboard');
        }
        const session = sessionRows[0];

        const [logs] = await db.execute('SELECT * FROM rage_logs WHERE session_id = ? ORDER BY created_at ASC', [sessionId]);

        // --- FIX: Calculate and add the stats object your view needs ---
        let totalRage = 0;
        const phraseCounts = {};
        logs.forEach(log => {
            totalRage += log.rage_level;
            phraseCounts[log.rage_phrase] = (phraseCounts[log.rage_phrase] || 0) + 1;
        });

        const totalDeaths = logs.length;
        const averageRage = totalDeaths > 0 ? (totalRage / totalDeaths).toFixed(1) : '0.0';
        const mostCommonPhrase = Object.keys(phraseCounts).reduce((a, b) => phraseCounts[a] > phraseCounts[b] ? a : b, 'N/A');

        const stats = {
            totalRage,
            totalDeaths,
            averageRage,
            mostCommonPhrase
        };
        // --- End of fix ---

        res.render('session', {
            session,
            logs,
            stats // Pass the stats object to the template
        });
    } catch (error) {
        next(error);
    }
});

// POST /session/:id/log-death - Add a death to a session
router.post('/:id/log-death', isAuthenticated, async (req, res, next) => {
    const sessionId = req.params.id;
    const userId = req.session.user.id;
    const { rageLevel, ragePhrase } = req.body;

    try {
        // Check if session is active and belongs to user
        const [sessionRows] = await db.execute('SELECT * FROM sessions WHERE id = ? AND user_id = ? AND is_active = 1', [sessionId, userId]);
        if (sessionRows.length === 0) {
            req.flash('error', 'Session not found or is already closed.');
            return res.redirect('/dashboard');
        }

        // Let the database handle the timestamp for consistency
        await db.execute(
            'INSERT INTO rage_logs (session_id, user_id, rage_level, rage_phrase) VALUES (?, ?, ?, ?)',
            [sessionId, userId, parseInt(rageLevel, 10), ragePhrase]
        );

        // Update user's aggregate stats
        await db.execute(
            'UPDATE users SET total_rage = total_rage + ?, total_deaths = total_deaths + 1 WHERE id = ?',
            [parseInt(rageLevel, 10), userId]
        );

        // Invalidate leaderboard cache
        cache.del('leaderboard');

        // Achievement checks are no longer performed here.

        req.flash('success', 'Death logged successfully.');
        res.redirect(`/session/${sessionId}`);
    } catch (error) {
        next(error);
    }
});

// POST /session/:id/end - End an active session
router.post('/:id/end', isAuthenticated, async (req, res, next) => {
    const sessionId = req.params.id;
    try {
        // Verify user owns the session
        const [sessionRows] = await db.execute('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [sessionId, req.session.user.id]);
        if (sessionRows.length === 0) {
            req.flash('error', 'Session could not be ended.');
            return res.redirect('/dashboard');
        }

        // Mark the session as inactive and set its end time
        await db.execute('UPDATE sessions SET is_active = 0, ended_at = NOW() WHERE id = ?', [sessionId]);

        // Fetch the fully updated session object (with ended_at)
        const [updatedSessionRows] = await db.execute('SELECT * FROM sessions WHERE id = ?', [sessionId]);
        const updatedSession = updatedSessionRows[0];

        // Call the single, consolidated achievement checking function
        await achievementService.checkAllAchievementsOnSessionEnd(req, req.session.user.id, updatedSession);

        req.flash('success', `Session "${updatedSession.name}" has been closed. Check your account for new achievements!`);
        res.redirect('/dashboard');
    } catch (error) {
        next(error);
    }
});

// POST /session/:id/delete - Delete a session and its logs
router.post('/:id/delete', isAuthenticated, async (req, res, next) => {
    const sessionId = req.params.id;
    const userId = req.session.user.id;
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Find the session to ensure it belongs to the user
        const [sessionRows] = await connection.execute('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
        if (sessionRows.length === 0) {
            await connection.rollback();
            req.flash('error', 'Session not found or you do not have permission to delete it.');
            return res.redirect('/dashboard');
        }

        // 2. Get the total rage and deaths from the logs of this session to subtract them
        const [logStats] = await connection.execute(
            'SELECT SUM(rage_level) as total_rage, COUNT(*) as total_deaths FROM rage_logs WHERE session_id = ?',
            [sessionId]
        );
        const rageToSubtract = logStats[0].total_rage || 0;
        const deathsToSubtract = logStats[0].total_deaths || 0;

        // 3. Delete the session itself (cascading delete will handle the logs)
        await connection.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);

        // 4. Update the user's aggregate stats
        await connection.execute(
            'UPDATE users SET total_rage = total_rage - ?, total_deaths = total_deaths - ? WHERE id = ?',
            [rageToSubtract, deathsToSubtract, userId]
        );

        await connection.commit();

        // 5. Invalidate cache
        cache.del('leaderboard');

        req.flash('success', 'Session and all its data have been deleted.');
        res.redirect('/dashboard');
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;