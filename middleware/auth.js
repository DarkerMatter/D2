/**
 * @file auth.js
 * @description This file contains authentication and authorization middleware for the application.
 * It ensures that users are logged in and have the correct permissions to access routes.
 */

const db = require('../db');

/**
 * Middleware to ensure a user is authenticated.
 *
 * This function performs a live check against the database on every request to a protected route.
 * It verifies that:
 *  1. A user ID exists in the session.
 *  2. The user account still exists in the database.
 *  3. The user account is not suspended (permission_level !== 0).
 *
 * If all checks pass, it refreshes the session data with the latest from the database
 * and attaches the user object to `req.user` for easy access in subsequent route handlers.
 *
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The Express next middleware function.
 */
async function isAuthenticated(req, res, next) {
    // 1. Check if a user ID exists in the session.
    if (!req.session.user || !req.session.user.id) {
        req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'You must be logged in to view this page.' }));
        return res.redirect('/login');
    }

    try {
        // 2. Fetch the latest user data from the database for a live status check.
        const [rows] = await db.execute('SELECT id, username, permission_level FROM users WHERE id = ?', [req.session.user.id]);

        // 3. Handle the case where the user has been deleted.
        if (rows.length === 0) {
            req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'Your account could not be found. Please log in again.' }));
            // Destroy the invalid session completely.
            return req.session.destroy(() => {
                res.redirect('/login');
            });
        }

        const user = rows[0];

        // 4. Handle the case where the user has been suspended.
        if (user.permission_level === 0) {
            req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'Your account has been suspended.' }));
            // Destroy the session for the suspended user.
            return req.session.destroy(() => {
                res.redirect('/login');
            });
        }

        // 5. The user is valid and active. Refresh session data and proceed.
        req.session.user = {
            id: user.id,
            username: user.username,
            permission_level: user.permission_level
        };

        // Attach the full user object to the request for convenience in route handlers.
        req.user = user;

        return next();

    } catch (error) {
        // 6. Handle unexpected database or server errors.
        console.error('Authentication middleware error:', error);
        // Pass the error to the global error handler to display a proper error page.
        return next(error);
    }
}

/**
 * Middleware to ensure a user is an administrator.
 * This middleware should always be placed *after* the isAuthenticated middleware in a route definition.
 *
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The Express next middleware function.
 */
function isAdmin(req, res, next) {
    // The `isAuthenticated` middleware has already run and refreshed `req.session.user`.
    if (req.session.user && req.session.user.permission_level === 5) {
        return next(); // User is an admin, proceed.
    }

    // User is not an admin. Show an error and redirect to their dashboard.
    req.flash('toast_notification', JSON.stringify({ type: 'error', message: 'You do not have permission to access this resource.' }));
    res.redirect('/dashboard');
}

module.exports = { isAuthenticated, isAdmin };