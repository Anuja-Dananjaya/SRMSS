const db = require('../config/db');
const { depotWhere } = require('../utils/depotScope');

const getActivityLogs = (req, res) => {
  const scope = depotWhere(req, 'a');
  const query = `
    SELECT a.*, d.name AS depotName, u.name as userName, u.email as userEmail
    FROM activity_logs a
    LEFT JOIN depots d ON a.depotId = d.depotId
    LEFT JOIN users u ON a.userId = u.userId
    WHERE 1=1 ${scope.clause}
    ORDER BY a.createdAt DESC
    LIMIT 200
  `;

  db.query(query, scope.params, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }
    return res.status(200).json({ success: true, activities: results });
  });
};

module.exports = { getActivityLogs };
