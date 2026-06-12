const bcrypt = require('bcryptjs');
const db = require('../config/db');

const name = process.env.SUPERADMIN_NAME || 'Super Admin';
const email = process.env.SUPERADMIN_EMAIL || 'superadmin@srmss.com';
const password = process.env.SUPERADMIN_PASSWORD || 'password123';
const phone = process.env.SUPERADMIN_PHONE || null;

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set. Add it to .env before running the app.');
}

db.query('SELECT userId FROM users WHERE email = ?', [email], (err, users) => {
  if (err) {
    console.error('Failed to check existing SuperAdmin:', err.message);
    process.exit(1);
  }

  if (users.length > 0) {
    console.log(`SuperAdmin already exists: ${email}`);
    process.exit(0);
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const query = `
    INSERT INTO users (depotId, name, email, password, role, phone)
    VALUES (NULL, ?, ?, ?, 'superadmin', ?)
  `;

  db.query(query, [name, email, hashedPassword, phone], (insertErr) => {
    if (insertErr) {
      console.error('Failed to create SuperAdmin:', insertErr.message);
      process.exit(1);
    }

    console.log(`SuperAdmin created: ${email}`);
    console.log('Default password:', password);
    process.exit(0);
  });
});
