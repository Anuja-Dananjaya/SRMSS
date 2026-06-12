const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Promisify database queries
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

const runSeeder = async () => {
  console.log('Starting Database Seeder...');
  const hashedPassword = bcrypt.hashSync('password123', 10);
  console.log('Password hash generated.');

  try {
    // Disable foreign keys temporarily to clean table data
    await query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('Clean up existing data...');
    const tables = [
      'activity_logs',
      'maintenance',
      'fuel_logs',
      'schedules',
      'route_stops',
      'routes',
      'vehicles',
      'drivers',
      'users',
      'depots'
    ];
    for (const table of tables) {
      await query(`TRUNCATE TABLE ${table}`);
    }
    await query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Database tables cleared successfully.');

    // 1. Insert Depots
    console.log('Inserting depots...');
    const depot1Id = (await query(`
      INSERT INTO depots (name, city, address, phone, status)
      VALUES (?, ?, ?, ?, ?)
    `, ['Downtown Transit Center', 'New York', '123 Main St, New York, NY', '212-555-0100', 'active'])).insertId;

    const depot2Id = (await query(`
      INSERT INTO depots (name, city, address, phone, status)
      VALUES (?, ?, ?, ?, ?)
    `, ['Metro Uptown Depot', 'Boston', '456 Highland Ave, Boston, MA', '617-555-0200', 'active'])).insertId;

    console.log(`Inserted depots. ID 1: ${depot1Id}, ID 2: ${depot2Id}`);

    // 2. Insert Users (Every Role represented)
    console.log('Inserting users...');
    
    // Super Admin (No depot)
    const superAdminId = (await query(`
      INSERT INTO users (name, email, password, role, phone, depotId)
      VALUES (?, ?, ?, ?, ?, NULL)
    `, ['Global SuperAdmin', 'superadmin@srmss.com', hashedPassword, 'superadmin', '555-1000'])).insertId;

    // Depot 1 Users
    const depot1AdminId = (await query(`
      INSERT INTO users (name, email, password, role, phone, depotId)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['Downtown Manager', 'admin1@srmss.com', hashedPassword, 'admin', '555-1001', depot1Id])).insertId;

    const depot1SupervisorId = (await query(`
      INSERT INTO users (name, email, password, role, phone, depotId)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['Downtown Supervisor', 'supervisor1@srmss.com', hashedPassword, 'supervisor', '555-1002', depot1Id])).insertId;

    const depot1OperatorId = (await query(`
      INSERT INTO users (name, email, password, role, phone, depotId)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['Downtown Operator', 'operator1@srmss.com', hashedPassword, 'operator', '555-1003', depot1Id])).insertId;

    // Depot 2 Users
    const depot2AdminId = (await query(`
      INSERT INTO users (name, email, password, role, phone, depotId)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['Uptown Admin', 'admin2@srmss.com', hashedPassword, 'admin', '555-1004', depot2Id])).insertId;

    const driverUserId = (await query(`
      INSERT INTO users (name, email, password, role, phone, depotId)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['John Driver Doe', 'john.doe@srmss.com', hashedPassword, 'operator', '555-1005', depot1Id])).insertId;

    console.log('Inserted users successfully.');

    // 3. Insert Drivers
    console.log('Inserting drivers...');
    const driver1Id = (await query(`
      INSERT INTO drivers (name, licenseNo, licenseExpiry, phone, address, status, maxHoursPerDay, depotId, userId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['John Driver Doe', 'DL-992019A', '2028-12-31', '555-1005', '789 Oak Rd, Queens, NY', 'available', 8.00, depot1Id, driverUserId])).insertId;

    const driver2Id = (await query(`
      INSERT INTO drivers (name, licenseNo, licenseExpiry, phone, address, status, maxHoursPerDay, depotId, userId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `, ['Jane Smith', 'DL-881234B', '2027-06-15', '555-2001', '12 Pine St, Boston, MA', 'available', 8.00, depot2Id])).insertId;

    const driver3Id = (await query(`
      INSERT INTO drivers (name, licenseNo, licenseExpiry, phone, address, status, maxHoursPerDay, depotId, userId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `, ['Robert Johnson', 'DL-773456C', '2026-09-30', '555-2002', '34 Elm St, Brooklyn, NY', 'on_trip', 10.00, depot1Id])).insertId;

    console.log('Inserted drivers successfully.');

    // 4. Insert Vehicles
    console.log('Inserting vehicles...');
    const vehicle1Id = (await query(`
      INSERT INTO vehicles (registrationNo, model, capacity, status, mileage, fuelEfficiency, depotId)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['NY-BUS-001', 'Volvo Electric Bus 7900', 50, 'active', 12500.50, 4.20, depot1Id])).insertId;

    const vehicle2Id = (await query(`
      INSERT INTO vehicles (registrationNo, model, capacity, status, mileage, fuelEfficiency, depotId)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['BOS-BUS-002', 'Mercedes Citaro Hybrid', 40, 'active', 8540.20, 5.50, depot2Id])).insertId;

    const vehicle3Id = (await query(`
      INSERT INTO vehicles (registrationNo, model, capacity, status, mileage, fuelEfficiency, depotId)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['NY-VAN-003', 'Ford Transit Shuttle', 15, 'maintenance', 45200.10, 8.50, depot1Id])).insertId;

    console.log('Inserted vehicles.');

    // 5. Insert Routes
    console.log('Inserting routes...');
    const route1Id = (await query(`
      INSERT INTO routes (routeCode, startPoint, endPoint, totalDistance, estimatedDuration, mapUrl, routeType, status, depotId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['R-NYC-101', 'Times Square', 'JFK Airport', 28.50, 45, 'https://maps.google.com/sample1', 'express', 'active', depot1Id])).insertId;

    const route2Id = (await query(`
      INSERT INTO routes (routeCode, startPoint, endPoint, totalDistance, estimatedDuration, mapUrl, routeType, status, depotId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['R-BOS-201', 'Copley Square', 'Logan Airport', 12.20, 25, 'https://maps.google.com/sample2', 'urban', 'active', depot2Id])).insertId;

    console.log('Inserted routes.');

    // 6. Insert Route Stops
    console.log('Inserting route stops...');
    // Route 1 stops
    await query(`
      INSERT INTO route_stops (routeId, stopName, stopOrder, distanceFromStart)
      VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)
    `, [
      route1Id, 'Times Square Terminal', 1, 0.00,
      route1Id, 'Queens Midtown Interchange', 2, 8.20,
      route1Id, 'JFK Terminal 4', 3, 28.50
    ]);

    // Route 2 stops
    await query(`
      INSERT INTO route_stops (routeId, stopName, stopOrder, distanceFromStart)
      VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)
    `, [
      route2Id, 'Copley Square Terminal', 1, 0.00,
      route2Id, 'South Station Stop', 2, 3.50,
      route2Id, 'Logan Airport Terminal B', 3, 12.20
    ]);

    console.log('Inserted route stops.');

    // 7. Insert Schedules
    console.log('Inserting schedules...');
    const today = new Date().toISOString().split('T')[0];
    
    const schedule1Id = (await query(`
      INSERT INTO schedules (routeId, vehicleId, driverId, depotId, departureTime, arrivalTime, scheduleDate, scheduleType, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [route1Id, vehicle1Id, driver1Id, depot1Id, '08:00:00', '08:45:00', today, 'daily', 'Regular morning commute service.', 'scheduled'])).insertId;

    const schedule2Id = (await query(`
      INSERT INTO schedules (routeId, vehicleId, driverId, depotId, departureTime, arrivalTime, scheduleDate, scheduleType, notes, status, actualDeparture, actualArrival)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      route2Id, 
      vehicle2Id, 
      driver2Id, 
      depot2Id, 
      '10:00:00', 
      '10:30:00', 
      today, 
      'daily', 
      'Completed shuttle run.', 
      'completed', 
      `${today} 10:02:00`, 
      `${today} 10:29:00`
    ])).insertId;

    console.log('Inserted schedules.');

    // 8. Insert Fuel Logs
    console.log('Inserting fuel logs...');
    await query(`
      INSERT INTO fuel_logs (vehicleId, scheduleId, depotId, fuelAmount, cost, date, odometerReading)
      VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)
    `, [
      vehicle1Id, schedule1Id, depot1Id, 45.50, 150.25, today, 12546.00,
      vehicle2Id, schedule2Id, depot2Id, 22.10, 78.50, today, 8562.30
    ]);

    console.log('Inserted fuel logs.');

    // 9. Insert Maintenance Records
    console.log('Inserting maintenance logs...');
    await query(`
      INSERT INTO maintenance (vehicleId, depotId, maintenanceType, description, cost, serviceDate, nextServiceDue, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      vehicle3Id, depot1Id, 'repair', 'Replaced front brake pads and fixed sensor warning light.', 450.00, today, '2026-09-10', 'completed',
      vehicle1Id, depot1Id, 'routine', 'Standard 10,000-mile electric motor safety check and tire rotation.', 120.00, today, '2026-12-10', 'pending'
    ]);

    console.log('Inserted maintenance records.');

    // 10. Insert Activity Logs
    console.log('Inserting activity logs...');
    await query(`
      INSERT INTO activity_logs (userId, depotId, action, module, description)
      VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)
    `, [
      superAdminId, null, 'SEED_DATABASE', 'SYSTEM', 'Executed database sample data seeder.',
      depot1AdminId, depot1Id, 'CREATE_DRIVER', 'DRIVERS', 'Created driver profile for John Doe.'
    ]);

    console.log('Inserted activity logs.');
    console.log('Database seeding successfully finished!');
    process.exit(0);

  } catch (error) {
    console.error('Seeding failed with error:', error);
    process.exit(1);
  }
};

runSeeder();
