const db = require('../config/db');

/**
 * Log an activity performed by a user.
 * @param {number|string} userId - ID of the user performing the action.
 * @param {string} action - CRUD action (CREATE, UPDATE, DELETE, READ).
 * @param {string} module - The module/name where the action occurred.
 * @param {string} description - Human‑readable description of the activity.
 */
function logActivity(userId, action, module, description, depotId = null) {
  if (!userId) return; // silently ignore if not authenticated
  const query = `INSERT INTO activity_logs (depotId, userId, action, module, description) VALUES (?, ?, ?, ?, ?)`;
  db.query(query, [depotId, userId, action, module, description], (err) => {
    if (err) console.error('Failed to log activity:', err);
  });
}

module.exports = { logActivity };
