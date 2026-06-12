const db = require('../config/db');
const { depotWhere, requireDepot, sameDepotOrSuperAdmin } = require('../utils/depotScope');

// Get all vehicles
const getAllVehicles = (req, res) => {
  const scope = depotWhere(req, 'v');
  const query = `
    SELECT 
      v.*,
      d.name AS depotName,
      COUNT(DISTINCT m.maintenanceId) as total_maintenance,
      MAX(m.serviceDate) as last_maintenance_date
    FROM vehicles v
    LEFT JOIN depots d ON d.depotId = v.depotId
    LEFT JOIN maintenance m ON m.vehicleId = v.vehicleId
    WHERE 1=1 ${scope.clause}
    GROUP BY v.vehicleId
    ORDER BY v.vehicleId DESC
  `;

  db.query(query, scope.params, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }
    return res.status(200).json({ success: true, vehicles: results });
  });
};

// Get single vehicle by ID
const getVehicleById = (req, res) => {
  const { id } = req.params;

  db.query(`
    SELECT v.*, d.name AS depotName
    FROM vehicles v
    LEFT JOIN depots d ON d.depotId = v.depotId
    WHERE v.vehicleId = ?
  `, [id], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }

    if (!sameDepotOrSuperAdmin(req, results[0].depotId)) {
      return res.status(403).json({ success: false, message: 'Vehicle belongs to another depot.' });
    }

    // Get maintenance history
    db.query(
      'SELECT * FROM maintenance WHERE vehicleId = ? ORDER BY serviceDate DESC LIMIT 5',
      [id],
      (err, maintenance) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
        }

        const vehicle = results[0];
        vehicle.maintenance_history = maintenance;
        return res.status(200).json({ success: true, vehicle });
      }
    );
  });
};

// Create new vehicle
const createVehicle = (req, res) => {
  const { registrationNo, model, capacity, status, mileage, fuelEfficiency } = req.body;
  const depotId = requireDepot(req, res);
  if (!depotId) return;

  if (!registrationNo || !model || !capacity) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: registrationNo, model, capacity'
    });
  }

  // Check duplicate registration number
  db.query('SELECT vehicleId FROM vehicles WHERE registrationNo = ?', [registrationNo], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }

    if (results.length > 0) {
      return res.status(409).json({ success: false, message: 'Registration number already exists.' });
    }

    const query = `
      INSERT INTO vehicles (depotId, registrationNo, model, capacity, status, mileage, fuelEfficiency)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [
      depotId,
      registrationNo,
      model,
      capacity,
      status || 'active',
      mileage || 0,
      fuelEfficiency || null
    ], (err, result) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to create vehicle.', error: err.message });
      }

      db.query('SELECT * FROM vehicles WHERE vehicleId = ?', [result.insertId], (err, newVehicle) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
        }

        return res.status(201).json({
          success: true,
          vehicle: newVehicle[0],
          message: 'Vehicle added successfully.'
        });
      });
    });
  });
};

// Update vehicle
const updateVehicle = (req, res) => {
  const { id } = req.params;
  const { registrationNo, model, capacity, status, mileage, fuelEfficiency } = req.body;

  db.query('SELECT * FROM vehicles WHERE vehicleId = ?', [id], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }

    const current = results[0];

    if (!sameDepotOrSuperAdmin(req, current.depotId)) {
      return res.status(403).json({ success: false, message: 'Vehicle belongs to another depot.' });
    }

    const query = `
      UPDATE vehicles 
      SET registrationNo = ?, model = ?, capacity = ?, status = ?, mileage = ?, fuelEfficiency = ?
      WHERE vehicleId = ?
    `;

    db.query(query, [
      registrationNo || current.registrationNo,
      model || current.model,
      capacity || current.capacity,
      status || current.status,
      mileage || current.mileage,
      fuelEfficiency || current.fuelEfficiency,
      id
    ], (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to update vehicle.', error: err.message });
      }

      db.query('SELECT * FROM vehicles WHERE vehicleId = ?', [id], (err, updated) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
        }

        return res.status(200).json({
          success: true,
          vehicle: updated[0],
          message: 'Vehicle updated successfully.'
        });
      });
    });
  });
};

// Delete vehicle - soft delete by setting status to inactive
const deleteVehicle = (req, res) => {
  const { id } = req.params;

  // Check upcoming schedules
  db.query(
    `SELECT scheduleId FROM schedules WHERE vehicleId = ? AND scheduleDate >= CURDATE()`,
    [id],
    (err, schedules) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
      }

      if (schedules.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete vehicle with upcoming schedules. Mark as inactive instead.'
        });
      }

      db.query('SELECT depotId FROM vehicles WHERE vehicleId = ?', [id], (errVehicle, vehicleRows) => {
        if (errVehicle) {
          return res.status(500).json({ success: false, message: 'Database error.', error: errVehicle.message });
        }
        if (vehicleRows.length === 0) {
          return res.status(404).json({ success: false, message: 'Vehicle not found.' });
        }
        if (!sameDepotOrSuperAdmin(req, vehicleRows[0].depotId)) {
          return res.status(403).json({ success: false, message: 'Vehicle belongs to another depot.' });
        }

      db.query('UPDATE vehicles SET status = ? WHERE vehicleId = ?', ['inactive', id], (err) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Failed to delete vehicle.', error: err.message });
        }

        return res.status(200).json({ success: true, message: 'Vehicle marked as inactive.' });
      });
      });
    }
  );
};

// Update vehicle status
const updateVehicleStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['active', 'maintenance', 'inactive', 'on_trip'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status. Use active, maintenance, inactive or on_trip.' });
  }

  db.query('SELECT * FROM vehicles WHERE vehicleId = ?', [id], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }

    if (!sameDepotOrSuperAdmin(req, results[0].depotId)) {
      return res.status(403).json({ success: false, message: 'Vehicle belongs to another depot.' });
    }

    db.query('UPDATE vehicles SET status = ? WHERE vehicleId = ?', [status, id], (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to update status.', error: err.message });
      }

      return res.status(200).json({ success: true, message: `Vehicle status updated to ${status}.` });
    });
  });
};

// Get available vehicles for assignment
const getAvailableVehicles = (req, res) => {
  const scope = depotWhere(req);
  db.query(`
    SELECT vehicleId, registrationNo, model, capacity, mileage, status
    FROM vehicles
    WHERE status = 'active' ${scope.clause}
    ORDER BY registrationNo ASC
  `, scope.params, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }

    return res.status(200).json({ success: true, vehicles: results });
  });
};

// Get vehicle maintenance history
const getVehicleMaintenance = (req, res) => {
  const { id } = req.params;

  db.query(
    `SELECT m.*
     FROM maintenance m
     INNER JOIN vehicles v ON v.vehicleId = m.vehicleId
     WHERE m.vehicleId = ?${depotWhere(req, 'v').clause}
     ORDER BY m.serviceDate DESC`,
    [id, ...depotWhere(req, 'v').params],
    (err, results) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
      }

      return res.status(200).json({ success: true, maintenance: results });
    }
  );
};

// Add maintenance record
const addMaintenance = (req, res) => {
  const { id } = req.params;
  const { maintenanceType, description, cost, serviceDate, nextServiceDue, status } = req.body;

  if (!maintenanceType || !serviceDate) {
    return res.status(400).json({
      success: false,
      message: 'Maintenance type and service date are required.'
    });
  }

  db.query('SELECT depotId FROM vehicles WHERE vehicleId = ?', [id], (vehicleErr, vehicleRows) => {
    if (vehicleErr) return res.status(500).json({ success: false, message: 'Database error.', error: vehicleErr.message });
    if (vehicleRows.length === 0) return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    if (!sameDepotOrSuperAdmin(req, vehicleRows[0].depotId)) {
      return res.status(403).json({ success: false, message: 'Vehicle belongs to another depot.' });
    }

  const query = `
    INSERT INTO maintenance (depotId, vehicleId, maintenanceType, description, cost, serviceDate, nextServiceDue, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [
    vehicleRows[0].depotId,
    id,
    maintenanceType,
    description || null,
    cost || null,
    serviceDate,
    nextServiceDue || null,
    status || 'pending'
  ], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Failed to add maintenance record.', error: err.message });
    }

    // Auto update vehicle status if repair or emergency
    if (maintenanceType === 'repair' || maintenanceType === 'emergency') {
      db.query('UPDATE vehicles SET status = ? WHERE vehicleId = ?', ['maintenance', id], (err) => {
        if (err) {
          console.error('Failed to update vehicle status:', err.message);
        }
      });
    }

    return res.status(201).json({
      success: true,
      maintenanceId: result.insertId,
      message: 'Maintenance record added successfully.'
    });
  });
  });
};

module.exports = {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  updateVehicleStatus,
  getAvailableVehicles,
  getVehicleMaintenance,
  addMaintenance
};
