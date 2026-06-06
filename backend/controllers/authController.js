const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require ('../config/db');
require('dotenv').config();

// Register new user — admin only
const register = (req, res) => {
  const { name, email, password, role, phone } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password and role are required.' });
  }

  const validRoles = ['admin', 'supervisor', 'user', 'driver'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role. Must be admin, supervisor, user, or driver.' });
  }

  // Check if email already exists
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }

    if (results.length > 0) {
      return res.status(409).json({ message: 'Email already exists.' });
    }

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    // Insert user
    const query = 'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [name, email, hashedPassword, role, phone || null], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to register user.', error: err.message });
      }

      return res.status(201).json({ 
        message: 'User registered successfully.',
        userId: result.insertId
      });
    });
  });
};

// Login
const login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  // Find user by email
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = results[0];

    // Compare password
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.userId, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  });
};

// Get current logged in user
const getMe = (req, res) => {
  db.query('SELECT userId, name, email, role, phone, createdAt FROM users WHERE userId = ?', 
  [req.user.userId], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({ user: results[0] });
  });
};

module.exports = { register, login, getMe };

