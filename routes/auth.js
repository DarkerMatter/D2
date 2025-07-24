// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
// const rateLimit = require('express-rate-limit'); // REMOVED
const db = require('../db');

const router = express.Router();
const saltRounds = 10;

// REMOVED the loginLimiter constant

// GET /login - Show login page
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('login', { error: null });
});

// POST /login - Handle login attempt
router.post('/login', async (req, res) => { // REMOVED loginLimiter from middleware
    const { username, password } = req.body;

    if (!username || !password) {
        return res.render('login', { error: 'Please provide username and password.' });
    }

    try {
        // SQL INJECTION SAFE: Using parameterized queries
        const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];

        if (!user) {
            return res.render('login', { error: 'Invalid username or password.' });
        }

        const match = await bcrypt.compare(password, user.password);

        if (match) {
            // Passwords match, create session
            if (user.permission_level === 0) {
                return res.render('login', { error: 'This account has been suspended.' });
            }
            req.session.user = {
                id: user.id,
                username: user.username,
                permission_level: user.permission_level
            };
            res.redirect('/dashboard');
        } else {
            // Passwords don't match
            res.render('login', { error: 'Invalid username or password.' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send('Server error during login.');
    }
});

// GET /logout
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/dashboard');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

module.exports = router;