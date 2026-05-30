const db = require('../config/db');

// Get all routes with the stops count
exports.getAllRoutes = async (req, res) => {
    try {
        const [routes] = await db.query(`
            SELECT 
                r.*,
                COUNT(DISTINCT rs.stopId) as total_stops
            FROM routes r
            LEFT JOIN route_stops rs ON rs.routeId = r.routeId
            GROUP BY r.routeId
            ORDER BY r.routeId DESC
        `);
        res.json({ success: true, routes });
    } catch (error) {
        console.error('Error fetching routes:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get single route with all the stops
exports.getRouteById = async (req, res) => {
    try {
        const [routes] = await db.query(
            'SELECT * FROM routes WHERE routeId = ?',
            [req.params.id]
        );
        
        if (routes.length === 0) {
            return res.status(404).json({ success: false, message: 'Route not found' });
        }
        
        // Get route stops
        const [stops] = await db.query(
            'SELECT * FROM route_stops WHERE routeId = ? ORDER BY stopOrder',
            [req.params.id]
        );
        
        // Get available vehicles for this route
        const [availableVehicles] = await db.query(`
            SELECT vehicleId, registrationNo, model, capacity
            FROM vehicles 
            WHERE status = 'active'
        `);
        
        // Get available drivers for this route
        const [availableDrivers] = await db.query(`
            SELECT driverId, name, licenseNo, licenseExpiry, phone
            FROM drivers
            WHERE status = 'available' AND licenseExpiry > CURDATE()
        `);
        
        routes[0].stops = stops;
        routes[0].available_vehicles = availableVehicles;
        routes[0].available_drivers = availableDrivers;
        
        res.json({ success: true, route: routes[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Create route with stops
exports.createRoute = async (req, res) => {
    const {
        routeCode,
        startPoint,
        endPoint,
        totalDistance,
        estimatedDuration,
        mapUrl,
        routeType,
        status,
        stops
    } = req.body;

    if (!routeCode || !startPoint || !endPoint) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields: routeCode, startPoint, endPoint' 
        });
    }

    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Check duplicate route code
        const [existing] = await connection.query(
            'SELECT routeId FROM routes WHERE routeCode = ?',
            [routeCode]
        );
        
        if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Route code already exists' });
        }

        // Insert the route
        const [result] = await connection.query(
            `INSERT INTO routes (routeCode, startPoint, endPoint, totalDistance, estimatedDuration, mapUrl, routeType, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [routeCode, startPoint, endPoint, totalDistance || null, estimatedDuration || null, 
             mapUrl || null, routeType || 'urban', status || 'active']
        );
        
        const routeId = result.insertId;
        
        // Insert stops if provided
        if (stops && stops.length > 0) {
            for (let i = 0; i < stops.length; i++) {
                await connection.query(
                    `INSERT INTO route_stops (routeId, stopName, stopOrder, distanceFromStart)
                     VALUES (?, ?, ?, ?)`,
                    [routeId, stops[i].stopName, i + 1, stops[i].distanceFromStart || null]
                );
            }
        }
        
        await connection.commit();
        
        const [newRoute] = await db.query(
            'SELECT * FROM routes WHERE routeId = ?',
            [routeId]
        );
        
        res.json({ success: true, route: newRoute[0], message: 'Route created successfully' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        connection.release();
    }
};

// Update the route
exports.updateRoute = async (req, res) => {
    const {
        routeCode,
        startPoint,
        endPoint,
        totalDistance,
        estimatedDuration,
        mapUrl,
        routeType,
        status,
        stops
    } = req.body;

    try {
        const [existing] = await db.query(
            'SELECT routeId FROM routes WHERE routeId = ?',
            [req.params.id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Route not found' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        // Update the route
        await connection.query(
            `UPDATE routes SET 
                routeCode = ?, startPoint = ?, endPoint = ?, 
                totalDistance = ?, estimatedDuration = ?, 
                mapUrl = ?, routeType = ?, status = ?
             WHERE routeId = ?`,
            [routeCode, startPoint, endPoint, totalDistance, estimatedDuration, 
             mapUrl, routeType, status, req.params.id]
        );

        // Update stops if provided
        if (stops && stops.length > 0) {
            await connection.query('DELETE FROM route_stops WHERE routeId = ?', [req.params.id]);
            for (let i = 0; i < stops.length; i++) {
                await connection.query(
                    `INSERT INTO route_stops (routeId, stopName, stopOrder, distanceFromStart)
                     VALUES (?, ?, ?, ?)`,
                    [req.params.id, stops[i].stopName, i + 1, stops[i].distanceFromStart || null]
                );
            }
        }

        await connection.commit();
        connection.release();

        const [updated] = await db.query(
            'SELECT * FROM routes WHERE routeId = ?',
            [req.params.id]
        );
        
        res.json({ success: true, route: updated[0], message: 'Route updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Delete route
exports.deleteRoute = async (req, res) => {
    try {
        const [schedules] = await db.query(
            'SELECT scheduleId FROM schedules WHERE routeId = ?',
            [req.params.id]
        );
        
        if (schedules.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot delete route with existing schedules. Deactivate it instead.' 
            });
        }

        await db.query(
            'UPDATE routes SET status = "inactive" WHERE routeId = ?',
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Route deactivated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Assign vehicle and driver to the route
exports.assignToRoute = async (req, res) => {
    const { vehicleId, driverId, scheduleDate, departureTime, arrivalTime } = req.body;
    
    if (!vehicleId || !driverId || !scheduleDate) {
        return res.status(400).json({ 
            success: false, 
            message: 'Vehicle ID, Driver ID, and Schedule Date required' 
        });
    }
    
    try {
        // Check vehicle availability
        const [vehicle] = await db.query(
            'SELECT * FROM vehicles WHERE vehicleId = ? AND status = "active"',
            [vehicleId]
        );
        
        if (vehicle.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Vehicle not available for assignment' 
            });
        }
        
        // Check driver availability and license
        const [driver] = await db.query(
            `SELECT * FROM drivers 
             WHERE driverId = ? AND status = 'available' AND licenseExpiry > CURDATE()`,
            [driverId]
        );
        
        if (driver.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Driver not available or license expired' 
            });
        }
        
        // Check if route exists and it it is active
        const [route] = await db.query(
            'SELECT * FROM routes WHERE routeId = ? AND status = "active"',
            [req.params.routeId]
        );
        
        if (route.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Route not found or inactive' 
            });
        }
        
        // Create schedule assignment
        const [result] = await db.query(
            `INSERT INTO schedules (routeId, vehicleId, driverId, departureTime, arrivalTime, scheduleDate, scheduleType, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.params.routeId, vehicleId, driverId, 
             departureTime || '08:00:00', arrivalTime || '17:00:00', 
             scheduleDate, 'daily', 'scheduled']
        );
        
        res.json({ 
            success: true, 
            scheduleId: result.insertId, 
            message: 'Vehicle and driver assigned to route successfully' 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get route for map visualization
exports.getRouteMapData = async (req, res) => {
    try {
        const [routes] = await db.query(
            'SELECT * FROM routes WHERE routeId = ?',
            [req.params.id]
        );
        
        if (routes.length === 0) {
            return res.status(404).json({ success: false, message: 'Route not found' });
        }
        
        const [stops] = await db.query(
            'SELECT stopOrder, stopName, distanceFromStart FROM route_stops WHERE routeId = ? ORDER BY stopOrder',
            [req.params.id]
        );
        
        res.json({ 
            success: true, 
            route: routes[0],
            stops: stops
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get active routes for dropdown
exports.getActiveRoutes = async (req, res) => {
    try {
        const [routes] = await db.query(
            'SELECT routeId, routeCode, startPoint, endPoint, routeType FROM routes WHERE status = "active" ORDER BY routeCode'
        );
        res.json({ success: true, routes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get available drivers for assignment
exports.getAvailableDrivers = async (req, res) => {
    try {
        const [drivers] = await db.query(`
            SELECT driverId, name, licenseNo, licenseExpiry, phone, status
            FROM drivers
            WHERE status = 'available' AND licenseExpiry > CURDATE()
        `);
        res.json({ success: true, drivers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get available vehicles for route assignment (with capacity check)
exports.getAvailableVehiclesForRoute = async (req, res) => {
    const { routeId } = req.params;
    
    try {
        // Get route details first to check required capacity
        const [route] = await db.query('SELECT * FROM routes WHERE routeId = ?', [routeId]);
        
        if (route.length === 0) {
            return res.status(404).json({ success: false, message: 'Route not found' });
        }
        
        // Get available vehicles (active status) with capacity info
        const [vehicles] = await db.query(`
            SELECT 
                v.vehicleId, 
                v.registrationNo, 
                v.model, 
                v.capacity, 
                v.status,
                v.mileage,
                CASE 
                    WHEN v.capacity >= 40 THEN 'High Capacity'
                    WHEN v.capacity >= 25 THEN 'Medium Capacity'
                    ELSE 'Low Capacity'
                END as capacityCategory
            FROM vehicles v
            WHERE v.status = 'active'
            ORDER BY v.capacity DESC
        `);
        
        // Also get currently assigned vehicles for this route
        const [assignedVehicles] = await db.query(`
            SELECT v.*, s.scheduleDate, s.departureTime
            FROM schedules s
            JOIN vehicles v ON v.vehicleId = s.vehicleId
            WHERE s.routeId = ? AND s.scheduleDate >= CURDATE()
        `, [routeId]);
        
        res.json({ 
            success: true, 
            vehicles,
            assignedVehicles,
            routeCapacity: route[0].avg_passengers || 30
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get available drivers for route assignment (with license check)
exports.getAvailableDriversForRoute = async (req, res) => {
    const { routeId } = req.params;
    
    try {
        // Get available drivers (active status + valid license)
        const [drivers] = await db.query(`
            SELECT 
                d.driverId, 
                d.name, 
                d.licenseNo, 
                d.licenseExpiry,
                d.phone,
                d.status,
                CASE 
                    WHEN d.licenseExpiry < CURDATE() THEN 'Expired'
                    WHEN d.licenseExpiry < DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'Expiring Soon'
                    ELSE 'Valid'
                END as licenseStatus,
                DATEDIFF(d.licenseExpiry, CURDATE()) as daysUntilExpiry
            FROM drivers d
            WHERE d.status = 'available' AND d.licenseExpiry > CURDATE()
            ORDER BY d.licenseExpiry ASC
        `);
        
        // Get currently assigned drivers for this route
        const [assignedDrivers] = await db.query(`
            SELECT d.*, s.scheduleDate, s.departureTime
            FROM schedules s
            JOIN drivers d ON d.driverId = s.driverId
            WHERE s.routeId = ? AND s.scheduleDate >= CURDATE()
        `, [routeId]);
        
        res.json({ 
            success: true, 
            drivers,
            assignedDrivers
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Assign vehicle to route with capacity check
exports.assignVehicleToRoute = async (req, res) => {
    const { routeId } = req.params;
    const { vehicleId, driverId, scheduleDate, departureTime, arrivalTime } = req.body;
    
    if (!vehicleId || !driverId || !scheduleDate) {
        return res.status(400).json({ 
            success: false, 
            message: 'Vehicle ID, Driver ID, and Schedule Date required' 
        });
    }
    
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Check if vehicle exists and is available
        const [vehicle] = await connection.query(
            'SELECT * FROM vehicles WHERE vehicleId = ? AND status = "active"',
            [vehicleId]
        );
        
        if (vehicle.length === 0) {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'Vehicle not available. Vehicle must be in "active" status.' 
            });
        }
        
        // Check if driver exists and has valid license
        const [driver] = await connection.query(
            `SELECT * FROM drivers 
             WHERE driverId = ? AND status = 'available' AND licenseExpiry > CURDATE()`,
            [driverId]
        );
        
        if (driver.length === 0) {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'Driver not available or license expired' 
            });
        }
        
        // Check if route exists
        const [route] = await connection.query(
            'SELECT * FROM routes WHERE routeId = ? AND status = "active"',
            [routeId]
        );
        
        if (route.length === 0) {
            await connection.rollback();
            return res.status(404).json({ 
                success: false, 
                message: 'Route not found or inactive' 
            });
        }
        
        // Check if vehicle is already assigned to another route on same day
        const [existingVehicleSchedule] = await connection.query(
            `SELECT * FROM schedules 
             WHERE vehicleId = ? AND scheduleDate = ? AND status NOT IN ('completed', 'cancelled')`,
            [vehicleId, scheduleDate]
        );
        
        if (existingVehicleSchedule.length > 0) {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'Vehicle already assigned to another route on this date' 
            });
        }
        
        // Check if driver is already assigned on same day
        const [existingDriverSchedule] = await connection.query(
            `SELECT * FROM schedules 
             WHERE driverId = ? AND scheduleDate = ? AND status NOT IN ('completed', 'cancelled')`,
            [driverId, scheduleDate]
        );
        
        if (existingDriverSchedule.length > 0) {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'Driver already assigned to another route on this date' 
            });
        }
        
        // Create assignment
        const [result] = await connection.query(
            `INSERT INTO schedules (routeId, vehicleId, driverId, departureTime, arrivalTime, scheduleDate, scheduleType, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [routeId, vehicleId, driverId, departureTime || '08:00:00', arrivalTime || '17:00:00', 
             scheduleDate, 'daily', 'scheduled']
        );
        
        await connection.commit();
        
        res.json({ 
            success: true, 
            scheduleId: result.insertId, 
            message: `Successfully assigned ${vehicle[0].registrationNo} and driver ${driver[0].name} to route ${route[0].routeCode}` 
        });
        
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        connection.release();
    }
};
