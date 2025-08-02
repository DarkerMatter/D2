// index.js
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const accountRoutes = require('./routes/account');
const dashboardRoutes = require('./routes/dashboard');
const sessionRoutes = require('./routes/session'); // Import the session router
const leaderboardRoutes = require('./routes/leaderboard');
const { getLeaderboardData } = require('./services/leaderboardService');


const app = express();
const PORT = process.env.PORT || 3000;

// --- Trust the Nginx reverse proxy ---
app.set('trust proxy', 1);

// --- Diagnostic Middleware ---
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.path === '/login' || req.path === '/register') {
            console.log('--- PROXY DIAGNOSTIC HEADERS ---');
            console.log(`Host: ${req.headers['host']}`);
            console.log(`X-Forwarded-For: ${req.headers['x-forwarded-for']}`);
            console.log(`X-Forwarded-Proto: ${req.headers['x-forwarded-proto']}`);
            console.log(`Is connection secure? (req.secure): ${req.secure}`);
            console.log('--------------------------------');
        }
        next();
    });
}

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- View Engine Setup ---
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// --- Session Setup ---
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// --- Flash and Locals Middleware ---
app.use(flash());
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.messages = req.flash();
    next();
});

// --- Routes ---
app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/account', accountRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/session', sessionRoutes); // Mount the session router
app.use('/leaderboard', leaderboardRoutes);


// Root route now always renders the home page.
app.get('/', async (req, res, next) => {
    try {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const { rageLeaders } = await getLeaderboardData();
        const topRager = rageLeaders.length > 0 ? rageLeaders[0] : null;

        res.render('home', { topRager });
    } catch (error) {
        next(error);
    }
});


// --- 404 Not Found Handler ---
app.use((req, res, next) => {
    res.status(404).render('error', {
        title: 'Page Not Found',
        message: "Sorry, we couldn't find the page you were looking for."
    });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error('Global Error Handler caught:', err.stack);
    res.status(err.status || 500).render('error', {
        title: 'Server Error',
        message: 'Something went wrong on our end. Please try again later.'
    });
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});