CREATE DATABASE IF NOT EXISTS multi_depot;
USE multi_depot;


-- 1. Depots FIRST (users depends on this)
CREATE TABLE depots (
    depotId     INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    city        VARCHAR(100) NOT NULL,
    address     VARCHAR(255),
    phone       VARCHAR(20),
    status      ENUM('active', 'inactive') DEFAULT 'active',
    createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Users
CREATE TABLE users (
    userId      INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    role        ENUM('superadmin', 'admin', 'supervisor', 'operator') NOT NULL,
    phone       VARCHAR(20),
    depotId     INT,
    createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (depotId) REFERENCES depots(depotId) ON DELETE SET NULL
);

-- 3. Drivers
CREATE TABLE drivers (
    driverId        INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    licenseNo       VARCHAR(50) NOT NULL UNIQUE,
    licenseExpiry   DATE NOT NULL,
    phone           VARCHAR(20),
    address         VARCHAR(255),
    status          ENUM('available', 'on_trip', 'unavailable') DEFAULT 'available',
    maxHoursPerDay  DECIMAL(4,2) DEFAULT 8.00,
    depotId         INT NOT NULL,
    userId          INT,
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (depotId) REFERENCES depots(depotId) ON DELETE RESTRICT,
    FOREIGN KEY (userId)  REFERENCES users(userId)   ON DELETE SET NULL
);

-- 4. Vehicles
CREATE TABLE vehicles (
    vehicleId       INT AUTO_INCREMENT PRIMARY KEY,
    registrationNo  VARCHAR(50) NOT NULL UNIQUE,
    model           VARCHAR(100) NOT NULL,
    capacity        INT NOT NULL,
    status          ENUM('active', 'maintenance', 'inactive') DEFAULT 'active',
    mileage         DECIMAL(10,2) DEFAULT 0,
    fuelEfficiency  DECIMAL(5,2),
    depotId         INT NOT NULL,
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (depotId) REFERENCES depots(depotId) ON DELETE RESTRICT
);

-- 5. Routes
CREATE TABLE routes (
    routeId           INT AUTO_INCREMENT PRIMARY KEY,
    routeCode         VARCHAR(20) NOT NULL UNIQUE,
    startPoint        VARCHAR(100) NOT NULL,
    endPoint          VARCHAR(100) NOT NULL,
    totalDistance     DECIMAL(8,2),
    estimatedDuration INT,
    mapUrl            VARCHAR(500),
    routeType         ENUM('long_distance', 'urban', 'rural', 'express') NOT NULL DEFAULT 'urban',
    status            ENUM('active', 'inactive') DEFAULT 'active',
    depotId           INT NOT NULL,
    createdAt         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (depotId) REFERENCES depots(depotId) ON DELETE RESTRICT
);

-- 6. Route Stops
CREATE TABLE route_stops (
    stopId              INT AUTO_INCREMENT PRIMARY KEY,
    routeId             INT NOT NULL,
    stopName            VARCHAR(100) NOT NULL,
    stopOrder           INT NOT NULL,
    distanceFromStart   DECIMAL(8,2),
    FOREIGN KEY (routeId) REFERENCES routes(routeId) ON DELETE CASCADE
);

-- 7. Schedules
CREATE TABLE schedules (
    scheduleId      INT AUTO_INCREMENT PRIMARY KEY,
    routeId         INT NOT NULL,
    vehicleId       INT NOT NULL,
    driverId        INT NOT NULL,
    depotId         INT NOT NULL,
    departureTime   TIME NOT NULL,
    arrivalTime     TIME NOT NULL,
    scheduleDate    DATE NOT NULL,
    scheduleType    ENUM('daily', 'weekly', 'monthly') NOT NULL DEFAULT 'daily',
    notes           TEXT,
    status          ENUM('scheduled', 'ongoing', 'completed', 'delayed', 'cancelled') DEFAULT 'scheduled',
    actualDeparture DATETIME,
    actualArrival   DATETIME,
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (routeId)   REFERENCES routes(routeId)     ON DELETE RESTRICT,
    FOREIGN KEY (vehicleId) REFERENCES vehicles(vehicleId) ON DELETE RESTRICT,
    FOREIGN KEY (driverId)  REFERENCES drivers(driverId)   ON DELETE RESTRICT,
    FOREIGN KEY (depotId)   REFERENCES depots(depotId)     ON DELETE RESTRICT
);

-- 8. Fuel Logs
CREATE TABLE fuel_logs (
    fuelLogId       INT AUTO_INCREMENT PRIMARY KEY,
    vehicleId       INT NOT NULL,
    scheduleId      INT,
    depotId         INT NOT NULL,
    fuelAmount      DECIMAL(8,2) NOT NULL,
    cost            DECIMAL(10,2) NOT NULL,
    date            DATE NOT NULL,
    odometerReading DECIMAL(10,2),
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicleId)  REFERENCES vehicles(vehicleId)   ON DELETE RESTRICT,
    FOREIGN KEY (scheduleId) REFERENCES schedules(scheduleId) ON DELETE SET NULL,
    FOREIGN KEY (depotId)    REFERENCES depots(depotId)       ON DELETE RESTRICT
);

-- 9. Maintenance
CREATE TABLE maintenance (
    maintenanceId   INT AUTO_INCREMENT PRIMARY KEY,
    vehicleId       INT NOT NULL,
    depotId         INT NOT NULL,
    maintenanceType ENUM('routine', 'repair', 'emergency') NOT NULL,
    description     TEXT,
    cost            DECIMAL(10,2),
    serviceDate     DATE NOT NULL,
    nextServiceDue  DATE,
    status          ENUM('pending', 'completed') DEFAULT 'pending',
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicleId) REFERENCES vehicles(vehicleId) ON DELETE RESTRICT,
    FOREIGN KEY (depotId)   REFERENCES depots(depotId)     ON DELETE RESTRICT
);

-- 10. Activity Logs
CREATE TABLE activity_logs (
    logId       INT AUTO_INCREMENT PRIMARY KEY,
    userId      INT NOT NULL,
    depotId     INT,
    action      VARCHAR(255) NOT NULL,
    module      VARCHAR(100) NOT NULL,
    description TEXT,
    createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId)  REFERENCES users(userId)   ON DELETE RESTRICT,
    FOREIGN KEY (depotId) REFERENCES depots(depotId) ON DELETE SET NULL
);