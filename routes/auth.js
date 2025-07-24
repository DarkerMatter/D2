// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { verifyCaptcha } = require('../middleware/captcha');
const { sendVerificationEmail } = require('../utils/mailer');

const router = express.Router();
const saltRounds = 10;

// --- Registration Routes ---
router.get('/register', (req, res) => {
    res.render('register', { siteKey: process.env.CF_TURNSTILE_SITE_KEY });
});

router.post('/register', verifyCaptcha, async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password || password.length < 8) {
        req.flash('error', 'All fields are required and password must be at least 8 characters.');
        return res.redirect('/register');
    }

    try {
        const [existingUser] = await db.execute('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existingUser.length > 0) {
            req.flash('error', 'A user with that username or email already exists.');
            return res.redirect('/register');
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const verificationToken = uuidv4();

        await db.execute(
            'INSERT INTO users (username, email, password, email_verification_token) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, verificationToken]
        );

        await sendVerificationEmail(email, verificationToken);

        res.render('verification-pending', { email });

    } catch (error) {
        console.error('Registration error:', error);
        req.flash('error', 'A server error occurred during registration.');
        res.redirect('/register');
    }
});

// --- Email Verification Route ---
router.get('/verify-email', async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).send('Verification token is missing.');
    }

    try {
        const [userRows] = await db.execute('SELECT id FROM users WHERE email_verification_token = ?', [token]);
        if (userRows.length === 0) {
            return res.render('error', { title: 'Invalid Token', message: 'This verification link is invalid or has already been used.' });
        }

        const userId = userRows[0].id;
        await db.execute(
            'UPDATE users SET email_verified_at = NOW(), email_verification_token = NULL WHERE id = ?',
            [userId]
        );

        res.render('verification-success');

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).send('A server error occurred.');
    }
});

// --- Login/Logout Routes ---
router.get('/login', (req, res) => {
    res.render('login', { siteKey: process.env.CF_TURNSTILE_SITE_KEY });
});

router.post('/login', verifyCaptcha, async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            req.flash('error', 'Invalid username or password.');
            return res.redirect('/login');
        }

        const user = rows[0];

        // IMPORTANT: Check if email is verified
        if (!user.email_verified_at) {
            req.flash('error', 'You must verify your email address before you can log in.');
            return res.redirect('/login');
        }

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = {
                id: user.id,
                username: user.username,
                permission_level: user.permission_level
            };
            res.redirect('/dashboard');
        } else {
            req.flash('error', 'Invalid username or password.');
            res.redirect('/login');
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send('Server error.');
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/dashboard');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

module.exports = router;