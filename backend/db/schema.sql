-- SRMSS Database Schema
-- Run this in phpMyAdmin after creating the srmss database

CREATE DATABASE IF NOT EXISTS srmss;
USE srmss;

-- 1. Users
CREATE TABLE users (
    userId INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'supervisor', 'operator') NOT NULL,
    phone VARCHAR(20),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Drivers
CREATE TABLE drivers (
    driverId INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    licenseNo VARCHAR(50) NOT NULL UNIQUE,
    licenseExpiry DATE NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    status ENUM('available', 'on_trip', 'unavailable') DEFAULT 'available',
    userId INT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE SET NULL
);

-- 3. Vehicles
CREATE TABLE vehicles (
    vehicleId INT AUTO_INCREMENT PRIMARY KEY,
    registrationNo VARCHAR(50) NOT NULL UNIQUE,
    model VARCHAR(100) NOT NULL,
    capacity INT NOT NULL,
    status ENUM('active', 'maintenance', 'inactive') DEFAULT 'active',
    mileage DECIMAL(10,2) DEFAULT 0,
    fuelEfficiency DECIMAL(5,2),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Routes
CREATE TABLE routes (
    routeId INT AUTO_INCREMENT PRIMARY KEY,
    routeCode VARCHAR(20) NOT NULL UNIQUE,
    startPoint VARCHAR(100) NOT NULL,
    endPoint VARCHAR(100) NOT NULL,
    totalDistance DECIMAL(8,2),
    estimatedDuration INT,
    mapUrl VARCHAR(500),
    status ENUM('active', 'inactive') DEFAULT 'active',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Route Stops
CREATE TABLE route_stops (
    stopId INT AUTO_INCREMENT PRIMARY KEY,
    routeId INT NOT NULL,
    stopName VARCHAR(100) NOT NULL,
    stopOrder INT NOT NULL,
    distanceFromStart DECIMAL(8,2),
    FOREIGN KEY (routeId) REFERENCES routes(routeId) ON DELETE CASCADE
);

-- 6. Schedules
CREATE TABLE schedules (
    scheduleId INT AUTO_INCREMENT PRIMARY KEY,
    routeId INT NOT NULL,
    vehicleId INT NOT NULL,
    driverId INT NOT NULL,
    departureTime TIME NOT NULL,
    arrivalTime TIME NOT NULL,
    scheduleDate DATE NOT NULL,
    status ENUM('scheduled', 'ongoing', 'completed', 'delayed', 'cancelled') DEFAULT 'scheduled',
    actualDeparture DATETIME,
    actualArrival DATETIME,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (routeId) REFERENCES routes(routeId) ON DELETE RESTRICT,
    FOREIGN KEY (vehicleId) REFERENCES vehicles(vehicleId) ON DELETE RESTRICT,
    FOREIGN KEY (driverId) REFERENCES drivers(driverId) ON DELETE RESTRICT
);

-- 7. Fuel Logs
CREATE TABLE fuel_logs (
    fuelLogId INT AUTO_INCREMENT PRIMARY KEY,
    vehicleId INT NOT NULL,
    scheduleId INT,
    fuelAmount DECIMAL(8,2) NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    date DATE NOT NULL,
    odometerReading DECIMAL(10,2),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicleId) REFERENCES vehicles(vehicleId) ON DELETE RESTRICT,
    FOREIGN KEY (scheduleId) REFERENCES schedules(scheduleId) ON DELETE SET NULL
);

-- 8. Maintenance
CREATE TABLE maintenance (
    maintenanceId INT AUTO_INCREMENT PRIMARY KEY,
    vehicleId INT NOT NULL,
    maintenanceType ENUM('routine', 'repair', 'emergency') NOT NULL,
    description TEXT,
    cost DECIMAL(10,2),
    serviceDate DATE NOT NULL,
    nextServiceDue DATE,
    status ENUM('pending', 'completed') DEFAULT 'pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicleId) REFERENCES vehicles(vehicleId) ON DELETE RESTRICT
);