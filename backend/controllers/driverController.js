const db = require('../config/db');

// Get all drivers
const getAllDrivers = (req, res) => {
  const query = `
    SELECT d.*, u.email, u.name as userName,
           dep.name as depotName, dep.location as depotLocation
    FROM drivers d
    LEFT JOIN users u ON d.userId = u.userId
    LEFT JOIN depots dep ON d.depotId = dep.depotId
    ORDER BY d.createdAt DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }
    return res.status(200).json({ drivers: results });
  });
};


// Get single driver
const getDriverById = (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT d.*, u.email, u.name as userName,
           dep.name as depotName, dep.location as depotLocation
    FROM drivers d
    LEFT JOIN users u ON d.userId = u.userId
    LEFT JOIN depots dep ON d.depotId = dep.depotId
    WHERE d.driverId = ?
  `;

  db.query(query, [id], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    return res.status(200).json({ driver: results[0] });
  });
};

// Create new driver
const createDriver = (req, res) => {
  const { name, licenseNo, licenseExpiry, phone, address, maxHoursPerDay, userId, depotId } = req.body;

  if (!name || !licenseNo || !licenseExpiry) {
    return res.status(400).json({ message: 'Name, license number and license expiry are required.' });
  }

  // Check license expiry is not in the past
  const today = new Date();
  const expiry = new Date(licenseExpiry);
  if (expiry < today) {
    return res.status(400).json({ message: 'License is already expired. Cannot register driver.' });
  }

  // Check duplicate license number
  db.query('SELECT * FROM drivers WHERE licenseNo = ?', [licenseNo], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }

    if (results.length > 0) {
      return res.status(409).json({ message: 'License number already exists.' });
    }

    const query = `
      INSERT INTO drivers (name, licenseNo, licenseExpiry, phone, address, maxHoursPerDay, userId, depotId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [
      name,
      licenseNo,
      licenseExpiry,
      phone || null,
      address || null,
      maxHoursPerDay || 8.00,
      userId || null,
      depotId || null
    ], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to create driver.', error: err.message });
      }

      return res.status(201).json({
        message: 'Driver created successfully.',
        driverId: result.insertId
      });
    });
  });
};



// Update driver
const updateDriver = (req, res) => {
  const { id } = req.params;
  const { name, licenseNo, licenseExpiry, phone, address, maxHoursPerDay, depotId } = req.body;

  // Check driver exists
  db.query('SELECT * FROM drivers WHERE driverId = ?', [id], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    // Check license expiry if provided
    if (licenseExpiry) {
      const today = new Date();
      const expiry = new Date(licenseExpiry);
      if (expiry < today) {
        return res.status(400).json({ message: 'License expiry date cannot be in the past.' });
      }
    }

    const query = `
      UPDATE drivers 
      SET name = ?, licenseNo = ?, licenseExpiry = ?, phone = ?, address = ?, maxHoursPerDay = ?, depotId = ?
      WHERE driverId = ?
    `;

    db.query(query, [
      name || results[0].name,
      licenseNo || results[0].licenseNo,
      licenseExpiry || results[0].licenseExpiry,
      phone || results[0].phone,
      address || results[0].address,
      maxHoursPerDay || results[0].maxHoursPerDay,
      depotId !== undefined ? (depotId || null) : results[0].depotId,
      id
    ], (err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to update driver.', error: err.message });
      }

      return res.status(200).json({ message: 'Driver updated successfully.' });
    });
  });
};



// Update driver status
const updateDriverStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['available', 'on_trip', 'unavailable'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status. Use available, on_trip or unavailable.' });
  }

  db.query('SELECT * FROM drivers WHERE driverId = ?', [id], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    db.query('UPDATE drivers SET status = ? WHERE driverId = ?', [status, id], (err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to update status.', error: err.message });
      }

      return res.status(200).json({ message: `Driver status updated to ${status}.` });
    });
  });
};



// Deactivate driver - soft delete by setting status to unavailable
const deactivateDriver = (req, res) => {
  const { id } = req.params;

  db.query('SELECT * FROM drivers WHERE driverId = ?', [id], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    db.query('UPDATE drivers SET status = ? WHERE driverId = ?', ['unavailable', id], (err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to deactivate driver.', error: err.message });
      }

      return res.status(200).json({ message: 'Driver deactivated successfully.' });
    });
  });
};

// Get available drivers
const getAvailableDrivers = (req, res) => {
  db.query(`
    SELECT * FROM drivers 
    WHERE status = 'available' 
    AND licenseExpiry > CURDATE()
    ORDER BY name ASC
  `, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }

    return res.status(200).json({ drivers: results });
  });
};

module.exports = {
  getAllDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  updateDriverStatus,
  deactivateDriver,
  getAvailableDrivers
};