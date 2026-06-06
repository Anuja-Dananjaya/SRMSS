const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

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
    const { routeId, vehicleId, driverId, departureTime, arrivalTime, dates } = scheduleData;
    const conflicts = [];

    // 1. Check Driver License validity for each date
    const checkLicense = () => {
      return new Promise((res, rej) => {
        db.query('SELECT name, licenseExpiry FROM drivers WHERE driverId = ?', [driverId], (err, results) => {
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

    // 2. Check Driver overlapping schedule conflicts
    const checkDriverOverlap = () => {
      return new Promise((res, rej) => {
        let completed = 0;
        if (dates.length === 0) return res();

        dates.forEach(dateStr => {
          let query = `
            SELECT s.*, d.name as driverName, r.routeCode
            FROM schedules s
            LEFT JOIN drivers d ON s.driverId = d.driverId
            LEFT JOIN routes r ON s.routeId = r.routeId
            WHERE s.driverId = ? 
              AND s.scheduleDate = ? 
              AND s.status NOT IN ('cancelled')
              AND s.departureTime < ? 
              AND s.arrivalTime > ?
          `;
          const params = [driverId, dateStr, arrivalTime, departureTime];

          if (excludeId) {
            query += ' AND s.scheduleId != ?';
            params.push(excludeId);
          }

          db.query(query, params, (err, results) => {
            if (err) return rej(err);
            results.forEach(conflict => {
              conflicts.push(`Driver ${conflict.driverName} is already assigned to Route ${conflict.routeCode} on ${dateStr} from ${conflict.departureTime} to ${conflict.arrivalTime}.`);
            });
            completed++;
            if (completed === dates.length) res();
          });
        });
      });
    };

    // 3. Check Vehicle overlapping schedule conflicts
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
              AND s.scheduleDate = ? 
              AND s.status NOT IN ('cancelled')
              AND s.departureTime < ? 
              AND s.arrivalTime > ?
          `;
          const params = [vehicleId, dateStr, arrivalTime, departureTime];

          if (excludeId) {
            query += ' AND s.scheduleId != ?';
            params.push(excludeId);
          }

          db.query(query, params, (err, results) => {
            if (err) return rej(err);
            results.forEach(conflict => {
              conflicts.push(`Vehicle ${conflict.registrationNo} is already assigned to Route ${conflict.routeCode} on ${dateStr} from ${conflict.departureTime} to ${conflict.arrivalTime}.`);
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

  try {
    const conflicts = await findConflicts({ routeId, vehicleId, driverId, departureTime, arrivalTime, dates }, excludeId || null);
    return res.status(200).json({ success: true, hasConflicts: conflicts.length > 0, conflicts });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Conflict detection failed.', error: err.message });
  }
};

// Get all schedules
const getAllSchedules = (req, res) => {
  const query = `
    SELECT s.*, 
           r.routeCode, r.startPoint, r.endPoint,
           v.registrationNo, v.model,
           d.name as driverName,
           dep.name as depotName, dep.location as depotLocation
    FROM schedules s
    LEFT JOIN routes r ON s.routeId = r.routeId
    LEFT JOIN vehicles v ON s.vehicleId = v.vehicleId
    LEFT JOIN drivers d ON s.driverId = d.driverId
    LEFT JOIN depots dep ON s.depotId = dep.depotId
    ORDER BY s.scheduleDate DESC, s.departureTime ASC
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    }
    return res.status(200).json({ success: true, schedules: results });
  });
};

// Create schedule(s)
const createSchedule = async (req, res) => {
  const { routeId, vehicleId, driverId, departureTime, arrivalTime, scheduleDate, scheduleType, endDate, notes, depotId } = req.body;

  if (!routeId || !vehicleId || !driverId || !departureTime || !arrivalTime || !scheduleDate) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  const dates = generateDates(scheduleDate, endDate, scheduleType);

  try {
    const conflicts = await findConflicts({ routeId, vehicleId, driverId, departureTime, arrivalTime, dates });
    if (conflicts.length > 0) {
      return res.status(409).json({ success: false, message: 'Conflict(s) detected.', conflicts });
    }

    // Insert schedules one by one
    let insertedCount = 0;
    const insertPromises = dates.map(dateStr => {
      return new Promise((resolveInsert, rejectInsert) => {
        const query = `
          INSERT INTO schedules (routeId, vehicleId, driverId, departureTime, arrivalTime, scheduleDate, scheduleType, notes, status, depotId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)
        `;
        db.query(query, [routeId, vehicleId, driverId, departureTime, arrivalTime, dateStr, scheduleType || 'daily', notes || '', depotId || null], (err, result) => {
          if (err) return rejectInsert(err);
          insertedCount++;
          resolveInsert(result);
        });
      });
    });

    await Promise.all(insertPromises);

    // Log user activity
    logActivity(req.user?.userId, 'CREATE', 'Schedules', `Created ${insertedCount} schedules starting on ${scheduleDate} (${scheduleType})`);

    return res.status(201).json({
      success: true,
      message: `Successfully created ${insertedCount} schedule(s).`
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create schedule.', error: err.message });
  }
};

// Update schedule
const updateSchedule = async (req, res) => {
  const { id } = req.params;
  const { routeId, vehicleId, driverId, departureTime, arrivalTime, scheduleDate, scheduleType, notes, status, actualDeparture, actualArrival, depotId } = req.body;

  db.query('SELECT * FROM schedules WHERE scheduleId = ?', [id], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Schedule not found.' });

    const current = results[0];

    const upRouteId = routeId || current.routeId;
    const upVehicleId = vehicleId || current.vehicleId;
    const upDriverId = driverId || current.driverId;
    const upDepartureTime = departureTime || current.departureTime;
    const upArrivalTime = arrivalTime || current.arrivalTime;
    const upScheduleDate = scheduleDate ? scheduleDate.split('T')[0] : current.scheduleDate.toISOString().split('T')[0];
    const upScheduleType = scheduleType || current.scheduleType;
    const upStatus = status || current.status;
    const upNotes = notes !== undefined ? notes : current.notes;
    const upDepotId = depotId !== undefined ? (depotId || null) : current.depotId;

    // Run conflict detection excluding current scheduleId
    try {
      const conflicts = await findConflicts({
        routeId: upRouteId,
        vehicleId: upVehicleId,
        driverId: upDriverId,
        departureTime: upDepartureTime,
        arrivalTime: upArrivalTime,
        dates: [upScheduleDate]
      }, id);

      if (conflicts.length > 0) {
        return res.status(409).json({ success: false, message: 'Conflict(s) detected.', conflicts });
      }

      // Format actualDeparture and actualArrival
      const formattedActualDeparture = actualDeparture || null;
      const formattedActualArrival = actualArrival || null;

      const updateQuery = `
        UPDATE schedules 
        SET routeId = ?, vehicleId = ?, driverId = ?, departureTime = ?, arrivalTime = ?, scheduleDate = ?, scheduleType = ?, notes = ?, status = ?, actualDeparture = ?, actualArrival = ?, depotId = ?
        WHERE scheduleId = ?
      `;

      db.query(updateQuery, [
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
        upDepotId,
        id
      ], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Failed to update schedule.', error: err.message });

        logActivity(req.user?.userId, 'UPDATE', 'Schedules', `Updated schedule ID ${id} to status ${upStatus}`);

        return res.status(200).json({ success: true, message: 'Schedule updated successfully.' });
      });

    } catch (err) {
      return res.status(500).json({ success: false, message: 'Error updating schedule.', error: err.message });
    }
  });
};

// Delete / Cancel schedule
const deleteSchedule = (req, res) => {
  const { id } = req.params;

  db.query('SELECT * FROM schedules WHERE scheduleId = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error.', error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Schedule not found.' });

    db.query('DELETE FROM schedules WHERE scheduleId = ?', [id], (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete schedule.', error: err.message });
      }

      logActivity(req.user?.userId, 'DELETE', 'Schedules', `Deleted schedule ID ${id}`);

      return res.status(200).json({ success: true, message: 'Schedule deleted successfully.' });
    });
  });
};

module.exports = {
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  apiCheckConflicts
};
