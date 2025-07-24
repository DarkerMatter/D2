// routes/admin.js
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

const router = express.Router();
const saltRounds = 10;

// Protect all admin routes
router.use(isAuthenticated, isAdmin);

// GET /admin - Show admin panel with user list
router.get('/', async (req, res) => {
    try {
        const [users] = await db.execute('SELECT id, username, permission_level, total_rage FROM users');
        res.render('admin', { users, error: null, success: null });
    } catch (error) {
        console.error('Admin panel error:', error);
        res.status(500).send('Server error.');
    }
});

// POST /admin/create-user
router.post('/create-user', async (req, res) => {
    const { username, password, permission_level } = req.body;

    if (!username || !password || !permission_level) {
        const [users] = await db.execute('SELECT id, username, permission_level, total_rage FROM users');
        return res.render('admin', { users, error: 'All fields are required.', success: null });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await db.execute(
            'INSERT INTO users (username, password, permission_level) VALUES (?, ?, ?)',
            [username, hashedPassword, parseInt(permission_level, 10)]
        );
        res.redirect('/admin');
    } catch (error) {
        console.error('Create user error:', error);
        const [users] = await db.execute('SELECT id, username, permission_level, total_rage FROM users');
        res.render('admin', { users, error: 'Username might already exist.', success: null });
    }
});

// POST /admin/edit-user/:id - Update a user's permission level
router.post('/edit-user/:id', async (req, res) => {
    const userIdToEdit = req.params.id;
    const { permission_level } = req.body;
    const permLevelInt = parseInt(permission_level, 10);

    // Prevent admin from changing their own level
    if (parseInt(userIdToEdit, 10) === req.session.user.id) {
        const [users] = await db.execute('SELECT id, username, permission_level, total_rage FROM users');
        return res.render('admin', { users, error: 'You cannot change your own permission level.', success: null });
    }

    // Validate the permission level value
    if (![0, 1, 5].includes(permLevelInt)) {
        const [users] = await db.execute('SELECT id, username, permission_level, total_rage FROM users');
        return res.render('admin', { users, error: 'Invalid permission level selected.', success: null });
    }

    try {
        await db.execute('UPDATE users SET permission_level = ? WHERE id = ?', [permLevelInt, userIdToEdit]);
        res.redirect('/admin');
    } catch (error) {
        console.error('Edit user error:', error);
        res.status(500).send('Server error while updating user.');
    }
});


// POST /admin/delete-user/:id
router.post('/delete-user/:id', async (req, res) => {
    const userIdToDelete = req.params.id;

    // Prevent admin from deleting themselves
    if (parseInt(userIdToDelete, 10) === req.session.user.id) {
        const [users] = await db.execute('SELECT id, username, permission_level, total_rage FROM users');
        return res.render('admin', { users, error: 'You cannot delete your own account.', success: null });
    }

    try {
        await db.execute('DELETE FROM users WHERE id = ?', [userIdToDelete]);
        res.redirect('/admin');
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).send('Server error.');
    }
});

module.exports = router;