const db = require('../config/db');
const { selectedDepot } = require('../utils/depotScope');

const getDashboardData = (req, res) => {
  const data = {};
  const depotId = selectedDepot(req);

  // If depotId is null, undefined, '', or 0, we treat it as "Show All" (no filter)
  const shouldFilter = depotId && depotId !== '0' && depotId !== 0;

  // Helper for standalone WHERE clauses
  const whereDepot = (alias = '') => {
    if (!shouldFilter) return { clause: '', params: [] }; // Completely removes the filter if depotId is 0 or missing
    const prefix = alias ? `${alias}.` : '';
    return { clause: ` WHERE ${prefix}depotId = ?`, params: [depotId] };
  };

  // Helper for appending to existing WHERE clauses
  const andDepot = (alias = '') => {
    if (!shouldFilter) return { clause: '', params: [] }; // Completely removes the filter if depotId is 0 or missing
    const prefix = alias ? `${alias}.` : '';
    return { clause: ` AND ${prefix}depotId = ?`, params: [depotId] };
  };

  // 1. Vehicle stats
  const vehicleStats = () => new Promise((resolve, reject) => {
    const scope = whereDepot();
    db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive
      FROM vehicles
      ${scope.clause}
    `, scope.params, (err, results) => {
      if (err) return reject(err);
      data.vehicles = results[0];
      resolve();
    });
  });

  // 2. Driver stats
  const driverStats = () => new Promise((resolve, reject) => {
    const scope = whereDepot();
    db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'on_trip' THEN 1 ELSE 0 END) as on_trip,
        SUM(CASE WHEN status = 'unavailable' THEN 1 ELSE 0 END) as unavailable,
        SUM(CASE WHEN licenseExpiry < DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND licenseExpiry > CURDATE() THEN 1 ELSE 0 END) as expiring_soon
      FROM drivers
      ${scope.clause}
    `, scope.params, (err, results) => {
      if (err) return reject(err);
      data.drivers = results[0];
      resolve();
    });
  });

  // 3. Route stats
  const routeStats = () => new Promise((resolve, reject) => {
    const scope = whereDepot();
    db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN routeType = 'express' THEN 1 ELSE 0 END) as express,
        SUM(CASE WHEN routeType = 'long_distance' THEN 1 ELSE 0 END) as long_distance,
        SUM(CASE WHEN routeType = 'urban' THEN 1 ELSE 0 END) as urban,
        SUM(CASE WHEN routeType = 'rural' THEN 1 ELSE 0 END) as rural
      FROM routes
      ${scope.clause}
    `, scope.params, (err, results) => {
      if (err) return reject(err);
      data.routes = results[0];
      resolve();
    });
  });

  // 4. Schedule stats
  const scheduleStats = () => new Promise((resolve, reject) => {
    const scope = whereDepot();
    db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END) as ongoing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) as \`delayed\`,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN scheduleDate = CURDATE() THEN 1 ELSE 0 END) as today
      FROM schedules
      ${scope.clause}
    `, scope.params, (err, results) => {
      if (err) return reject(err);
      data.schedules = results[0];
      resolve();
    });
  });

  // 5. Today's schedules
  const todaySchedules = () => new Promise((resolve, reject) => {
    const scope = andDepot('s');
    db.query(`
      SELECT 
        s.scheduleId, s.departureTime, s.arrivalTime, s.status,
        r.routeCode, r.startPoint, r.endPoint,
        v.registrationNo,
        d.name as driverName
      FROM schedules s
      LEFT JOIN routes r ON s.routeId = r.routeId
      LEFT JOIN vehicles v ON s.vehicleId = v.vehicleId
      LEFT JOIN drivers d ON s.driverId = d.driverId
      WHERE s.scheduleDate = CURDATE() ${scope.clause}
      ORDER BY s.departureTime ASC
      LIMIT 10
    `, scope.params, (err, results) => {
      if (err) return reject(err);
      data.todaySchedules = results;
      resolve();
    });
  });

  // 6. Fuel stats - last 30 days
  const fuelStats = () => new Promise((resolve, reject) => {
    const scope = andDepot();
    db.query(`
      SELECT 
        COUNT(*) as totalLogs,
        ROUND(SUM(fuelAmount), 2) as totalFuel,
        ROUND(SUM(cost), 2) as totalCost,
        ROUND(AVG(fuelAmount), 2) as avgFuelPerLog
      FROM fuel_logs
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) ${scope.clause}
    `, scope.params, (err, results) => {
      if (err) return reject(err);
      data.fuel = results[0];
      resolve();
    });
  });

  // 7. Maintenance stats
  const maintenanceStats = () => new Promise((resolve, reject) => {
    const scope = whereDepot();
    db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN nextServiceDue <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND nextServiceDue >= CURDATE() THEN 1 ELSE 0 END) as due_soon
      FROM maintenance
      ${scope.clause}
    `, scope.params, (err, results) => {
      if (err) return reject(err);
      data.maintenance = results[0];
      resolve();
    });
  });

  // 8. Recent activity logs (Now uses the updated whereDepot helper)
  const recentActivity = () => new Promise((resolve, reject) => {
    const scope = whereDepot('a');
    db.query(`
      SELECT 
        a.action, a.module, a.description, a.createdAt,
        u.name as userName
      FROM activity_logs a
      LEFT JOIN users u ON a.userId = u.userId
      ${scope.clause}
      ORDER BY a.createdAt DESC
      LIMIT 8
    `, scope.params, (err, results) => {
      if (err) return reject(err);
      data.recentActivity = results;
      resolve();
    });
  });

  // 9. Monthly schedule trend - last 6 months
  const scheduleTrend = () => new Promise((resolve, reject) => {
    const scope = andDepot();
    db.query(`
      SELECT 
        DATE_FORMAT(scheduleDate, '%Y-%m') as month,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM schedules
      WHERE scheduleDate >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) ${scope.clause}
      GROUP BY DATE_FORMAT(scheduleDate, '%Y-%m')
      ORDER BY month ASC
    `, scope.params, (err, results) => {
      if (err) return reject(err);
      data.scheduleTrend = results;
      resolve();
    });
  });

  // 10. Vehicle utilization (Now uses the updated whereDepot helper)
  const vehicleUtilization = () => new Promise((resolve, reject) => {
    const scope = whereDepot('v');
    db.query(`
      SELECT 
        v.registrationNo,
        v.model,
        COUNT(s.scheduleId) as totalTrips,
        SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) as completedTrips
      FROM vehicles v
      LEFT JOIN schedules s ON v.vehicleId = s.vehicleId
      ${scope.clause}
      GROUP BY v.vehicleId
      ORDER BY totalTrips DESC
      LIMIT 5
    `, scope.params, (err, results) => {
      if (err) return reject(err);
      data.vehicleUtilization = results;
      resolve();
    });
  });

  // Run all queries
  Promise.all([
    vehicleStats(),
    driverStats(),
    routeStats(),
    scheduleStats(),
    todaySchedules(),
    fuelStats(),
    maintenanceStats(),
    recentActivity(),
    scheduleTrend(),
    vehicleUtilization()
  ])
    .then(() => {
      return res.status(200).json({ success: true, data });
    })
    .catch((err) => {
      return res.status(500).json({ success: false, message: 'Dashboard error.', error: err.message });
    });
};


module.exports = { getDashboardData };