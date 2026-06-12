const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { isSuperAdmin, selectedDepot } = require('../utils/depotScope');

// Get all users - admin only
const getAllUsers = (req, res) => {
  console.log('getAllUsers called by', req.user && req.user.email);
  const params = [];
  let where = '';

  if (!isSuperAdmin(req.user)) {
    where = 'WHERE u.depotId = ? AND u.role != "superadmin"';
    params.push(req.user.depotId);
  } else {
    const depotId = selectedDepot(req);
    if (depotId) {
      where = 'WHERE u.depotId = ?';
      params.push(depotId);
    }
  }

  const query = `
    SELECT u.userId, u.depotId, u.name, u.email, u.role, u.phone, u.createdAt, u.updatedAt, d.name AS depotName
    FROM users u
    LEFT JOIN depots d ON u.depotId = d.depotId
    ${where}
    ORDER BY u.createdAt DESC
  `;

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('getAllUsers DB error:', err);
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }
    console.log('getAllUsers returning', results.length, 'rows');
    return res.status(200).json({ success: true, users: results });
  });
};

// Get single user - admin only
const getUserById = (req, res) => {
  const { id } = req.params;
  const params = [id];
  let depotGuard = '';

  if (!isSuperAdmin(req.user)) {
    depotGuard = ' AND u.depotId = ? AND u.role != "superadmin"';
    params.push(req.user.depotId);
  }

  db.query(
    `SELECT u.userId, u.depotId, u.name, u.email, u.role, u.phone, u.createdAt, u.updatedAt, d.name AS depotName
     FROM users u
     LEFT JOIN depots d ON u.depotId = d.depotId
     WHERE u.userId = ?${depotGuard}`,
    params,
    (err, results) => {
      if (err) {
        return res.status(500).json({ message: 'Database error.', error: err.message });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }

      return res.status(200).json({ user: results[0] });
    }
  );
};

// Update user - admin only
const updateUser = (req, res) => {
  const { id } = req.params;
  const { name, email, role, phone, depotId } = req.body;

  db.query('SELECT * FROM users WHERE userId = ?', [id], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const current = results[0];

    if (!isSuperAdmin(req.user)) {
      if (current.role === 'superadmin' || Number(current.depotId) !== Number(req.user.depotId)) {
        return res.status(403).json({ message: 'You can only manage users in your depot.' });
      }
      if (role === 'superadmin' || role === 'admin') {
        return res.status(403).json({ message: 'Depot admins can only assign supervisor or operator roles.' });
      }
    }

    const upRole = role || current.role;
    const upDepotId = upRole === 'superadmin'
      ? null
      : (isSuperAdmin(req.user) ? (depotId || current.depotId) : req.user.depotId);

    if (upRole !== 'superadmin' && !upDepotId) {
      return res.status(400).json({ message: 'Depot is required for depot users.' });
    }

    // Check if new email already exists for another user
    if (email && email !== current.email) {
      db.query(
        'SELECT * FROM users WHERE email = ? AND userId != ?',
        [email, id],
        (err, emailResults) => {
          if (err) {
            return res.status(500).json({ message: 'Database error.', error: err.message });
          }

          if (emailResults.length > 0) {
            return res.status(409).json({ message: 'Email already in use by another user.' });
          }

          runUpdate();
        }
      );
    } else {
      runUpdate();
    }

    function runUpdate() {
      const query = `
        UPDATE users 
        SET depotId = ?, name = ?, email = ?, role = ?, phone = ?
        WHERE userId = ?
      `;

      db.query(query, [
        upDepotId,
        name || current.name,
        email || current.email,
        upRole,
        phone || current.phone,
        id
      ], (err) => {
        if (err) {
          return res.status(500).json({ message: 'Failed to update user.', error: err.message });
        }

        return res.status(200).json({ message: 'User updated successfully.' });
      });
    }
  });
};

// Delete user - admin only
const deleteUser = (req, res) => {
  const { id } = req.params;

  // Prevent admin from deleting themselves
  if (parseInt(id) === req.user.userId) {
    return res.status(400).json({ message: 'You cannot delete your own account.' });
  }

  db.query('SELECT * FROM users WHERE userId = ?', [id], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const target = results[0];
    if (!isSuperAdmin(req.user) && (target.role === 'superadmin' || Number(target.depotId) !== Number(req.user.depotId))) {
      return res.status(403).json({ message: 'You can only delete users in your depot.' });
    }

    db.query('DELETE FROM users WHERE userId = ?', [id], (err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to delete user.', error: err.message });
      }

      return res.status(200).json({ message: 'User deleted successfully.' });
    });
  });
};

// Get own profile - all roles
const getProfile = (req, res) => {
  db.query(
    `SELECT u.userId, u.depotId, u.name, u.email, u.role, u.phone, u.createdAt, d.name AS depotName
     FROM users u
     LEFT JOIN depots d ON u.depotId = d.depotId
     WHERE u.userId = ?`,
    [req.user.userId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ message: 'Database error.', error: err.message });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }

      return res.status(200).json({ user: results[0] });
    }
  );
};

// Update own profile - all roles
// Can only update name and phone, not role or email
const updateProfile = (req, res) => {
  const { name, phone } = req.body;

  if (!name && !phone) {
    return res.status(400).json({ message: 'Provide name or phone to update.' });
  }

  db.query('SELECT * FROM users WHERE userId = ?', [req.user.userId], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const current = results[0];

    db.query(
      'UPDATE users SET name = ?, phone = ? WHERE userId = ?',
      [name || current.name, phone || current.phone, req.user.userId],
      (err) => {
        if (err) {
          return res.status(500).json({ message: 'Failed to update profile.', error: err.message });
        }

        return res.status(200).json({ message: 'Profile updated successfully.' });
      }
    );
  });
};

// Change password - all roles for own password
const changePassword = (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  }

  db.query('SELECT * FROM users WHERE userId = ?', [req.user.userId], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = results[0];

    // Verify current password
    const isMatch = bcrypt.compareSync(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    // Hash new password
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    db.query(
      'UPDATE users SET password = ? WHERE userId = ?',
      [hashedPassword, req.user.userId],
      (err) => {
        if (err) {
          return res.status(500).json({ message: 'Failed to change password.', error: err.message });
        }

        return res.status(200).json({ message: 'Password changed successfully.' });
      }
    );
  });
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getProfile,
  updateProfile,
  changePassword
};
