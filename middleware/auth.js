// middleware/auth.js
const db = require('../db'); // Import the database connection

/**
 * Checks if a user is authenticated. On every request, it re-fetches the user's
 * data from the database to ensure permissions are always up-to-date.
 */
async function isAuthenticated(req, res, next) {
    // 1. Check if a user session exists at all
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        // 2. Re-fetch the user from the DB using the ID from the session
        const [rows] = await db.execute('SELECT id, username, permission_level FROM users WHERE id = ?', [req.session.user.id]);
        const currentUser = rows[0];

        // 3. Handle cases where the user was deleted from the DB while logged in
        if (!currentUser) {
            return req.session.destroy(() => {
                res.redirect('/login');
            });
        }

        // 4. THIS IS THE "KICK" LOGIC: If permission is 0, they are banned.
        if (currentUser.permission_level === 0) {
            return req.session.destroy(() => {
                res.status(403).render('error', {
                    title: 'Access Denied',
                    message: 'Forbidden: Your account has been suspended.'
                });
            });
        }

        // 5. Keep the session and res.locals fresh with the latest data from the DB
        req.session.user = currentUser;
        res.locals.user = currentUser;

        return next(); // User is valid, proceed to the requested route

    } catch (error) {
        console.error("Error in isAuthenticated middleware:", error);
        return res.status(500).send("Server error during authentication check.");
    }
}

/**
 * Checks if the current user is an admin.
 * This should always run *after* isAuthenticated.
 */
function isAdmin(req, res, next) {
    // isAuthenticated has already run, so we know req.session.user is fresh and valid.
    if (req.session.user.permission_level === 5) {
        return next();
    }
    res.status(403).render('error', {
        title: 'Access Denied',
        message: 'Forbidden: You do not have access to this page.'
    });
}

module.exports = { isAuthenticated, isAdmin };