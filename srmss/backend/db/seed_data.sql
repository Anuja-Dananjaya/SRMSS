-- Seed Data for multi_depot database
-- Password for all generated users is: password123 (hashed using bcrypt)

USE multi_depot;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE activity_logs;
TRUNCATE TABLE maintenance;
TRUNCATE TABLE fuel_logs;
TRUNCATE TABLE schedules;
TRUNCATE TABLE route_stops;
TRUNCATE TABLE routes;
TRUNCATE TABLE vehicles;
TRUNCATE TABLE drivers;
TRUNCATE TABLE users;
TRUNCATE TABLE depots;

SET FOREIGN_KEY_CHECKS = 1;

-- 1. Insert Depots
INSERT INTO depots (depotId, name, city, address, phone, status) VALUES
(1, 'Downtown Transit Center', 'New York', '123 Main St, New York, NY', '212-555-0100', 'active'),
(2, 'Metro Uptown Depot', 'Boston', '456 Highland Ave, Boston, MA', '617-555-0200', 'active');

-- 2. Insert Users (Password: password123)
-- Hash: $2a$10$n9qo8vLOuZUX1Jg5Q3c2G.X77QJtV8g12hXo0h7.K7oMv29D9t6J.
INSERT INTO users (userId, name, email, password, role, phone, depotId) VALUES
(1, 'Global SuperAdmin', 'superadmin@srmss.com', '$2a$10$n9qo8vLOuZUX1Jg5Q3c2G.X77QJtV8g12hXo0h7.K7oMv29D9t6J.', 'superadmin', '555-1000', NULL),
(2, 'Downtown Manager', 'admin1@srmss.com', '$2a$10$n9qo8vLOuZUX1Jg5Q3c2G.X77QJtV8g12hXo0h7.K7oMv29D9t6J.', 'admin', '555-1001', 1),
(3, 'Downtown Supervisor', 'supervisor1@srmss.com', '$2a$10$n9qo8vLOuZUX1Jg5Q3c2G.X77QJtV8g12hXo0h7.K7oMv29D9t6J.', 'supervisor', '555-1002', 1),
(4, 'Downtown Operator', 'operator1@srmss.com', '$2a$10$n9qo8vLOuZUX1Jg5Q3c2G.X77QJtV8g12hXo0h7.K7oMv29D9t6J.', 'operator', '555-1003', 1),
(5, 'Uptown Admin', 'admin2@srmss.com', '$2a$10$n9qo8vLOuZUX1Jg5Q3c2G.X77QJtV8g12hXo0h7.K7oMv29D9t6J.', 'admin', '555-1004', 2),
(6, 'John Driver Doe', 'john.doe@srmss.com', '$2a$10$n9qo8vLOuZUX1Jg5Q3c2G.X77QJtV8g12hXo0h7.K7oMv29D9t6J.', 'operator', '555-1005', 1);

-- 3. Insert Drivers
INSERT INTO drivers (driverId, name, licenseNo, licenseExpiry, phone, address, status, maxHoursPerDay, depotId, userId) VALUES
(1, 'John Driver Doe', 'DL-992019A', '2028-12-31', '555-1005', '789 Oak Rd, Queens, NY', 'available', 8.00, 1, 6),
(2, 'Jane Smith', 'DL-881234B', '2027-06-15', '555-2001', '12 Pine St, Boston, MA', 'available', 8.00, 2, NULL),
(3, 'Robert Johnson', 'DL-773456C', '2026-09-30', '555-2002', '34 Elm St, Brooklyn, NY', 'on_trip', 10.00, 1, NULL);

-- 4. Insert Vehicles
INSERT INTO vehicles (vehicleId, registrationNo, model, capacity, status, mileage, fuelEfficiency, depotId) VALUES
(1, 'NY-BUS-001', 'Volvo Electric Bus 7900', 50, 'active', 12500.50, 4.20, 1),
(2, 'BOS-BUS-002', 'Mercedes Citaro Hybrid', 40, 'active', 8540.20, 5.50, 2),
(3, 'NY-VAN-003', 'Ford Transit Shuttle', 15, 'maintenance', 45200.10, 8.50, 1);

-- 5. Insert Routes
INSERT INTO routes (routeId, routeCode, startPoint, endPoint, totalDistance, estimatedDuration, mapUrl, routeType, status, depotId) VALUES
(1, 'R-NYC-101', 'Times Square', 'JFK Airport', 28.50, 45, 'https://maps.google.com/sample1', 'express', 'active', 1),
(2, 'R-BOS-201', 'Copley Square', 'Logan Airport', 12.20, 25, 'https://maps.google.com/sample2', 'urban', 'active', 2);

-- 6. Insert Route Stops
INSERT INTO route_stops (stopId, routeId, stopName, stopOrder, distanceFromStart) VALUES
(1, 1, 'Times Square Terminal', 1, 0.00),
(2, 1, 'Queens Midtown Interchange', 2, 8.20),
(3, 1, 'JFK Terminal 4', 3, 28.50),
(4, 2, 'Copley Square Terminal', 1, 0.00),
(5, 2, 'South Station Stop', 2, 3.50),
(6, 2, 'Logan Airport Terminal B', 3, 12.20);

-- 7. Insert Schedules
INSERT INTO schedules (scheduleId, routeId, vehicleId, driverId, depotId, departureTime, arrivalTime, scheduleDate, scheduleType, notes, status, actualDeparture, actualArrival) VALUES
(1, 1, 1, 1, 1, '08:00:00', '08:45:00', CURDATE(), 'daily', 'Regular morning commute service.', 'scheduled', NULL, NULL),
(2, 2, 2, 2, 2, '10:00:00', '10:30:00', CURDATE(), 'daily', 'Completed shuttle run.', 'completed', CONCAT(CURDATE(), ' 10:02:00'), CONCAT(CURDATE(), ' 10:29:00'));

-- 8. Insert Fuel Logs
INSERT INTO fuel_logs (fuelLogId, vehicleId, scheduleId, depotId, fuelAmount, cost, date, odometerReading) VALUES
(1, 1, 1, 1, 45.50, 150.25, CURDATE(), 12546.00),
(2, 2, 2, 2, 22.10, 78.50, CURDATE(), 8562.30);

-- 9. Insert Maintenance Records
INSERT INTO maintenance (maintenanceId, vehicleId, depotId, maintenanceType, description, cost, serviceDate, nextServiceDue, status) VALUES
(1, 3, 1, 'repair', 'Replaced front brake pads and fixed sensor warning light.', 450.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 MONTH), 'completed'),
(2, 1, 1, 'routine', 'Standard 10,000-mile electric motor safety check and tire rotation.', 120.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 6 MONTH), 'pending');

-- 10. Insert Activity Logs
INSERT INTO activity_logs (logId, userId, depotId, action, module, description) VALUES
(1, 1, NULL, 'SEED_DATABASE', 'SYSTEM', 'Executed database sample data seeder.'),
(2, 2, 1, 'CREATE_DRIVER', 'DRIVERS', 'Created driver profile for John Doe.');
