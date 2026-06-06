-- ============================================================
-- SRMSS Role Update Migration
-- Replaces 'operator' role with 'user' and 'driver'
-- Run this on your MySQL database
-- ============================================================

-- IMPORTANT: Step 1 MUST run before Step 2.
-- MySQL cannot change the ENUM while rows still contain 'operator'.

-- Step 1: Temporarily disable safe update mode (MySQL Workbench restriction)
SET SQL_SAFE_UPDATES = 0;

-- Convert any existing 'operator' users to 'user' FIRST
UPDATE users SET role = 'user' WHERE role = 'operator';

-- Re-enable safe update mode
SET SQL_SAFE_UPDATES = 1;

-- Step 2: Now safely modify the role ENUM column
ALTER TABLE users
  MODIFY COLUMN role ENUM('admin', 'supervisor', 'user', 'driver') NOT NULL DEFAULT 'user';

-- Step 3: Verify the change
-- DESCRIBE users;
SELECT role, COUNT(*) as count FROM users GROUP BY role;
22:35:23	UPDATE users SET role = 'user' WHERE role = 'operator'	Error Code: 1175. You are using safe update mode and you tried to update a table without a WHERE that uses a KEY column.  To disable safe mode, toggle the option in Preferences -> SQL Editor and reconnect.	0.000 sec
