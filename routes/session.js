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
            req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'Session not found.' }));
            return res.redirect('/dashboard');
        }
        const session = sessionRows[0];

        const [logs] = await db.execute('SELECT * FROM rage_logs WHERE session_id = ? ORDER BY created_at ASC', [sessionId]);

        const [userRows] = await db.execute('SELECT quick_phrase_1, quick_phrase_2, quick_phrase_3 FROM users WHERE id = ?', [userId]);
        const userPhrases = userRows[0] || {};
        const customPhrases = [userPhrases.quick_phrase_1, userPhrases.quick_phrase_2, userPhrases.quick_phrase_3].filter(Boolean);

        let totalRage = 0;
        const phraseCounts = {};
        logs.forEach(log => {
            totalRage += log.rage_level;
            phraseCounts[log.rage_phrase] = (phraseCounts[log.rage_phrase] || 0) + 1;
        });
        const totalDeaths = logs.length;
        const averageRage = totalDeaths > 0 ? (totalRage / totalDeaths).toFixed(1) : '0.0';
        const mostCommonPhrase = Object.keys(phraseCounts).reduce((a, b) => phraseCounts[a] > phraseCounts[b] ? a : b, 'N/A');
        const stats = { totalRage, totalDeaths, averageRage, mostCommonPhrase };

        res.render('session', {
            session,
            logs,
            stats,
            customPhrases
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
        const [sessionRows] = await db.execute('SELECT * FROM sessions WHERE id = ? AND user_id = ? AND is_active = 1', [sessionId, userId]);
        if (sessionRows.length === 0) {
            req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'Session not found or is already closed.' }));
            return res.redirect('/dashboard');
        }

        await db.execute(
            'INSERT INTO rage_logs (session_id, user_id, rage_level, rage_phrase) VALUES (?, ?, ?, ?)',
            [sessionId, userId, parseInt(rageLevel, 10), ragePhrase]
        );

        await db.execute(
            'UPDATE users SET total_rage = total_rage + ?, total_deaths = total_deaths + 1 WHERE id = ?',
            [parseInt(rageLevel, 10), userId]
        );

        cache.del('leaderboard');

        req.flash('toast_notification', JSON.stringify({ type: 'success', message: 'Death logged successfully.' }));
        res.redirect(`/session/${sessionId}`);
    } catch (error) {
        next(error);
    }
});

// POST /session/:id/end - End an active session
router.post('/:id/end', isAuthenticated, async (req, res, next) => {
    const sessionId = req.params.id;
    try {
        const [sessionRows] = await db.execute('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [sessionId, req.session.user.id]);
        if (sessionRows.length === 0) {
            req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'Session could not be ended.' }));
            return res.redirect('/dashboard');
        }

        await db.execute('UPDATE sessions SET is_active = 0, ended_at = NOW() WHERE id = ?', [sessionId]);

        const [updatedSessionRows] = await db.execute('SELECT * FROM sessions WHERE id = ?', [sessionId]);
        const updatedSession = updatedSessionRows[0];

        await achievementService.checkAllAchievementsOnSessionEnd(req, req.session.user.id, updatedSession);

        req.flash('toast_notification', JSON.stringify({ type: 'success', message: `Session "${updatedSession.name}" has been closed.` }));
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

        const [sessionRows] = await connection.execute('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
        if (sessionRows.length === 0) {
            await connection.rollback();
            req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'Session not found or you do not have permission to delete it.' }));
            return res.redirect('/dashboard');
        }

        const [logStats] = await connection.execute(
            'SELECT SUM(rage_level) as total_rage, COUNT(*) as total_deaths FROM rage_logs WHERE session_id = ?',
            [sessionId]
        );
        const rageToSubtract = logStats[0].total_rage || 0;
        const deathsToSubtract = logStats[0].total_deaths || 0;

        await connection.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);

        await connection.execute(
            'UPDATE users SET total_rage = total_rage - ?, total_deaths = total_deaths - ? WHERE id = ?',
            [rageToSubtract, deathsToSubtract, userId]
        );

        await connection.commit();
        cache.del('leaderboard');

        req.flash('toast_notification', JSON.stringify({ type: 'success', message: 'Session and all its data have been deleted.' }));
        res.redirect('/dashboard');
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;