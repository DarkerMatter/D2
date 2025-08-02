// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();
const saltRounds = 10;

// --- Registration Routes ---
router.get('/register', (req, res) => {
    res.render('register');
});

// Complete overhaul of the registration logic for an invite-only system
router.post('/register', async (req, res, next) => {
    const { username, password, invite_code } = req.body;

    if (!username || !password || !invite_code) {
        req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'Username, password, and a valid invite code are required.' }));
        return res.redirect('/register');
    }
    if (password.length < 8) {
        req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'Password must be at least 8 characters long.' }));
        return res.redirect('/register');
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Validate the invite code
        const [codes] = await connection.execute(
            'SELECT id, used_by_user_id FROM invite_codes WHERE code = ? FOR UPDATE',
            [invite_code]
        );

        if (codes.length === 0) {
            req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'Invalid invite code.' }));
            await connection.rollback();
            return res.redirect('/register');
        }

        const invite = codes[0];
        if (invite.used_by_user_id) {
            req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'This invite code has already been used.' }));
            await connection.rollback();
            return res.redirect('/register');
        }

        // 2. Check if username is already taken
        const [existingUsers] = await connection.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUsers.length > 0) {
            req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'That username is already taken.' }));
            await connection.rollback();
            return res.redirect('/register');
        }

        // 3. Create the new user
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const [result] = await connection.execute(
            'INSERT INTO users (username, password, permission_level) VALUES (?, ?, ?)',
            [username, hashedPassword, 1] // Default permission level is 1 (User)
        );
        const newUserId = result.insertId;

        // 4. Mark the invite code as used
        await connection.execute(
            'UPDATE invite_codes SET used_by_user_id = ?, used_at = NOW() WHERE id = ?',
            [newUserId, invite.id]
        );

        await connection.commit();

        // 5. Automatically log the new user in
        req.session.user = {
            id: newUserId,
            username: username,
            permission_level: 1
        };
        req.session.save((err) => {
            if (err) {
                return next(err);
            }
            req.flash('toast_notification', JSON.stringify({ type: 'success', message: 'Welcome! Your account has been created.' }));
            res.redirect('/dashboard');
        });

    } catch (error) {
        if (connection) await connection.rollback();
        next(error); // Pass to global error handler
    } finally {
        if (connection) connection.release();
    }
});

// --- Login/Logout Routes ---
router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/login', async (req, res, next) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'Invalid username or password.' }));
            return res.redirect('/login');
        }

        const user = rows[0];

        if (user.permission_level === 0) {
            req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'This account has been suspended.' }));
            return res.redirect('/login');
        }

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = {
                id: user.id,
                username: user.username,
                email: user.email, // Keep email in session if it exists
                permission_level: user.permission_level
            };
            req.session.save((err) => {
                if (err) {
                    return next(err);
                }
                res.redirect('/dashboard');
            });
        } else {
            req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'Invalid username or password.' }));
            res.redirect('/login');
        }
    } catch (error) {
        next(error);
    }
});

router.get('/logout', (req, res, next) => {
    req.session.destroy(err => {
        if (err) {
            return next(err);
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

module.exports = router;