// routes/admin.js
const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const cache = require('../utils/cache');
const si = require('systeminformation');

const router = express.Router();
const saltRounds = 10;

// --- Helper Functions for Formatting ---
function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Protect all admin routes
router.use(isAuthenticated, isAdmin);

// GET /admin - Show admin panel with users, invites, and server metrics
router.get('/', async (req, res, next) => {
    try {
        // Parallelize data fetching for better performance
        const [
            users,
            invites,
            processes,
            uptime,
            dbConnections,
            dbMaxConnections,
            dbSizeRows,
            allAchievements,
            allUserAchievements
        ] = await Promise.all([
            db.execute('SELECT id, username, permission_level FROM users ORDER BY created_at DESC'),
            db.execute(`
                SELECT
                    ic.id,
                    ic.code,
                    ic.created_at,
                    ic.used_at,
                    creator.username as creator_username,
                    used_by.username as used_by_username
                FROM invite_codes ic
                         JOIN users creator ON ic.created_by_user_id = creator.id
                         LEFT JOIN users used_by ON ic.used_by_user_id = used_by.id
                ORDER BY ic.created_at DESC
            `),
            si.processes(),
            si.time(),
            db.execute("SHOW STATUS LIKE 'Threads_connected'"),
            db.execute("SHOW VARIABLES LIKE 'max_connections'"),
            db.execute(
                'SELECT table_schema AS "db_name", ROUND(SUM(data_length + index_length), 2) AS "size_bytes" FROM information_schema.TABLES WHERE table_schema = ? GROUP BY table_schema;',
                [process.env.DB_NAME]
            ),
            db.execute('SELECT id, name FROM achievements ORDER BY id'),
            db.execute('SELECT user_id, achievement_id FROM user_achievements')
        ]);

        // Find the current process by its PID to get its specific stats
        const mainProcess = processes.list.find(p => p.pid === process.pid);

        // Assemble the server metrics object
        const serverMetrics = {
            cpu: {
                load: (mainProcess && typeof mainProcess.pcpu === 'number') ? mainProcess.pcpu.toFixed(2) : '0.00'
            },
            ram: {
                // mem_rss is in KB, so multiply by 1024 for bytes
                used: mainProcess ? formatBytes(mainProcess.mem_rss * 1024) : 'N/A'
            },
            db: {
                connections: dbConnections[0][0]?.Value || '0',
                maxConnections: dbMaxConnections[0][0]?.Value || '0',
                size: dbSizeRows[0][0] ? formatBytes(dbSizeRows[0][0].size_bytes) : 'N/A'
            },
            uptime: formatUptime(uptime.uptime)
        };

        // Add a calculated percentage for DB connections
        const currentConns = parseInt(serverMetrics.db.connections, 10);
        const maxConns = parseInt(serverMetrics.db.maxConnections, 10);
        serverMetrics.db.percent = (maxConns > 0) ? ((currentConns / maxConns) * 100).toFixed(2) : 0;

        // Group achievements by user for easy lookup in the admin view
        const achievementsByUser = allUserAchievements[0].reduce((acc, ua) => {
            if (!acc[ua.user_id]) {
                acc[ua.user_id] = new Set();
            }
            acc[ua.user_id].add(ua.achievement_id);
            return acc;
        }, {});

        res.render('admin', {
            users: users[0],
            invites: invites[0],
            serverMetrics,
            achievements: allAchievements[0],
            achievementsByUser
        });
    } catch (error) {
        next(error);
    }
});

// POST /admin/create-user
router.post('/create-user', async (req, res) => {
    const { username, password, permission_level } = req.body;

    if (!username || !password || !permission_level) {
        req.flash('error', 'Username, password, and permission level are required.');
        return res.redirect('/admin');
    }

    try {
        const [existing] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            req.flash('error', 'A user with that username already exists.');
            return res.redirect('/admin');
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await db.execute(
            'INSERT INTO users (username, password, permission_level) VALUES (?, ?, ?)',
            [username, hashedPassword, parseInt(permission_level, 10)]
        );
        req.flash('success', `User '${username}' created successfully.`);
        res.redirect('/admin');
    } catch (error) {
        console.error('Create user error:', error);
        req.flash('error', 'An error occurred while creating the user.');
        res.redirect('/admin');
    }
});

// POST /admin/generate-invite
router.post('/generate-invite', async (req, res) => {
    const adminUserId = req.session.user.id;
    try {
        const newCode = uuidv4();
        await db.execute(
            'INSERT INTO invite_codes (code, created_by_user_id) VALUES (?, ?)',
            [newCode, adminUserId]
        );
        req.flash('success', 'New invite code generated.');
        res.redirect('/admin');
    } catch (error) {
        console.error('Admin invite generation error:', error);
        req.flash('error', 'Failed to generate invite code.');
        res.redirect('/admin');
    }
});

// POST /admin/delete-invite/:id
router.post('/delete-invite/:id', async (req, res) => {
    const inviteId = req.params.id;
    try {
        await db.execute('DELETE FROM invite_codes WHERE id = ?', [inviteId]);
        req.flash('success', 'Invite code has been deleted.');
        res.redirect('/admin');
    } catch (error) {
        console.error('Delete invite error:', error);
        req.flash('error', 'Failed to delete invite code.');
        res.redirect('/admin');
    }
});

// NEW: Grant an achievement to a user
router.post('/grant-achievement', async (req, res) => {
    const { userId, achievementId } = req.body;
    try {
        await db.execute(
            'INSERT IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
            [userId, achievementId]
        );
        req.flash('success', 'Achievement granted.');
    } catch (error) {
        console.error('Error granting achievement:', error);
        req.flash('error', 'Failed to grant achievement.');
    }
    res.redirect('/admin');
});

// NEW: Revoke an achievement from a user
router.post('/revoke-achievement', async (req, res) => {
    const { userId, achievementId } = req.body;
    try {
        await db.execute(
            'DELETE FROM user_achievements WHERE user_id = ? AND achievement_id = ?',
            [userId, achievementId]
        );
        req.flash('success', 'Achievement revoked.');
    } catch (error) {
        console.error('Error revoking achievement:', error);
        req.flash('error', 'Failed to revoke achievement.');
    }
    res.redirect('/admin');
});

// POST /admin/purge-cache
router.post('/purge-cache', (req, res) => {
    cache.clear();
    req.flash('success', 'Server cache has been successfully purged.');
    res.redirect('/admin');
});

// POST /admin/edit-user/:id
router.post('/edit-user/:id', async (req, res) => {
    const userIdToEdit = req.params.id;
    const { permission_level } = req.body;
    const permLevelInt = parseInt(permission_level, 10);

    if (parseInt(userIdToEdit, 10) === req.session.user.id) {
        req.flash('error', 'You cannot change your own permission level.');
        return res.redirect('/admin');
    }

    if (![0, 1, 5].includes(permLevelInt)) {
        req.flash('error', 'Invalid permission level selected.');
        return res.redirect('/admin');
    }

    try {
        await db.execute('UPDATE users SET permission_level = ? WHERE id = ?', [permLevelInt, userIdToEdit]);
        req.flash('success', 'User permissions updated.');
        res.redirect('/admin');
    } catch (error) {
        console.error('Edit user error:', error);
        req.flash('error', 'An error occurred while updating user.');
        res.redirect('/admin');
    }
});

// POST /admin/delete-user/:id
router.post('/delete-user/:id', async (req, res) => {
    const userIdToDelete = req.params.id;

    if (parseInt(userIdToDelete, 10) === req.session.user.id) {
        req.flash('error', 'You cannot delete your own account.');
        return res.redirect('/admin');
    }

    try {
        await db.execute('DELETE FROM users WHERE id = ?', [userIdToDelete]);
        req.flash('success', 'User has been deleted.');
        res.redirect('/admin');
    } catch (error) {
        console.error('Delete user error:', error);
        req.flash('error', 'An error occurred while deleting user.');
        res.redirect('/admin');
    }
});

module.exports = router;