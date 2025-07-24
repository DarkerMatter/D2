// routes/leaderboard.js
const express = require('express');
const { getLeaderboardData } = require('../services/leaderboardService');
const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        // --- FIX: Add headers to prevent browser caching ---
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // HTTP 1.1.
        res.setHeader('Pragma', 'no-cache'); // HTTP 1.0.
        res.setHeader('Expires', '0'); // Proxies.
        // ----------------------------------------------------

        // Just get the data from our service (which handles caching)
        const { rageLeaders, deathLeaders } = await getLeaderboardData();
        res.render('leaderboard', {
            rageLeaders,
            deathLeaders,
            pageTitle: 'Leaderboards'
        });
    } catch (error) {
        // Pass any errors to the global error handler
        next(error);
    }
});

module.exports = router;