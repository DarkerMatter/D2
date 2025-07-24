// middleware/auth.js
const db = require('../db'); // We need the database connection here

/**
 * Middleware to ensure a user is authenticated and their account is active.
 * This function performs a live check against the database on every request
 * to a protected route, ensuring that status changes (like bans) are
 * reflected immediately.
 */
async function isAuthenticated(req, res, next) {
    // 1. Check if a user ID exists in the session
    if (!req.session.user || !req.session.user.id) {
        req.flash('error', 'You must be logged in to view this page.');
        return res.redirect('/login');
    }

    try {
        // 2. Fetch the latest user data from the database
        const [rows] = await db.execute('SELECT id, username, permission_level FROM users WHERE id = ?', [req.session.user.id]);

        // 3. Check if the user still exists (they might have been deleted)
        if (rows.length === 0) {
            // FIX: Set flash message, then clear user data from the session and save.
            // This preserves the session just long enough to show the flash message.
            req.flash('error', 'Your account could not be found.');
            req.session.user = null;
            return req.session.save(err => {
                if (err) return next(err); // Pass error to Express
                res.redirect('/login');
            });
        }

        const user = rows[0];

        // 4. Check if the user has been banned
        if (user.permission_level === 0) {
            // FIX: Same logic as above for banned users.
            req.flash('error', 'Your account has been suspended.');
            req.session.user = null;
            return req.session.save(err => {
                if (err) return next(err); // Pass error to Express
                res.redirect('/login');
            });
        }

        // 5. User is valid and active. Refresh session data and proceed.
        req.session.user = {
            id: user.id,
            username: user.username,
            permission_level: user.permission_level
        };

        // Also attach user to the request object for easy access in routes
        req.user = user;

        return next();

    } catch (error) {
        console.error('Authentication middleware error:', error);
        req.flash('error', 'A server error occurred. Please try again.');
        return res.redirect('/login');
    }
}

/**
 * Middleware to ensure a user is an administrator.
 * This should always be used *after* isAuthenticated.
 */
function isAdmin(req, res, next) {
    // This check is now more reliable because isAuthenticated has refreshed the session
    if (req.session.user && req.session.user.permission_level === 5) {
        return next();
    }
    req.flash('error', 'You do not have permission to access this resource.');
    res.redirect('/dashboard');
}

module.exports = { isAuthenticated, isAdmin };