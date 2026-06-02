const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

// Get all maintenance records
const getAllMaintenance = (req, res) => {
  const query = `
    SELECT m.*, v.registrationNo, v.model
    FROM maintenance m
    LEFT JOIN vehicles v ON m.vehicleId = v.vehicleId
    ORDER BY m.serviceDate DESC, m.maintenanceId DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }
    return res.status(200).json({ success: true, maintenance: results });
  });
};

// Create maintenance record
const createMaintenance = (req, res) => {
  const { vehicleId, maintenanceType, description, cost, serviceDate, nextServiceDue, status } = req.body;

  if (!vehicleId || !maintenanceType || !serviceDate) {
    return res.status(400).json({ success: false, message: 'Vehicle, maintenance type and service date are required.' });
  }

  const query = `
    INSERT INTO maintenance (vehicleId, maintenanceType, description, cost, serviceDate, nextServiceDue, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [
    vehicleId,
    maintenanceType,
    description || null,
    cost || null,
    serviceDate,
    nextServiceDue || null,
    status || 'pending'
  ], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Failed to create maintenance record.', error: err.message });
    }

    const maintenanceId = result.insertId;

    // Auto-update vehicle status to 'maintenance' if pending and repair/emergency
    if (status !== 'completed' && (maintenanceType === 'repair' || maintenanceType === 'emergency')) {
      db.query("UPDATE vehicles SET status = 'maintenance' WHERE vehicleId = ?", [vehicleId], (errUpd) => {
        if (errUpd) console.error('Failed to update vehicle status to maintenance:', errUpd);
      });
    }

    logActivity(req.user?.userId, 'CREATE', 'Maintenance', `Added maintenance record for vehicle ID ${vehicleId}`);

    return res.status(201).json({
      success: true,
      maintenanceId,
      message: 'Maintenance record created successfully.'
    });
  });
};

// Update maintenance record (e.g. mark completed)
const updateMaintenance = (req, res) => {
  const { id } = req.params;
  const { status, cost, description, nextServiceDue } = req.body;

  db.query('SELECT * FROM maintenance WHERE maintenanceId = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Maintenance record not found.' });

    const record = results[0];

    const upStatus = status || record.status;
    const upCost = cost !== undefined ? cost : record.cost;
    const upDescription = description !== undefined ? description : record.description;
    const upNextServiceDue = nextServiceDue !== undefined ? nextServiceDue : record.nextServiceDue;

    const query = `
      UPDATE maintenance 
      SET status = ?, cost = ?, description = ?, nextServiceDue = ?
      WHERE maintenanceId = ?
    `;

    db.query(query, [upStatus, upCost, upDescription, upNextServiceDue, id], (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Failed to update maintenance record.', error: err.message });

      // If status completed, update vehicle status back to 'active' if it is under 'maintenance'
      if (upStatus === 'completed') {
        db.query('SELECT status FROM vehicles WHERE vehicleId = ?', [record.vehicleId], (errVeh, vehResults) => {
          if (!errVeh && vehResults.length > 0 && vehResults[0].status === 'maintenance') {
            db.query("UPDATE vehicles SET status = 'active' WHERE vehicleId = ?", [record.vehicleId], (errAct) => {
              if (errAct) console.error('Failed to revert vehicle status to active:', errAct);
            });
          }
        });
      }

      logActivity(req.user?.userId, 'UPDATE', 'Maintenance', `Updated maintenance record ID ${id} (Status: ${upStatus})`);

      return res.status(200).json({ success: true, message: 'Maintenance record updated successfully.' });
    });
  });
};

// Delete maintenance record
const deleteMaintenance = (req, res) => {
  const { id } = req.params;

  db.query('SELECT * FROM maintenance WHERE maintenanceId = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Maintenance record not found.' });

    db.query('DELETE FROM maintenance WHERE maintenanceId = ?', [id], (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete maintenance record.', error: err.message });
      }

      logActivity(req.user?.userId, 'DELETE', 'Maintenance', `Deleted maintenance record ID ${id}`);

      return res.status(200).json({ success: true, message: 'Maintenance record deleted successfully.' });
    });
  });
};

module.exports = {
  getAllMaintenance,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance
};
