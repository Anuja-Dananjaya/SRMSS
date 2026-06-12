const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');
const { depotWhere, sameDepotOrSuperAdmin } = require('../utils/depotScope');

// Get all fuel logs
const getAllFuelLogs = (req, res) => {
  const scope = depotWhere(req, 'f');
  const query = `
    SELECT f.*, d.name AS depotName, v.registrationNo, v.model, s.scheduleDate, r.routeCode
    FROM fuel_logs f
    LEFT JOIN depots d ON f.depotId = d.depotId
    LEFT JOIN vehicles v ON f.vehicleId = v.vehicleId
    LEFT JOIN schedules s ON f.scheduleId = s.scheduleId
    LEFT JOIN routes r ON s.routeId = r.routeId
    WHERE 1=1 ${scope.clause}
    ORDER BY f.date DESC, f.fuelLogId DESC
  `;

  db.query(query, scope.params, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }
    return res.status(200).json({ success: true, fuelLogs: results });
  });
};

// Add fuel log
const addFuelLog = (req, res) => {
  const { vehicleId, scheduleId, fuelAmount, cost, date, odometerReading } = req.body;

  if (!vehicleId || !fuelAmount || !cost || !date) {
    return res.status(400).json({ success: false, message: 'Vehicle, fuel amount, cost and date are required.' });
  }

  db.query('SELECT depotId FROM vehicles WHERE vehicleId = ?', [vehicleId], (vehicleErr, vehicleRows) => {
    if (vehicleErr) return res.status(500).json({ success: false, message: 'Database error.', error: vehicleErr.message });
    if (vehicleRows.length === 0) return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    if (!sameDepotOrSuperAdmin(req, vehicleRows[0].depotId)) {
      return res.status(403).json({ success: false, message: 'Vehicle belongs to another depot.' });
    }

    const depotId = vehicleRows[0].depotId;
  const query = `
    INSERT INTO fuel_logs (depotId, vehicleId, scheduleId, fuelAmount, cost, date, odometerReading)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [
    depotId,
    vehicleId,
    scheduleId || null,
    fuelAmount,
    cost,
    date,
    odometerReading || null
  ], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Failed to create fuel log.', error: err.message });
    }

    // Update vehicle mileage if odometer reading is provided and is greater than current mileage
    if (odometerReading) {
      db.query('SELECT mileage FROM vehicles WHERE vehicleId = ?', [vehicleId], (errSel, results) => {
        if (!errSel && results.length > 0) {
          const currentMileage = Number(results[0].mileage || 0);
          if (Number(odometerReading) > currentMileage) {
            db.query('UPDATE vehicles SET mileage = ? WHERE vehicleId = ?', [odometerReading, vehicleId], (errUpd) => {
              if (errUpd) console.error('Failed to update vehicle mileage:', errUpd);
            });
          }
        }
      });
    }

    logActivity(req.user?.userId, 'CREATE', 'Fuel Logs', `Logged fuel for vehicle ID ${vehicleId} - Cost: Rs. ${cost}`, depotId);

    return res.status(201).json({
      success: true,
      fuelLogId: result.insertId,
      message: 'Fuel log added successfully.'
    });
  });
  });
};

// Delete fuel log
const deleteFuelLog = (req, res) => {
  const { id } = req.params;

  db.query('SELECT * FROM fuel_logs WHERE fuelLogId = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Fuel log not found.' });
    if (!sameDepotOrSuperAdmin(req, results[0].depotId)) {
      return res.status(403).json({ success: false, message: 'Fuel log belongs to another depot.' });
    }

    db.query('DELETE FROM fuel_logs WHERE fuelLogId = ?', [id], (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete fuel log.', error: err.message });
      }

      logActivity(req.user?.userId, 'DELETE', 'Fuel Logs', `Deleted fuel log ID ${id}`, results[0].depotId);

      return res.status(200).json({ success: true, message: 'Fuel log deleted successfully.' });
    });
  });
};

module.exports = {
  getAllFuelLogs,
  addFuelLog,
  deleteFuelLog
};
