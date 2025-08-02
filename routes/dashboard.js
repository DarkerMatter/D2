// routes/dashboard.js
const express = require('express');
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

// GET /dashboard - List all sessions with pagination
router.get('/', isAuthenticated, async (req, res, next) => {
    try {
        const userId = req.session.user.id;
        const page = parseInt(req.query.page, 10) || 1;
        const sessionsPerPage = 10;
        const offset = (page - 1) * sessionsPerPage;

        // Get total number of sessions for pagination
        const [countRows] = await db.execute('SELECT COUNT(*) as totalSessions FROM sessions WHERE user_id = ?', [userId]);
        const totalSessions = countRows[0].totalSessions;
        const totalPages = Math.ceil(totalSessions / sessionsPerPage);

        // Get the paginated sessions, including a count of deaths for each
        const [sessions] = await db.query(`
            SELECT s.id, s.name, s.created_at, s.is_active, COUNT(rl.id) as death_count
            FROM sessions s
                     LEFT JOIN rage_logs rl ON s.id = rl.session_id
            WHERE s.user_id = ?
            GROUP BY s.id
            ORDER BY s.created_at DESC
                LIMIT ? OFFSET ?
        `, [userId, sessionsPerPage, offset]);

        res.render('dashboard', {
            sessions,
            currentPage: page,
            totalPages
        });

    } catch (error) {
        next(error);
    }
});

// POST /dashboard/sessions - Create a new session
router.post('/sessions', isAuthenticated, async (req, res, next) => {
    const { sessionName } = req.body;
    const userId = req.session.user.id;

    if (!sessionName || sessionName.trim() === '') {
        // FIX: Use the new unified toast notification system
        req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'Session name cannot be empty.' }));
        return res.redirect('/dashboard');
    }

    try {
        const [result] = await db.execute(
            'INSERT INTO sessions (user_id, name) VALUES (?, ?)',
            [userId, sessionName.trim()]
        );
        const newSessionId = result.insertId;
        // Redirect to the correct, new session route handled by session.js
        res.redirect(`/session/${newSessionId}`);
    } catch (error) {
        next(error);
    }
});

module.exports = router;