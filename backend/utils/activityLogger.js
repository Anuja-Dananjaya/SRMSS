const db = require('../config/db');

const logActivity = (userId, action, module, description) => {
  if (!userId) return;
  const query = 'INSERT INTO activity_logs (userId, action, module, description) VALUES (?, ?, ?, ?)';
  db.query(query, [userId, action, module, description || ''], (err) => {
    if (err) {
      console.error('Error logging activity:', err);
    }
  });
};

module.exports = { logActivity };
