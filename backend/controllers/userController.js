const db = require('../config/db');
const bcrypt = require('bcryptjs');

// Get all users - admin only
const getAllUsers = (req, res) => {
  const query = `
    SELECT userId, name, email, role, phone, createdAt, updatedAt 
    FROM users 
    ORDER BY createdAt DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }
    return res.status(200).json({ users: results });
  });
};

// Get single user - admin only
const getUserById = (req, res) => {
  const { id } = req.params;

  db.query(
    'SELECT userId, name, email, role, phone, createdAt, updatedAt FROM users WHERE userId = ?',
    [id],
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
  const { name, email, role, phone } = req.body;

  db.query('SELECT * FROM users WHERE userId = ?', [id], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const current = results[0];

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
        SET name = ?, email = ?, role = ?, phone = ?
        WHERE userId = ?
      `;

      db.query(query, [
        name || current.name,
        email || current.email,
        role || current.role,
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
    'SELECT userId, name, email, role, phone, createdAt FROM users WHERE userId = ?',
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