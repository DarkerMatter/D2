// routes/app.js
const express = require('express');
const bcrypt = require('bcrypt'); // Added for password hashing
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Page 1: Dashboard (unchanged)
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [userRows] = await db.execute('SELECT total_rage FROM users WHERE id = ?', [userId]);
    const totalRage = userRows[0]?.total_rage ?? 0;
    const [statsRows] = await db.execute('SELECT AVG(rage_level) as averageRage FROM rage_logs WHERE user_id = ?', [userId]);
    const stats = statsRows[0];
    const [phraseRows] = await db.execute(
        `SELECT rage_phrase as mostCommonPhrase, COUNT(rage_phrase) as phrase_count
         FROM rage_logs
         WHERE user_id = ?
         GROUP BY rage_phrase
         ORDER BY phrase_count DESC
           LIMIT 1`,
        [userId]
    );
    const mostCommonPhrase = phraseRows[0]?.mostCommonPhrase ?? 'N/A';
    res.render('index', {
      totalRage,
      averageRage: stats.averageRage ? parseFloat(stats.averageRage).toFixed(1) : 'N/A',
      mostCommonPhrase
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Server error.');
  }
});

// Handle rage submission (unchanged)
router.post('/rage', isAuthenticated, async (req, res) => {
  const { rageLevel, ragePhrase } = req.body;
  const rageToAdd = parseInt(rageLevel, 10);
  const userId = req.session.user.id;
  if (isNaN(rageToAdd) || rageToAdd < 1 || rageToAdd > 10 || !ragePhrase) {
    return res.status(400).send('Invalid rage level or phrase.');
  }
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    await connection.execute('UPDATE users SET total_rage = total_rage + ? WHERE id = ?', [rageToAdd, userId]);
    await connection.execute('INSERT INTO rage_logs (user_id, rage_level, rage_phrase) VALUES (?, ?, ?)', [userId, rageToAdd, ragePhrase]);
    await connection.commit();
    res.redirect('/dashboard?updated=true');
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Rage update error:', error);
    res.status(500).send('Server error while submitting rage.');
  } finally {
    if (connection) connection.release();
  }
});

// --- NEW SETTINGS ROUTES ---

// GET /settings - Show the settings page
router.get('/settings', isAuthenticated, (req, res) => {
  // Pass query params as messages to the view for feedback
  res.render('settings', {
    error: req.query.error,
    success: req.query.success
  });
});

// POST /settings/change-password - Handle password change
router.post('/settings/change-password', isAuthenticated, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.session.user.id;

  if (!currentPassword || !newPassword) {
    return res.redirect('/settings?error=All fields are required.');
  }
  if (newPassword.length < 8) {
    return res.redirect('/settings?error=New password must be at least 8 characters long.');
  }

  try {
    const [rows] = await db.execute('SELECT password FROM users WHERE id = ?', [userId]);
    const match = await bcrypt.compare(currentPassword, rows[0].password);

    if (!match) {
      return res.redirect('/settings?error=Incorrect current password.');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);

    res.redirect('/settings?success=Password changed successfully.');
  } catch (error) {
    console.error('Password change error:', error);
    res.redirect('/settings?error=A server error occurred.');
  }
});

// POST /settings/delete-history - Handle deleting all of a user's rage logs
router.post('/settings/delete-history', isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Delete all logs for the user
    await connection.execute('DELETE FROM rage_logs WHERE user_id = ?', [userId]);
    // 2. Reset the total_rage counter in the users table
    await connection.execute('UPDATE users SET total_rage = 0 WHERE id = ?', [userId]);

    await connection.commit();
    res.redirect('/settings?success=Your rage history has been deleted.');
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Delete history error:', error);
    res.redirect('/settings?error=A server error occurred while deleting your history.');
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;