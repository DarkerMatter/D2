// routes/dashboard.js
const express = require('express');
const db = require('../db');
const {isAuthenticated} = require('../middleware/auth');

const router = express.Router();

// GET /dashboard - Now with pagination
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const page = parseInt(req.query.page, 10) || 1;
        const sessionsPerPage = 10;
        const offset = (page - 1) * sessionsPerPage;

        // First, get the total number of sessions for this user to calculate total pages
        const [countRows] = await db.execute('SELECT COUNT(*) as totalSessions FROM sessions WHERE user_id = ?', [userId]);
        const totalSessions = countRows[0].totalSessions;
        const totalPages = Math.ceil(totalSessions / sessionsPerPage);

        // FIX: Use db.query() here instead of db.execute() to support LIMIT/OFFSET with parameters.
        const [sessions] = await db.query(`
            SELECT s.id, s.name, s.created_at, COUNT(rl.id) as death_count
            FROM sessions s
                     LEFT JOIN rage_logs rl ON s.id = rl.session_id
            WHERE s.user_id = ?
            GROUP BY s.id
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, sessionsPerPage, offset]);

        res.render('dashboard', {
            user: req.session.user,
            sessions,
            currentPage: page,
            totalPages
        });

    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).send('Server error.');
    }
});

// ... (rest of the file is unchanged)

// POST /sessions - Create a new session with a name
router.post('/sessions', isAuthenticated, async (req, res) => {
    const {sessionName} = req.body;
    const userId = req.session.user.id;

    if (!sessionName || sessionName.trim() === '') {
        req.flash('error', 'Session name cannot be empty.');
        return res.redirect('/dashboard');
    }

    try {
        const [result] = await db.execute(
            'INSERT INTO sessions (user_id, name) VALUES (?, ?)',
            [userId, sessionName.trim()]
        );
        const newSessionId = result.insertId;
        res.redirect(`/dashboard/session/${newSessionId}`);
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).send('Server error.');
    }
});

// GET /session/:id - View a specific session (unchanged logic, but passes full session object)
router.get('/session/:id', isAuthenticated, async (req, res) => {
    const sessionId = req.params.id;
    const userId = req.session.user.id;

    try {
        const [sessionRows] = await db.execute('SELECT id, name, created_at FROM sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
        if (sessionRows.length === 0) {
            return res.status(403).send('Forbidden: You do not have access to this session.');
        }
        const session = sessionRows[0];

        const [stats] = await db.execute(`
            SELECT COUNT(*)                     AS               totalDeaths,
                   COALESCE(SUM(rage_level), 0) AS               totalRage,
                   COALESCE(AVG(rage_level), 0) AS               averageRage,
                   (SELECT rage_phrase
                    FROM rage_logs
                    WHERE session_id = ?
                    GROUP BY rage_phrase
                    ORDER BY COUNT(*) DESC, MAX(created_at) DESC LIMIT 1) AS mostCommonPhrase
            FROM rage_logs
            WHERE session_id = ?
        `, [sessionId, sessionId]);

        const sessionStats = {
            totalDeaths: stats[0].totalDeaths,
            totalRage: parseInt(stats[0].totalRage, 10),
            averageRage: parseFloat(stats[0].averageRage).toFixed(1),
            mostCommonPhrase: stats[0].mostCommonPhrase || 'N/A'
        };

        res.render('session', {
            user: req.session.user,
            session,
            stats: sessionStats,
            updated: req.query.updated
        });

    } catch (error) {
        console.error('Error fetching session data:', error);
        res.status(500).send('Server error.');
    }
});

// POST /session/:id/rage - Add a rage event (unchanged)
router.post('/session/:id/rage', isAuthenticated, async (req, res) => {
    const sessionId = req.params.id;
    const userId = req.session.user.id;
    const {rageLevel, ragePhrase} = req.body;
    const rageToAdd = parseInt(rageLevel, 10);

    if (isNaN(rageToAdd) || rageToAdd < 1 || rageToAdd > 10 || !ragePhrase) {
        return res.status(400).send('Invalid rage level or phrase.');
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [sessionCheck] = await connection.execute('SELECT id FROM sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
        if (sessionCheck.length === 0) {
            await connection.rollback();
            return res.status(403).send('Forbidden.');
        }

        await connection.execute(
            'INSERT INTO rage_logs (user_id, session_id, rage_level, rage_phrase) VALUES (?, ?, ?, ?)',
            [userId, sessionId, rageToAdd, ragePhrase]
        );

        await connection.execute(
            'UPDATE users SET total_rage = total_rage + ?, total_deaths = total_deaths + 1 WHERE id = ?',
            [rageToAdd, userId]
        );

        await connection.commit();
        res.redirect(`/dashboard/session/${sessionId}?updated=true`);

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error logging rage event:', error);
        res.status(500).send('Server error.');
    } finally {
        if (connection) connection.release();
    }
});

// NEW: POST /session/:id/rename - Update a session's name
router.post('/session/:id/rename', isAuthenticated, async (req, res) => {
    const {newName} = req.body;
    const sessionId = req.params.id;
    const userId = req.session.user.id;

    if (!newName || newName.trim() === '') {
        req.flash('error', 'Session name cannot be empty.');
        return res.redirect(`/dashboard/session/${sessionId}`);
    }

    try {
        // Verify ownership before updating
        const [result] = await db.execute(
            'UPDATE sessions SET name = ? WHERE id = ? AND user_id = ?',
            [newName.trim(), sessionId, userId]
        );

        if (result.affectedRows === 0) {
            req.flash('error', 'You do not have permission to rename this session.');
        } else {
            req.flash('success', 'Session renamed successfully.');
        }
        res.redirect(`/dashboard/session/${sessionId}`);
    } catch (error) {
        console.error('Error renaming session:', error);
        req.flash('error', 'A server error occurred.');
        res.redirect(`/dashboard/session/${sessionId}`);
    }
});

// NEW: POST /session/:id/delete - Delete a session and its data
router.post('/session/:id/delete', isAuthenticated, async (req, res) => {
    const sessionId = req.params.id;
    const userId = req.session.user.id;
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Important: First, get the stats from the session about to be deleted
        const [logs] = await connection.execute(
            'SELECT SUM(rage_level) as totalRage, COUNT(*) as totalDeaths FROM rage_logs WHERE session_id = ? AND user_id = ?',
            [sessionId, userId]
        );
        const statsToSubtract = logs[0];

        // 1. Delete the session itself. ON DELETE CASCADE will handle the logs.
        // We must verify ownership here for security.
        const [deleteResult] = await connection.execute(
            'DELETE FROM sessions WHERE id = ? AND user_id = ?',
            [sessionId, userId]
        );

        if (deleteResult.affectedRows === 0) {
            // If nothing was deleted, it means the user didn't own the session.
            await connection.rollback();
            req.flash('error', 'You do not have permission to delete this session.');
            return res.redirect('/dashboard');
        }

        // 2. If deletion was successful, subtract the stats from the user's overall totals
        if (statsToSubtract && statsToSubtract.totalDeaths > 0) {
            await connection.execute(
                'UPDATE users SET total_rage = total_rage - ?, total_deaths = total_deaths - ? WHERE id = ?',
                [statsToSubtract.totalRage || 0, statsToSubtract.totalDeaths, userId]
            );
        }

        await connection.commit();
        req.flash('success', 'Session deleted successfully.');
        res.redirect('/dashboard');

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error deleting session:', error);
        req.flash('error', 'A server error occurred while deleting the session.');
        res.redirect('/dashboard');
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;