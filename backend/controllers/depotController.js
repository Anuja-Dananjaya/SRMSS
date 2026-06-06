const db = require('../config/db');

// Get all depots
const getAllDepots = (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM depots';
  const params = [];
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  query += ' ORDER BY name ASC';

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    return res.status(200).json({ success: true, depots: results });
  });
};

// Get single depot by ID
const getDepotById = (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM depots WHERE depotId = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Depot not found.' });
    return res.status(200).json({ success: true, depot: results[0] });
  });
};

// Create depot
const createDepot = (req, res) => {
  const { name, location, contactPhone, contactEmail } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Depot name is required.' });

  // Check duplicate name
  db.query('SELECT depotId FROM depots WHERE name = ?', [name], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    if (results.length > 0) return res.status(409).json({ success: false, message: 'A depot with that name already exists.' });

    const query = `
      INSERT INTO depots (name, location, contactPhone, contactEmail, status)
      VALUES (?, ?, ?, ?, 'active')
    `;
    db.query(query, [name, location || null, contactPhone || null, contactEmail || null], (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Failed to create depot.', error: err.message });
      db.query('SELECT * FROM depots WHERE depotId = ?', [result.insertId], (err, newDepot) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
        return res.status(201).json({ success: true, depot: newDepot[0], message: 'Depot created successfully.' });
      });
    });
  });
};

// Update depot
const updateDepot = (req, res) => {
  const { id } = req.params;
  const { name, location, contactPhone, contactEmail, status } = req.body;

  db.query('SELECT * FROM depots WHERE depotId = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Depot not found.' });

    const current = results[0];
    const query = `
      UPDATE depots SET name = ?, location = ?, contactPhone = ?, contactEmail = ?, status = ?
      WHERE depotId = ?
    `;
    db.query(query, [
      name || current.name,
      location !== undefined ? location : current.location,
      contactPhone !== undefined ? contactPhone : current.contactPhone,
      contactEmail !== undefined ? contactEmail : current.contactEmail,
      status || current.status,
      id
    ], (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Failed to update depot.', error: err.message });
      return res.status(200).json({ success: true, message: 'Depot updated successfully.' });
    });
  });
};

// Soft-delete depot (set status inactive)
const deleteDepot = (req, res) => {
  const { id } = req.params;

  db.query('SELECT * FROM depots WHERE depotId = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Depot not found.' });

    // Check if any active drivers/vehicles assigned
    db.query(
      `SELECT COUNT(*) as cnt FROM drivers WHERE depotId = ? AND status != 'unavailable'`,
      [id],
      (err, driverCheck) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
        if (driverCheck[0].cnt > 0) {
          return res.status(400).json({
            success: false,
            message: `Cannot deactivate depot. It has ${driverCheck[0].cnt} active driver(s) assigned. Reassign them first.`
          });
        }

        db.query('UPDATE depots SET status = ? WHERE depotId = ?', ['inactive', id], (err) => {
          if (err) return res.status(500).json({ success: false, message: 'Failed to deactivate depot.', error: err.message });
          return res.status(200).json({ success: true, message: 'Depot deactivated successfully.' });
        });
      }
    );
  });
};

module.exports = {
  getAllDepots,
  getDepotById,
  createDepot,
  updateDepot,
  deleteDepot
};
