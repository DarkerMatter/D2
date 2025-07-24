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
        // FIX: Select email and verification status to display in the panel
        const [users] = await db.execute('SELECT id, username, email, permission_level, email_verified_at FROM users ORDER BY created_at DESC');
        res.render('admin', { users }); // Flash messages are handled by global middleware
    } catch (error) {
        console.error('Admin panel error:', error);
        req.flash('error', 'Failed to load admin panel.');
        res.redirect('/dashboard');
    }
});

// POST /admin/create-user
router.post('/create-user', async (req, res) => {
    // FIX: Add email to the creation process
    const { username, email, password, permission_level } = req.body;

    if (!username || !email || !password || !permission_level) {
        req.flash('error', 'All fields are required to create a user.');
        return res.redirect('/admin');
    }

    try {
        // Check if user already exists
        const [existing] = await db.execute('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existing.length > 0) {
            req.flash('error', 'A user with that username or email already exists.');
            return res.redirect('/admin');
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        // FIX: Add email to the INSERT statement and auto-verify the account
        await db.execute(
            'INSERT INTO users (username, email, password, permission_level, email_verified_at) VALUES (?, ?, ?, ?, NOW())',
            [username, email, hashedPassword, parseInt(permission_level, 10)]
        );
        req.flash('success', `User '${username}' created successfully.`);
        res.redirect('/admin');
    } catch (error) {
        console.error('Create user error:', error);
        req.flash('error', 'An error occurred while creating the user.');
        res.redirect('/admin');
    }
});

// NEW: POST /admin/verify-user/:id - Manually verify a user's email
router.post('/verify-user/:id', async (req, res) => {
    const userIdToVerify = req.params.id;
    try {
        await db.execute('UPDATE users SET email_verified_at = NOW(), email_verification_token = NULL WHERE id = ?', [userIdToVerify]);
        req.flash('success', 'User has been manually verified.');
        res.redirect('/admin');
    } catch (error) {
        console.error('Manual verification error:', error);
        req.flash('error', 'Failed to verify user.');
        res.redirect('/admin');
    }
});


// POST /admin/edit-user/:id - Update a user's permission level
router.post('/edit-user/:id', async (req, res) => {
    const userIdToEdit = req.params.id;
    const { permission_level } = req.body;
    const permLevelInt = parseInt(permission_level, 10);

    // Prevent admin from changing their own level
    if (parseInt(userIdToEdit, 10) === req.session.user.id) {
        req.flash('error', 'You cannot change your own permission level.');
        return res.redirect('/admin');
    }

    // Validate the permission level value
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

    // Prevent admin from deleting themselves
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