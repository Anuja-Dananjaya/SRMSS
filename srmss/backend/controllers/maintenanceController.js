const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');
const { depotWhere, sameDepotOrSuperAdmin } = require('../utils/depotScope');

// Get all maintenance records
const getAllMaintenance = (req, res) => {
  const scope = depotWhere(req, 'm');
  const query = `
    SELECT m.*, d.name AS depotName, v.registrationNo, v.model
    FROM maintenance m
    LEFT JOIN depots d ON m.depotId = d.depotId
    LEFT JOIN vehicles v ON m.vehicleId = v.vehicleId
    WHERE 1=1 ${scope.clause}
    ORDER BY m.serviceDate DESC, m.maintenanceId DESC
  `;

  db.query(query, scope.params, (err, results) => {
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

  db.query('SELECT depotId FROM vehicles WHERE vehicleId = ?', [vehicleId], (vehicleErr, vehicleRows) => {
    if (vehicleErr) return res.status(500).json({ success: false, message: 'Database error.', error: vehicleErr.message });
    if (vehicleRows.length === 0) return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    if (!sameDepotOrSuperAdmin(req, vehicleRows[0].depotId)) {
      return res.status(403).json({ success: false, message: 'Vehicle belongs to another depot.' });
    }

    const depotId = vehicleRows[0].depotId;
  const query = `
    INSERT INTO maintenance (depotId, vehicleId, maintenanceType, description, cost, serviceDate, nextServiceDue, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [
    depotId,
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

    logActivity(req.user?.userId, 'CREATE', 'Maintenance', `Added maintenance record for vehicle ID ${vehicleId}`, depotId);

    return res.status(201).json({
      success: true,
      maintenanceId,
      message: 'Maintenance record created successfully.'
    });
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
    if (!sameDepotOrSuperAdmin(req, record.depotId)) {
      return res.status(403).json({ success: false, message: 'Maintenance record belongs to another depot.' });
    }

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

      // If status completed, update vehicle status back to 'active'
      if (upStatus === 'completed') {
        db.query("UPDATE vehicles SET status = 'active' WHERE vehicleId = ?", [record.vehicleId], (errAct) => {
          if (errAct) console.error('Failed to update vehicle status to active:', errAct);
        });
      }

      logActivity(req.user?.userId, 'UPDATE', 'Maintenance', `Updated maintenance record ID ${id} (Status: ${upStatus})`, record.depotId);

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
    if (!sameDepotOrSuperAdmin(req, results[0].depotId)) {
      return res.status(403).json({ success: false, message: 'Maintenance record belongs to another depot.' });
    }

    db.query('DELETE FROM maintenance WHERE maintenanceId = ?', [id], (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete maintenance record.', error: err.message });
      }

      logActivity(req.user?.userId, 'DELETE', 'Maintenance', `Deleted maintenance record ID ${id}`, results[0].depotId);

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
