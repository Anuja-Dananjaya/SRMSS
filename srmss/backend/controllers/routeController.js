const db = require('../config/db');
const { depotWhere, requireDepot, sameDepotOrSuperAdmin } = require('../utils/depotScope');

// Get all routes with stops count
const getAllRoutes = (req, res) => {
  const scope = depotWhere(req, 'r');
  const query = `
    SELECT 
      r.*,
      d.name AS depotName,
      COUNT(DISTINCT rs.stopId) as total_stops
    FROM routes r
    LEFT JOIN depots d ON d.depotId = r.depotId
    LEFT JOIN route_stops rs ON rs.routeId = r.routeId
    WHERE 1=1 ${scope.clause}
    GROUP BY r.routeId
    ORDER BY r.routeId DESC
  `;

  db.query(query, scope.params, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }
    return res.status(200).json({ success: true, routes: results });
  });
};

// Get active routes for dropdown
const getActiveRoutes = (req, res) => {
  const scope = depotWhere(req);
  db.query(
    `SELECT routeId, routeCode, startPoint, endPoint, routeType FROM routes WHERE status = "active" ${scope.clause} ORDER BY routeCode`,
    scope.params,
    (err, results) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
      }
      return res.status(200).json({ success: true, routes: results });
    }
  );
};

// Get available drivers
const getAvailableDrivers = (req, res) => {
  const scope = depotWhere(req);
  db.query(`
    SELECT driverId, name, licenseNo, licenseExpiry, phone, status
    FROM drivers
    WHERE status = 'available' AND licenseExpiry > CURDATE() ${scope.clause}
  `, scope.params, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }
    return res.status(200).json({ success: true, drivers: results });
  });
};

// Get single route with stops
const getRouteById = (req, res) => {
  const { id } = req.params;

  db.query('SELECT * FROM routes WHERE routeId = ?', [id], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Route not found.' });
    }

    const route = results[0];

    if (!sameDepotOrSuperAdmin(req, route.depotId)) {
      return res.status(403).json({ success: false, message: 'Route belongs to another depot.' });
    }

    db.query(
      'SELECT * FROM route_stops WHERE routeId = ? ORDER BY stopOrder',
      [id],
      (err, stops) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
        }

        route.stops = stops;
        return res.status(200).json({ success: true, route });
      }
    );
  });
};

// Get route map data
const getRouteMapData = (req, res) => {
  const { id } = req.params;

  db.query('SELECT * FROM routes WHERE routeId = ?', [id], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Route not found.' });
    }

    if (!sameDepotOrSuperAdmin(req, results[0].depotId)) {
      return res.status(403).json({ success: false, message: 'Route belongs to another depot.' });
    }

    db.query(
      'SELECT stopOrder, stopName, distanceFromStart FROM route_stops WHERE routeId = ? ORDER BY stopOrder',
      [id],
      (err, stops) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
        }

        return res.status(200).json({ success: true, route: results[0], stops });
      }
    );
  });
};

// Create route with stops
const createRoute = (req, res) => {
  const { routeCode, startPoint, endPoint, totalDistance, estimatedDuration, mapUrl, routeType, status, stops } = req.body;
  const depotId = requireDepot(req, res);
  if (!depotId) return;

  if (!routeCode || !startPoint || !endPoint) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: routeCode, startPoint, endPoint'
    });
  }

  // Check duplicate routeCode
  db.query('SELECT routeId FROM routes WHERE depotId = ? AND routeCode = ?', [depotId, routeCode], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }

    if (results.length > 0) {
      return res.status(409).json({ success: false, message: 'Route code already exists.' });
    }

    const query = `
      INSERT INTO routes (depotId, routeCode, startPoint, endPoint, totalDistance, estimatedDuration, mapUrl, routeType, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [
      depotId,
      routeCode,
      startPoint,
      endPoint,
      totalDistance || null,
      estimatedDuration || null,
      mapUrl || null,
      routeType || 'urban',
      status || 'active'
    ], (err, result) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to create route.', error: err.message });
      }

      const routeId = result.insertId;

      // Insert stops if provided
      if (stops && stops.length > 0) {
        let completed = 0;
        let hasError = false;

        stops.forEach((stop, index) => {
          db.query(
            'INSERT INTO route_stops (routeId, stopName, stopOrder, distanceFromStart) VALUES (?, ?, ?, ?)',
            [routeId, stop.stopName, index + 1, stop.distanceFromStart || null],
            (err) => {
              if (err && !hasError) {
                hasError = true;
                return res.status(500).json({ success: false, message: 'Failed to insert stops.', error: err.message });
              }

              completed++;
              if (completed === stops.length && !hasError) {
                return res.status(201).json({
                  success: true,
                  routeId,
                  message: 'Route created successfully.'
                });
              }
            }
          );
        });
      } else {
        return res.status(201).json({
          success: true,
          routeId,
          message: 'Route created successfully.'
        });
      }
    });
  });
};

// Update route
const updateRoute = (req, res) => {
  const { id } = req.params;
  const { routeCode, startPoint, endPoint, totalDistance, estimatedDuration, mapUrl, routeType, status, stops } = req.body;

  db.query('SELECT * FROM routes WHERE routeId = ?', [id], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Route not found.' });
    }

    const current = results[0];

    if (!sameDepotOrSuperAdmin(req, current.depotId)) {
      return res.status(403).json({ success: false, message: 'Route belongs to another depot.' });
    }

    const query = `
      UPDATE routes 
      SET routeCode = ?, startPoint = ?, endPoint = ?, totalDistance = ?, 
          estimatedDuration = ?, mapUrl = ?, routeType = ?, status = ?
      WHERE routeId = ?
    `;

    db.query(query, [
      routeCode || current.routeCode,
      startPoint || current.startPoint,
      endPoint || current.endPoint,
      totalDistance || current.totalDistance,
      estimatedDuration || current.estimatedDuration,
      mapUrl || current.mapUrl,
      routeType || current.routeType,
      status || current.status,
      id
    ], (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to update route.', error: err.message });
      }

      // Update stops if provided
      if (stops && stops.length > 0) {
        db.query('DELETE FROM route_stops WHERE routeId = ?', [id], (err) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Failed to update stops.', error: err.message });
          }

          let completed = 0;
          let hasError = false;

          stops.forEach((stop, index) => {
            db.query(
              'INSERT INTO route_stops (routeId, stopName, stopOrder, distanceFromStart) VALUES (?, ?, ?, ?)',
              [id, stop.stopName, index + 1, stop.distanceFromStart || null],
              (err) => {
                if (err && !hasError) {
                  hasError = true;
                  return res.status(500).json({ success: false, message: 'Failed to insert stops.', error: err.message });
                }

                completed++;
                if (completed === stops.length && !hasError) {
                  return res.status(200).json({ success: true, message: 'Route updated successfully.' });
                }
              }
            );
          });
        });
      } else {
        return res.status(200).json({ success: true, message: 'Route updated successfully.' });
      }
    });
  });
};

// Delete route - soft delete
const deleteRoute = (req, res) => {
  const { id } = req.params;

  db.query('SELECT depotId FROM routes WHERE routeId = ?', [id], (routeErr, routeRows) => {
    if (routeErr) return res.status(500).json({ success: false, message: 'Database error.', error: routeErr.message });
    if (routeRows.length === 0) return res.status(404).json({ success: false, message: 'Route not found.' });
    if (!sameDepotOrSuperAdmin(req, routeRows[0].depotId)) {
      return res.status(403).json({ success: false, message: 'Route belongs to another depot.' });
    }

  db.query('SELECT scheduleId FROM schedules WHERE routeId = ?', [id], (err, schedules) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }

    if (schedules.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete route with existing schedules. Deactivate it instead.'
      });
    }

    db.query('UPDATE routes SET status = ? WHERE routeId = ?', ['inactive', id], (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete route.', error: err.message });
      }

      return res.status(200).json({ success: true, message: 'Route deactivated successfully.' });
    });
  });
  });
};

// Get available vehicles for route
const getAvailableVehiclesForRoute = (req, res) => {
  const { routeId } = req.params;

  db.query('SELECT * FROM routes WHERE routeId = ?', [routeId], (err, route) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }

    if (route.length === 0) {
      return res.status(404).json({ success: false, message: 'Route not found.' });
    }

    if (!sameDepotOrSuperAdmin(req, route[0].depotId)) {
      return res.status(403).json({ success: false, message: 'Route belongs to another depot.' });
    }

    db.query(`
      SELECT 
        v.vehicleId, v.registrationNo, v.model, v.capacity, v.status, v.mileage,
        CASE 
          WHEN v.capacity >= 40 THEN 'High Capacity'
          WHEN v.capacity >= 25 THEN 'Medium Capacity'
          ELSE 'Low Capacity'
        END as capacityCategory
      FROM vehicles v
      WHERE v.status = 'active' AND v.depotId = ?
      ORDER BY v.capacity DESC
    `, [route[0].depotId], (err, vehicles) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
      }

      return res.status(200).json({ success: true, vehicles });
    });
  });
};

// Get available drivers for route
const getAvailableDriversForRoute = (req, res) => {
  const { routeId } = req.params;

  db.query('SELECT depotId FROM routes WHERE routeId = ?', [routeId], (routeErr, routeRows) => {
    if (routeErr) return res.status(500).json({ success: false, message: 'Database error.', error: routeErr.message });
    if (routeRows.length === 0) return res.status(404).json({ success: false, message: 'Route not found.' });
    if (!sameDepotOrSuperAdmin(req, routeRows[0].depotId)) {
      return res.status(403).json({ success: false, message: 'Route belongs to another depot.' });
    }

  db.query(`
    SELECT 
      d.driverId, d.name, d.licenseNo, d.licenseExpiry, d.phone, d.status,
      CASE 
        WHEN d.licenseExpiry < CURDATE() THEN 'Expired'
        WHEN d.licenseExpiry < DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'Expiring Soon'
        ELSE 'Valid'
      END as licenseStatus,
      DATEDIFF(d.licenseExpiry, CURDATE()) as daysUntilExpiry
    FROM drivers d
    WHERE d.status = 'available' AND d.licenseExpiry > CURDATE() AND d.depotId = ?
    ORDER BY d.licenseExpiry ASC
  `, [routeRows[0].depotId], (err, drivers) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }

    return res.status(200).json({ success: true, drivers });
  });
  });
};

// Assign vehicle and driver to route
const assignVehicleToRoute = (req, res) => {
  const { routeId } = req.params;
  const { vehicleId, driverId, scheduleDate, departureTime, arrivalTime } = req.body;

  if (!vehicleId || !driverId || !scheduleDate) {
    return res.status(400).json({
      success: false,
      message: 'Vehicle ID, Driver ID and Schedule Date are required.'
    });
  }

  db.query('SELECT * FROM routes WHERE routeId = ? AND status = "active"', [routeId], (routeErr, route) => {
    if (routeErr) {
      return res.status(500).json({ success: false, message: 'Database error.', error: routeErr.message });
    }

    if (route.length === 0) {
      return res.status(404).json({ success: false, message: 'Route not found or inactive.' });
    }

    if (!sameDepotOrSuperAdmin(req, route[0].depotId)) {
      return res.status(403).json({ success: false, message: 'Route belongs to another depot.' });
    }

  // Check vehicle is active
  db.query('SELECT * FROM vehicles WHERE vehicleId = ? AND status = "active" AND depotId = ?', [vehicleId, route[0].depotId], (err, vehicle) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }

    if (vehicle.length === 0) {
      return res.status(400).json({ success: false, message: 'Vehicle not available.' });
    }

    // Check driver is available and license valid
    db.query(
      `SELECT * FROM drivers WHERE driverId = ? AND status = 'available' AND licenseExpiry > CURDATE() AND depotId = ?`,
      [driverId, route[0].depotId],
      (err, driver) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
        }

        if (driver.length === 0) {
          return res.status(400).json({ success: false, message: 'Driver not available or license expired.' });
        }

          // Check vehicle not already assigned on same date
          db.query(
            `SELECT * FROM schedules WHERE vehicleId = ? AND scheduleDate = ? AND status NOT IN ('completed', 'cancelled')`,
            [vehicleId, scheduleDate],
            (err, existingVehicle) => {
              if (err) {
                return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
              }

              if (existingVehicle.length > 0) {
                return res.status(400).json({ success: false, message: 'Vehicle already assigned on this date.' });
              }

              // Check driver not already assigned on same date
              db.query(
                `SELECT * FROM schedules WHERE driverId = ? AND scheduleDate = ? AND status NOT IN ('completed', 'cancelled')`,
                [driverId, scheduleDate],
                (err, existingDriver) => {
                  if (err) {
                    return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
                  }

                  if (existingDriver.length > 0) {
                    return res.status(400).json({ success: false, message: 'Driver already assigned on this date.' });
                  }

                  // Create schedule
                  db.query(
                    `INSERT INTO schedules (depotId, routeId, vehicleId, driverId, departureTime, arrivalTime, scheduleDate, scheduleType, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [route[0].depotId, routeId, vehicleId, driverId,
                     departureTime || '08:00:00',
                     arrivalTime || '17:00:00',
                     scheduleDate, 'daily', 'scheduled'],
                    (err, result) => {
                      if (err) {
                        return res.status(500).json({ success: false, message: 'Failed to assign.', error: err.message });
                      }

                      return res.status(201).json({
                        success: true,
                        scheduleId: result.insertId,
                        message: `Successfully assigned ${vehicle[0].registrationNo} and ${driver[0].name} to route ${route[0].routeCode}.`
                      });
                    }
                  );
                }
              );
            }
          );
      }
    );
  });
  });
};

module.exports = {
  getAllRoutes,
  getActiveRoutes,
  getAvailableDrivers,
  getRouteById,
  getRouteMapData,
  createRoute,
  updateRoute,
  deleteRoute,
  getAvailableVehiclesForRoute,
  getAvailableDriversForRoute,
  assignVehicleToRoute
};
