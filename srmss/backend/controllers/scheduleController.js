const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');
const { depotWhere, sameDepotOrSuperAdmin } = require('../utils/depotScope');

// Helper to generate recurrence dates
function generateDates(startDateStr, endDateStr, type) {
  const dates = [];
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date(startDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [startDateStr];
  }

  let current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    if (type === 'weekly') {
      current.setDate(current.getDate() + 7);
    } else if (type === 'monthly') {
      current.setMonth(current.getMonth() + 1);
    } else {
      break;
    }
  }
  return dates;
}

// Check conflicts helper (returns array of conflict messages)
const findConflicts = (scheduleData, excludeId = null) => {
  return new Promise(async (resolve, reject) => {
    const { routeId, vehicleId, driverId, departureTime, arrivalTime, dates, depotId } = scheduleData;
    const conflicts = [];

    // 1. Check Driver License validity for each date
    const checkLicense = () => {
      return new Promise((res, rej) => {
        db.query('SELECT name, licenseExpiry FROM drivers WHERE driverId = ? AND depotId = ?', [driverId, depotId], (err, results) => {
          if (err) return rej(err);
          if (results.length === 0) return rej(new Error('Driver not found.'));

          const driver = results[0];
          const expiryDate = new Date(driver.licenseExpiry);

          for (const dateStr of dates) {
            const schedDate = new Date(dateStr);
            if (expiryDate < schedDate) {
              conflicts.push(`Driver ${driver.name}'s license is expired on ${dateStr} (Expired: ${driver.licenseExpiry.toISOString().split('T')[0]}).`);
            }
          }
          res();
        });
      });
    };

    // 2. Check Driver overlapping schedule conflicts (handles cross-midnight)
    const checkDriverOverlap = () => {
      return new Promise((res, rej) => {
        let completed = 0;
        if (dates.length === 0) return res();

        dates.forEach(dateStr => {
          // Fetch candidate schedules for the same driver on the same date,
          // and also schedules from previous date that spill over (arrival < departure)
          let query = `
            SELECT s.*, d.name as driverName, r.routeCode
            FROM schedules s
            LEFT JOIN drivers d ON s.driverId = d.driverId
            LEFT JOIN routes r ON s.routeId = r.routeId
            WHERE s.driverId = ?
              AND s.depotId = ?
              AND s.status NOT IN ('cancelled')
              AND (
                s.scheduleDate = ?
                OR (s.scheduleDate = DATE_SUB(?, INTERVAL 1 DAY) AND s.arrivalTime < s.departureTime)
              )
          `;
          const params = [driverId, depotId, dateStr, dateStr];

          if (excludeId) {
            query += ' AND s.scheduleId != ?';
            params.push(excludeId);
          }

          db.query(query, params, (err, results) => {
            if (err) return rej(err);

            // Build new schedule interval
            const newStart = new Date(`${dateStr}T${departureTime}`);
            let newEnd = new Date(`${dateStr}T${arrivalTime}`);
            if (arrivalTime <= departureTime) {
              // spans to next day
              newEnd.setDate(newEnd.getDate() + 1);
            }

            results.forEach(conflict => {
              // Use server-local date parts to avoid timezone shifts from toISOString()
              const d = new Date(conflict.scheduleDate);
              const pad = (n) => n.toString().padStart(2, '0');
              const existingDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
              const existingStart = new Date(`${existingDate}T${conflict.departureTime}`);
              let existingEnd = new Date(`${existingDate}T${conflict.arrivalTime}`);
              if (conflict.arrivalTime <= conflict.departureTime) {
                existingEnd.setDate(existingEnd.getDate() + 1);
              }

              // Check overlap (inclusive) -- intervals overlap if start < otherEnd and end > otherStart
              if (existingStart < newEnd && existingEnd > newStart) {
                conflicts.push(`Driver ${conflict.driverName} is already assigned to Route ${conflict.routeCode} on ${existingDate} from ${conflict.departureTime} to ${conflict.arrivalTime}.`);
              }
            });

            completed++;
            if (completed === dates.length) res();
          });
        });
      });
    };

    // 3. Check Vehicle overlapping schedule conflicts (handles cross-midnight)
    const checkVehicleOverlap = () => {
      return new Promise((res, rej) => {
        let completed = 0;
        if (dates.length === 0) return res();

        dates.forEach(dateStr => {
          let query = `
            SELECT s.*, v.registrationNo, r.routeCode
            FROM schedules s
            LEFT JOIN vehicles v ON s.vehicleId = v.vehicleId
            LEFT JOIN routes r ON s.routeId = r.routeId
            WHERE s.vehicleId = ?
              AND s.depotId = ?
              AND s.status NOT IN ('cancelled')
              AND (
                s.scheduleDate = ?
                OR (s.scheduleDate = DATE_SUB(?, INTERVAL 1 DAY) AND s.arrivalTime < s.departureTime)
              )
          `;
          const params = [vehicleId, depotId, dateStr, dateStr];

          if (excludeId) {
            query += ' AND s.scheduleId != ?';
            params.push(excludeId);
          }

          db.query(query, params, (err, results) => {
            if (err) return rej(err);

            const newStart = new Date(`${dateStr}T${departureTime}`);
            let newEnd = new Date(`${dateStr}T${arrivalTime}`);
            if (arrivalTime <= departureTime) newEnd.setDate(newEnd.getDate() + 1);

            results.forEach(conflict => {
              const d = new Date(conflict.scheduleDate);
              const pad = (n) => n.toString().padStart(2, '0');
              const existingDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
              const existingStart = new Date(`${existingDate}T${conflict.departureTime}`);
              let existingEnd = new Date(`${existingDate}T${conflict.arrivalTime}`);
              if (conflict.arrivalTime <= conflict.departureTime) existingEnd.setDate(existingEnd.getDate() + 1);

              if (existingStart < newEnd && existingEnd > newStart) {
                conflicts.push(`Vehicle ${conflict.registrationNo} is already assigned to Route ${conflict.routeCode} on ${existingDate} from ${conflict.departureTime} to ${conflict.arrivalTime}.`);
              }
            });

            completed++;
            if (completed === dates.length) res();
          });
        });
      });
    };

    try {
      await checkLicense();
      await checkDriverOverlap();
      await checkVehicleOverlap();
      resolve(conflicts);
    } catch (err) {
      reject(err);
    }
  });
};

// API checking for conflicts dynamically
const apiCheckConflicts = async (req, res) => {
  const { routeId, vehicleId, driverId, departureTime, arrivalTime, scheduleDate, scheduleType, endDate, excludeId } = req.body;

  if (!vehicleId || !driverId || !departureTime || !arrivalTime || !scheduleDate) {
    return res.status(400).json({ success: false, message: 'Missing required parameters.' });
  }

  const dates = generateDates(scheduleDate, endDate, scheduleType);

  db.query('SELECT depotId FROM routes WHERE routeId = ?', [routeId], async (routeErr, routeRows) => {
    if (routeErr) return res.status(500).json({ success: false, message: 'Database error.', error: routeErr.message });
    if (routeRows.length === 0) return res.status(404).json({ success: false, message: 'Route not found.' });
    if (!sameDepotOrSuperAdmin(req, routeRows[0].depotId)) {
      return res.status(403).json({ success: false, message: 'Route belongs to another depot.' });
    }

    try {
      const conflicts = await findConflicts({ routeId, vehicleId, driverId, departureTime, arrivalTime, dates, depotId: routeRows[0].depotId }, excludeId || null);
      return res.status(200).json({ success: true, hasConflicts: conflicts.length > 0, conflicts });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Conflict detection failed.', error: err.message });
    }
  });
};

// Get all schedules
const getAllSchedules = (req, res) => {
  const scope = depotWhere(req, 's');
  const query = `
    SELECT s.*, 
           dep.name AS depotName,
           r.routeCode, r.startPoint, r.endPoint,
           v.registrationNo, v.model,
           d.name as driverName
    FROM schedules s
    LEFT JOIN depots dep ON s.depotId = dep.depotId
    LEFT JOIN routes r ON s.routeId = r.routeId
    LEFT JOIN vehicles v ON s.vehicleId = v.vehicleId
    LEFT JOIN drivers d ON s.driverId = d.driverId
    WHERE 1=1 ${scope.clause}
    ORDER BY s.scheduleDate DESC, s.departureTime ASC
  `;

  db.query(query, scope.params, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }
    return res.status(200).json({ success: true, schedules: results });
  });
};

// Create schedule(s)
const createSchedule = async (req, res) => {
  const { routeId, vehicleId, driverId, departureTime, arrivalTime, scheduleDate, scheduleType, endDate, notes } = req.body;

  if (!routeId || !vehicleId || !driverId || !departureTime || !arrivalTime || !scheduleDate) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  const dates = generateDates(scheduleDate, endDate, scheduleType);

  db.query(`
    SELECT r.depotId
    FROM routes r
    INNER JOIN vehicles v ON v.vehicleId = ? AND v.depotId = r.depotId
    INNER JOIN drivers d ON d.driverId = ? AND d.depotId = r.depotId
    WHERE r.routeId = ?
  `, [vehicleId, driverId, routeId], async (scopeErr, scopeRows) => {
    if (scopeErr) return res.status(500).json({ success: false, message: 'Database error.', error: scopeErr.message });
    if (scopeRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Route, vehicle and driver must belong to the same depot.' });
    }

    const depotId = scopeRows[0].depotId;
    if (!sameDepotOrSuperAdmin(req, depotId)) {
      return res.status(403).json({ success: false, message: 'Schedule belongs to another depot.' });
    }

    try {
      const conflicts = await findConflicts({ routeId, vehicleId, driverId, departureTime, arrivalTime, dates, depotId });
      if (conflicts.length > 0) {
        return res.status(409).json({ success: false, message: 'Conflict(s) detected.', conflicts });
      }

      // Insert schedules one by one
      let insertedCount = 0;
      const insertPromises = dates.map(dateStr => {
        return new Promise((resolveInsert, rejectInsert) => {
          const query = `
          INSERT INTO schedules (depotId, routeId, vehicleId, driverId, departureTime, arrivalTime, scheduleDate, scheduleType, notes, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
        `;
          db.query(query, [depotId, routeId, vehicleId, driverId, departureTime, arrivalTime, dateStr, scheduleType || 'daily', notes || ''], (err, result) => {
            if (err) return rejectInsert(err);
            insertedCount++;
            resolveInsert(result);
          });
        });
      });

      await Promise.all(insertPromises);

      // Log user activity
      logActivity(req.user?.userId, 'CREATE', 'Schedules', `Created ${insertedCount} schedules starting on ${scheduleDate} (${scheduleType})`, depotId);

      return res.status(201).json({
        success: true,
        message: `Successfully created ${insertedCount} schedule(s).`
      });

    } catch (err) {
      return res.status(500).json({ success: false, message: 'Failed to create schedule.', error: err.message });
    }
  });
};

// Update schedule
const updateSchedule = async (req, res) => {
  const { id } = req.params;
  const { routeId, vehicleId, driverId, departureTime, arrivalTime, scheduleDate, scheduleType, notes, status, actualDeparture, actualArrival } = req.body;

  db.query('SELECT * FROM schedules WHERE scheduleId = ?', [id], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Schedule not found.' });

    const current = results[0];

    if (!sameDepotOrSuperAdmin(req, current.depotId)) {
      return res.status(403).json({ success: false, message: 'Schedule belongs to another depot.' });
    }

    const upRouteId = routeId || current.routeId;
    const upVehicleId = vehicleId || current.vehicleId;
    const upDriverId = driverId || current.driverId;
    const upDepartureTime = departureTime || current.departureTime;
    const upArrivalTime = arrivalTime || current.arrivalTime;
    const upScheduleDate = scheduleDate ? scheduleDate.split('T')[0] : current.scheduleDate.toISOString().split('T')[0];
    const upScheduleType = scheduleType || current.scheduleType;
    const upStatus = status || current.status;
    const upNotes = notes !== undefined ? notes : current.notes;

    db.query(`
      SELECT r.depotId
      FROM routes r
      INNER JOIN vehicles v ON v.vehicleId = ? AND v.depotId = r.depotId
      INNER JOIN drivers d ON d.driverId = ? AND d.depotId = r.depotId
      WHERE r.routeId = ?
    `, [upVehicleId, upDriverId, upRouteId], async (scopeErr, scopeRows) => {
      if (scopeErr) return res.status(500).json({ success: false, message: 'Database error.', error: scopeErr.message });
      if (scopeRows.length === 0) {
        return res.status(400).json({ success: false, message: 'Route, vehicle and driver must belong to the same depot.' });
      }

      const upDepotId = scopeRows[0].depotId;
      if (!sameDepotOrSuperAdmin(req, upDepotId)) {
        return res.status(403).json({ success: false, message: 'Schedule belongs to another depot.' });
      }

      try {
        const conflicts = await findConflicts({
          routeId: upRouteId,
          vehicleId: upVehicleId,
          driverId: upDriverId,
          departureTime: upDepartureTime,
          arrivalTime: upArrivalTime,
          dates: [upScheduleDate],
          depotId: upDepotId
        }, id);

        if (conflicts.length > 0) {
          return res.status(409).json({ success: false, message: 'Conflict(s) detected.', conflicts });
        }

        // Format actualDeparture and actualArrival
        const formattedActualDeparture = actualDeparture || null;
        const formattedActualArrival = actualArrival || null;

        const updateQuery = `
        UPDATE schedules 
        SET depotId = ?, routeId = ?, vehicleId = ?, driverId = ?, departureTime = ?, arrivalTime = ?, scheduleDate = ?, scheduleType = ?, notes = ?, status = ?, actualDeparture = ?, actualArrival = ?
        WHERE scheduleId = ?
      `;

        db.query(updateQuery, [
          upDepotId,
          upRouteId,
          upVehicleId,
          upDriverId,
          upDepartureTime,
          upArrivalTime,
          upScheduleDate,
          upScheduleType,
          upNotes,
          upStatus,
          formattedActualDeparture,
          formattedActualArrival,
          id
        ], (err) => {
          if (err) return res.status(500).json({ success: false, message: 'Failed to update schedule.', error: err.message });

          logActivity(req.user?.userId, 'UPDATE', 'Schedules', `Updated schedule ID ${id} to status ${upStatus}`, upDepotId);

          return res.status(200).json({ success: true, message: 'Schedule updated successfully.' });
        });

      } catch (err) {
        return res.status(500).json({ success: false, message: 'Error updating schedule.', error: err.message });
      }
    });
  });
};

// Delete / Cancel schedule
const deleteSchedule = (req, res) => {
  const { id } = req.params;

  db.query('SELECT * FROM schedules WHERE scheduleId = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Schedule not found.' });
    if (!sameDepotOrSuperAdmin(req, results[0].depotId)) {
      return res.status(403).json({ success: false, message: 'Schedule belongs to another depot.' });
    }

    db.query('DELETE FROM schedules WHERE scheduleId = ?', [id], (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete schedule.', error: err.message });
      }

      logActivity(req.user?.userId, 'DELETE', 'Schedules', `Deleted schedule ID ${id}`, results[0].depotId);

      return res.status(200).json({ success: true, message: 'Schedule deleted successfully.' });
    });
  });
};

// Get schedules for the currently logged-in driver
const getMySchedules = (req, res) => {
  // If user is a driver, return schedules assigned to that driver.
  if (req.user.role === 'driver') {
    db.query('SELECT * FROM drivers WHERE userId = ?', [req.user.userId], (err, drivers) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
      if (drivers.length === 0) return res.status(404).json({ success: false, message: 'Driver profile not found for this user.' });

      const driverId = drivers[0].driverId;
      const scope = depotWhere(req, 's');
      const query = `
        SELECT s.*, dep.name AS depotName, r.routeCode, r.startPoint, r.endPoint, v.registrationNo, v.model, d.name as driverName
        FROM schedules s
        LEFT JOIN depots dep ON s.depotId = dep.depotId
        LEFT JOIN routes r ON s.routeId = r.routeId
        LEFT JOIN vehicles v ON s.vehicleId = v.vehicleId
        LEFT JOIN drivers d ON s.driverId = d.driverId
        WHERE s.driverId = ? ${scope.clause}
        ORDER BY s.scheduleDate DESC, s.departureTime ASC
      `;

      db.query(query, [driverId, ...scope.params], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
        return res.status(200).json({ success: true, schedules: results });
      });
    });
    return;
  }

  // If user is an operator, return schedules for their depot (all drivers/vehicles)
  if (req.user.role === 'operator') {
    const depotId = req.user.depotId;
    if (!depotId) return res.status(400).json({ success: false, message: 'Operator not assigned to a depot.' });

    const query = `
      SELECT s.*, dep.name AS depotName, r.routeCode, r.startPoint, r.endPoint, v.registrationNo, v.model, d.name as driverName
      FROM schedules s
      LEFT JOIN depots dep ON s.depotId = dep.depotId
      LEFT JOIN routes r ON s.routeId = r.routeId
      LEFT JOIN vehicles v ON s.vehicleId = v.vehicleId
      LEFT JOIN drivers d ON s.driverId = d.driverId
      WHERE s.depotId = ?
      ORDER BY s.scheduleDate DESC, s.departureTime ASC
    `;

    db.query(query, [depotId], (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
      return res.status(200).json({ success: true, schedules: results });
    });
    return;
  }

  return res.status(403).json({ success: false, message: 'Access denied.' });
};

// Driver starts a trip
const startSchedule = (req, res) => {
  const { id } = req.params;


  db.query('SELECT * FROM schedules WHERE scheduleId = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Schedule not found.' });

    const vid = results[2];
    db.query('UPDATE vehicles SET status = ? WHERE vehicleId = ?', ['inactive', vid], (vErr) => { });

    const sched = results[0];
    if (!sameDepotOrSuperAdmin(req, sched.depotId)) {
      return res.status(403).json({ success: false, message: 'Schedule belongs to another depot.' });
    }

    // If user is a driver, ensure this schedule belongs to them
    if (req.user.role === 'driver') {
      db.query('SELECT * FROM drivers WHERE userId = ?', [req.user.userId], (dErr, dRes) => {
        if (dErr) return res.status(500).json({ success: false, message: 'Database error.', error: dErr.message });
        if (dRes.length === 0 || dRes[0].driverId !== sched.driverId) {
          return res.status(403).json({ success: false, message: 'You are not assigned to this schedule.' });
        }

        // Proceed to start
        doStart();
      });
    } else {
      doStart();
    }

    function doStart() {
      if (sched.status === 'ongoing') {
        return res.status(400).json({ success: false, message: 'Trip already started.' });
      }

      const now = new Date();
      db.query('UPDATE schedules SET status = ?, actualDeparture = ? WHERE scheduleId = ?', ['ongoing', now, id], (uErr) => {
        if (uErr) return res.status(500).json({ success: false, message: 'Failed to start trip.', error: uErr.message });

        // Update driver status to on_trip
        db.query('UPDATE drivers SET status = ? WHERE driverId = ?', ['on_trip', sched.driverId], (dErr) => {
          if (dErr) console.error('Failed updating driver status:', dErr.message);
        });

        // Mark the scheduled vehicle as inactive so it is reserved while the trip is in progress
        db.query('UPDATE vehicles SET status = ? WHERE vehicleId = ?', ['inactive', sched.vehicleId], (vErr) => {
          if (vErr) console.error('Failed updating vehicle status:', vErr.message);

          // fetch updated vehicle to return to client for immediate UI refresh
          db.query('SELECT * FROM vehicles WHERE vehicleId = ?', [sched.vehicleId], (vSelErr, vRows) => {
            if (vSelErr) console.error('Failed selecting vehicle after update:', vSelErr.message);

            logActivity(req.user?.userId, 'UPDATE', 'Schedules', `Started schedule ID ${id}`, sched.depotId);

            return res.status(200).json({ success: true, message: 'Trip started.', vehicle: vRows && vRows[0] ? vRows[0] : null });
          });
        });
      });
    }
  });
};

// Driver ends a trip
const endSchedule = (req, res) => {
  const { id } = req.params;

  db.query('SELECT * FROM schedules WHERE scheduleId = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Schedule not found.' });
    const vid = results[2];
    db.query('UPDATE vehicles SET status = ? WHERE vehicleId = ?', ['active', vid], (vErr) => { });
    const sched = results[0];
    if (!sameDepotOrSuperAdmin(req, sched.depotId)) {
      return res.status(403).json({ success: false, message: 'Schedule belongs to another depot.' });
    }

    // If user is a driver, ensure this schedule belongs to them
    if (req.user.role === 'driver') {
      db.query('SELECT * FROM drivers WHERE userId = ?', [req.user.userId], (dErr, dRes) => {
        if (dErr) return res.status(500).json({ success: false, message: 'Database error.', error: dErr.message });
        if (dRes.length === 0 || dRes[0].driverId !== sched.driverId) {
          return res.status(403).json({ success: false, message: 'You are not assigned to this schedule.' });
        }

        doEnd();
      });
    } else {
      doEnd();
    }

    function doEnd() {
      if (sched.status !== 'ongoing') {
        // allow ending even if status not ongoing but respond accordingly
      }

      const now = new Date();
      db.query('UPDATE schedules SET status = ?, actualArrival = ? WHERE scheduleId = ?', ['completed', now, id], (uErr) => {
        if (uErr) return res.status(500).json({ success: false, message: 'Failed to end trip.', error: uErr.message });

        // Update driver status to available
        db.query('UPDATE drivers SET status = ? WHERE driverId = ?', ['available', sched.driverId], (dErr) => {
          if (dErr) console.error('Failed updating driver status:', dErr.message);
        });

        // Mark the schedule's vehicle as active again
        db.query('UPDATE vehicles SET status = ? WHERE vehicleId = ?', ['active', sched.vehicleId], (vErr) => {
          if (vErr) console.error('Failed updating vehicle status:', vErr.message);

          // fetch updated vehicle to return
          db.query('SELECT * FROM vehicles WHERE vehicleId = ?', [sched.vehicleId], (vSelErr, vRows) => {
            if (vSelErr) console.error('Failed selecting vehicle after update:', vSelErr.message);

            logActivity(req.user?.userId, 'UPDATE', 'Schedules', `Ended schedule ID ${id}`, sched.depotId);

            return res.status(200).json({ success: true, message: 'Trip ended.', vehicle: vRows && vRows[0] ? vRows[0] : null });
          });
        });
      });
    }
  });
};

module.exports = {
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  apiCheckConflicts,
  getMySchedules,
  startSchedule,
  endSchedule
};
