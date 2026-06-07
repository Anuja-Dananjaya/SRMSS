const db = require('../config/db');

// Helper: get driverId from logged‑in user
const getDriverId = (req) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT driverId FROM drivers WHERE userId = ?';
    db.query(sql, [req.user.userId], (err, results) => {
      if (err) return reject(err);
      if (!results.length) return reject(new Error('Driver record not found'));
      resolve(results[0].driverId);
    });
  });
};

// 1️⃣ List today's routes for the driver
exports.listRoutes = async (req, res) => {
  try {
    const driverId = await getDriverId(req);
    const sql = `
      SELECT s.scheduleId, r.routeCode, r.startPoint, r.endPoint,
             v.registrationNo AS vehicle, s.departureTime, s.arrivalTime,
             s.status
      FROM schedules s
      JOIN routes r   ON s.routeId = r.routeId
      JOIN vehicles v ON s.vehicleId = v.vehicleId
      WHERE s.driverId = ? AND s.scheduleDate = CURDATE()
      ORDER BY s.departureTime;`;
    db.query(sql, [driverId], (err, rows) => {
      if (err) return res.status(500).json({ message: 'DB error', error: err.message });
      res.json({ routes: rows });
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// 2️⃣ Search routes (by driver name or start point)
exports.searchRoutes = (req, res) => {
  const { driverName, startPoint } = req.query;
  const conditions = [];
  const params = [];
  if (driverName) {
    conditions.push('u.name LIKE ?');
    params.push(`%${driverName}%`);
  }
  if (startPoint) {
    conditions.push('r.startPoint LIKE ?');
    params.push(`%${startPoint}%`);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT s.scheduleId, u.name AS driverName, r.routeCode,
           r.startPoint, r.endPoint, v.registrationNo AS vehicle,
           s.departureTime, s.arrivalTime, s.status
    FROM schedules s
    JOIN routes r   ON s.routeId = r.routeId
    JOIN vehicles v ON s.vehicleId = v.vehicleId
    JOIN drivers d  ON s.driverId = d.driverId
    JOIN users u    ON d.userId = u.userId
    ${whereClause}
    ORDER BY s.departureTime;`;
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB error', error: err.message });
    res.json({ routes: rows });
  });
};

// 3️⃣ Start route – set schedule status to 'ongoing' and vehicle inactive
exports.startRoute = (req, res) => {
  const { scheduleId } = req.params;
  const sql = `
    UPDATE schedules SET status = 'ongoing', actualDeparture = NOW()
    WHERE scheduleId = ?;
    UPDATE vehicles SET status = 'inactive'
    WHERE vehicleId = (SELECT vehicleId FROM schedules WHERE scheduleId = ?);
  `;
  db.query(sql, [scheduleId, scheduleId], (err, result) => {
    if (err) return res.status(500).json({ message: 'DB error', error: err.message });
    res.json({ message: 'Route started, vehicle set to inactive' });
  });
};

// 4️⃣ End route – set schedule status to 'completed' and vehicle active
exports.endRoute = (req, res) => {
  const { scheduleId } = req.params;
  const sql = `
    UPDATE schedules SET status = 'completed', actualArrival = NOW()
    WHERE scheduleId = ?;
    UPDATE vehicles SET status = 'active'
    WHERE vehicleId = (SELECT vehicleId FROM schedules WHERE scheduleId = ?);
  `;
  db.query(sql, [scheduleId, scheduleId], (err, result) => {
    if (err) return res.status(500).json({ message: 'DB error', error: err.message });
    res.json({ message: 'Route completed, vehicle set to active' });
  });
};
// 5️⃣ Create schedule (admin only)
exports.createSchedule = (req, res) => {
  const { driverId, routeId, vehicleId, scheduleDate, departureTime, arrivalTime } = req.body;
  if (!driverId || !routeId || !vehicleId || !scheduleDate) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }
  const sql = `
    INSERT INTO schedules (driverId, routeId, vehicleId, scheduleDate, departureTime, arrivalTime, status)
    VALUES (?, ?, ?, ?, ?, ?, 'scheduled')
  `;
  db.query(sql, [driverId, routeId, vehicleId, scheduleDate, departureTime || '08:00:00', arrivalTime || '17:00:00'], (err, result) => {
    if (err) return res.status(500).json({ message: 'DB error', error: err.message });
    res.status(201).json({ message: 'Schedule created', scheduleId: result.insertId });
  });
};

// 6️⃣ Update schedule (admin only)
exports.updateSchedule = (req, res) => {
  const { scheduleId } = req.params;
  const { driverId, routeId, vehicleId, scheduleDate, departureTime, arrivalTime, status } = req.body;
  const fields = [];
  const values = [];
  if (driverId) { fields.push('driverId = ?'); values.push(driverId); }
  if (routeId) { fields.push('routeId = ?'); values.push(routeId); }
  if (vehicleId) { fields.push('vehicleId = ?'); values.push(vehicleId); }
  if (scheduleDate) { fields.push('scheduleDate = ?'); values.push(scheduleDate); }
  if (departureTime) { fields.push('departureTime = ?'); values.push(departureTime); }
  if (arrivalTime) { fields.push('arrivalTime = ?'); values.push(arrivalTime); }
  if (status) { fields.push('status = ?'); values.push(status); }
  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update.' });
  }
  const sql = `UPDATE schedules SET ${fields.join(', ')} WHERE scheduleId = ?`;
  values.push(scheduleId);
  db.query(sql, values, (err) => {
    if (err) return res.status(500).json({ message: 'DB error', error: err.message });
    res.json({ message: 'Schedule updated' });
  });
};

// 7️⃣ Delete schedule (soft delete, admin only)
exports.deleteSchedule = (req, res) => {
  const { scheduleId } = req.params;
  const sql = `UPDATE schedules SET status = 'cancelled' WHERE scheduleId = ?`;
  db.query(sql, [scheduleId], (err) => {
    if (err) return res.status(500).json({ message: 'DB error', error: err.message });
    res.json({ message: 'Schedule cancelled' });
  });
};

module.exports = {
  listRoutes,
  searchRoutes,
  startRoute,
  endRoute,
  createSchedule,
  updateSchedule,
  deleteSchedule
};
