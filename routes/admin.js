// routes/admin.js
const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid'); // Import UUID
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const cache = require('../utils/cache');

const router = express.Router();
const saltRounds = 10;

// Protect all admin routes
router.use(isAuthenticated, isAdmin);

// GET /admin - Show admin panel with user list and invite codes
router.get('/', async (req, res, next) => {
    try {
        // Fetch all users (without email)
        const [users] = await db.execute('SELECT id, username, permission_level FROM users ORDER BY created_at DESC');

        // Fetch all invite codes with creator and user info
        const [invites] = await db.execute(`
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
        `);

        res.render('admin', { users, invites });
    } catch (error) {
        next(error);
    }
});

// POST /admin/create-user
router.post('/create-user', async (req, res) => {
    // FIX: Email field completely removed
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
        // FIX: INSERT query no longer includes email
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

// NEW: POST /admin/generate-invite
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

// NEW: POST /admin/delete-invite/:id
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