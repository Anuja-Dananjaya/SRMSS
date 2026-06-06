-- ============================================================
-- SRMSS Depot Management - Database Migration
-- Run this script on your MySQL database
-- ============================================================

-- 1. Create depots table
CREATE TABLE IF NOT EXISTS depots (
  depotId INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(255) NULL,
  contactPhone VARCHAR(20) NULL,
  contactEmail VARCHAR(100) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_depot_name (name)
);

-- 2. Add depotId to drivers table
ALTER TABLE drivers
  ADD COLUMN depotId INT NULL,
  ADD CONSTRAINT fk_driver_depot FOREIGN KEY (depotId) REFERENCES depots(depotId) ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Add depotId to vehicles table
ALTER TABLE vehicles
  ADD COLUMN depotId INT NULL,
  ADD CONSTRAINT fk_vehicle_depot FOREIGN KEY (depotId) REFERENCES depots(depotId) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Add depotId to schedules table
ALTER TABLE schedules
  ADD COLUMN depotId INT NULL,
  ADD CONSTRAINT fk_schedule_depot FOREIGN KEY (depotId) REFERENCES depots(depotId) ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Optional: Insert a default "Main Depot" for existing data
-- Uncomment the lines below if you want to create a default depot
-- and assign all existing records to it.
-- ============================================================

-- INSERT INTO depots (name, location, status) VALUES ('Main Depot', 'Colombo', 'active');
-- SET @mainDepotId = LAST_INSERT_ID();
-- UPDATE drivers SET depotId = @mainDepotId WHERE depotId IS NULL;
-- UPDATE vehicles SET depotId = @mainDepotId WHERE depotId IS NULL;
-- UPDATE schedules SET depotId = @mainDepotId WHERE depotId IS NULL;

-- ============================================================
-- Verification queries (run after migration)
-- ============================================================
-- SELECT * FROM depots;
-- DESCRIBE drivers;
-- DESCRIBE vehicles;
-- DESCRIBE schedules;
