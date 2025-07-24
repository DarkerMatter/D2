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
const leaderboardRoutes = require('./routes/leaderboard');
const { getLeaderboardData } = require('./services/leaderboardService');


const app = express();
const PORT = process.env.PORT || 3000;

// --- Trust the Nginx reverse proxy ---
// This is the key to making the whole system work.
// It allows Express to correctly determine if a connection is secure.
app.set('trust proxy', 1);

// --- Diagnostic Middleware ---
// This is helpful for debugging on the production server.
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

// --- FIX: Simplified and Robust Session Setup ---
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // The `proxy` setting ensures that the 'secure' cookie setting will be
    // determined by the X-Forwarded-Proto header.
    proxy: true,
    cookie: {
        // By REMOVING the 'secure' property, it defaults to 'auto'.
        // 'auto' sets secure=true if req.secure is true (behind a trusted HTTPS proxy)
        // and secure=false otherwise (local HTTP development). This is exactly what you need.
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// --- Flash and Locals Middleware ---
app.use(flash());
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// --- Routes ---
app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/account', accountRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/leaderboard', leaderboardRoutes); // 2. Use the new route


// Root route now always renders the home page.
app.get('/', async (req, res, next) => {
    try {
        // --- FIX: Add headers to prevent browser caching ---
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        // ----------------------------------------------------

        // Get data from our service (it will be cached)
        const { rageLeaders } = await getLeaderboardData();
        // The top rager is just the first person in the list
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