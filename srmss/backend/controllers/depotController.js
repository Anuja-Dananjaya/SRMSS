const db = require('../config/db');

const getAllDepots = (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const query = `
    SELECT depotId, name, city, address, phone, status, createdAt
    FROM depots
    ${includeInactive ? '' : 'WHERE status = "active"'}
    ORDER BY name ASC
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }
    return res.status(200).json({ success: true, depots: results });
  });
};

const createDepot = (req, res) => {
  const { name, city, address, phone, status } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Depot name is required.' });
  }

  const query = 'INSERT INTO depots (name, city, address, phone, status) VALUES (?, ?, ?, ?, ?)';
  db.query(query, [name, city || null, address || null, phone || null, status || 'active'], (err, result) => {
    if (err) {
      const message = err.code === 'ER_DUP_ENTRY' ? 'Depot name already exists.' : 'Failed to create depot.';
      return res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ success: false, message, error: err.message });
    }

    return res.status(201).json({ success: true, depotId: result.insertId, message: 'Depot created successfully.' });
  });
};

const updateDepot = (req, res) => {
  const { id } = req.params;
  const { name, city, address, phone, status } = req.body;

  db.query('SELECT * FROM depots WHERE depotId = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Depot not found.' });

    const current = results[0];
    const query = 'UPDATE depots SET name = ?, city = ?, address = ?, phone = ?, status = ? WHERE depotId = ?';
    db.query(query, [
      name || current.name,
      city !== undefined ? city : current.city,
      address !== undefined ? address : current.address,
      phone !== undefined ? phone : current.phone,
      status || current.status,
      id
    ], (err) => {
      if (err) {
        const message = err.code === 'ER_DUP_ENTRY' ? 'Depot name already exists.' : 'Failed to update depot.';
        return res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ success: false, message, error: err.message });
      }
      return res.status(200).json({ success: true, message: 'Depot updated successfully.' });
    });
  });
};

const deactivateDepot = (req, res) => {
  const { id } = req.params;

  db.query('UPDATE depots SET status = "inactive" WHERE depotId = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Failed to deactivate depot.', error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Depot not found.' });
    return res.status(200).json({ success: true, message: 'Depot deactivated successfully.' });
  });
};

module.exports = {
  getAllDepots,
  createDepot,
  updateDepot,
  deactivateDepot
};
