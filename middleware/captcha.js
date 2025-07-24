// middleware/captcha.js

// FIX: Removed `require('node-fetch')` as we will use the globally available fetch API.

async function verifyCaptcha(req, res, next) {
    const token = req.body['cf-turnstile-response'];
    const ip = req.ip;

    if (!token) {
        req.flash('error', 'CAPTCHA validation failed. Please try again.');
        // Redirect back to the form page.
        return res.redirect(req.originalUrl.includes('login') ? '/login' : '/register');
    }

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v2/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: process.env.CF_TURNSTILE_SECRET_KEY,
                response: token,
                remoteip: ip,
            }),
        });

        const data = await response.json();

        if (data.success) {
            return next(); // CAPTCHA was successful
        } else {
            console.warn('CAPTCHA verification failed:', data['error-codes']);
            req.flash('error', 'Failed to verify you are human. Please try again.');
            return res.redirect(req.originalUrl.includes('login') ? '/login' : '/register');
        }
    } catch (error) {
        console.error('Error verifying CAPTCHA:', error);
        req.flash('error', 'An error occurred during CAPTCHA verification.');
        return res.redirect(req.originalUrl.includes('login') ? '/login' : '/register');
    }
}

module.exports = { verifyCaptcha };