const db = require('../config/db');

const getActivityLogs = (req, res) => {
  const query = `
    SELECT a.*, u.name as userName, u.email as userEmail
    FROM activity_logs a
    LEFT JOIN users u ON a.userId = u.userId
    ORDER BY a.createdAt DESC
    LIMIT 200
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }
    return res.status(200).json({ success: true, activities: results });
  });
};

module.exports = { getActivityLogs };
