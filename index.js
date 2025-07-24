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


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View Engine Setup
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Session Setup
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Set to true in production
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// INITIALIZE connect-flash
app.use(flash());

// Global middleware to make user and flash messages available in all views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// Routes
app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/account', accountRoutes);
app.use('/dashboard', dashboardRoutes);


// FIX: Root route now always renders the home page.
app.get('/', (req, res) => {
    // The user object is passed to all templates via middleware,
    // so the home page can adapt its content if the user is logged in.
    res.render('home');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});