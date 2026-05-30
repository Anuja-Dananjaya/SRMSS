const db = require('../config/db');

// Get all the vehicles
exports.getAllVehicles = async (req, res) => {
    try {
        const [vehicles] = await db.query(`
            SELECT 
                v.*,
                COUNT(DISTINCT m.maintenanceId) as total_maintenance,
                MAX(m.serviceDate) as last_maintenance_date
            FROM vehicles v
            LEFT JOIN maintenance m ON m.vehicleId = v.vehicleId
            GROUP BY v.vehicleId
            ORDER BY v.vehicleId DESC
        `);
        res.json({ success: true, vehicles });
    } catch (error) {
        console.error('Error fetching vehicles:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get single vehicle by ID
exports.getVehicleById = async (req, res) => {
    try {
        const [vehicles] = await db.query(
            'SELECT * FROM vehicles WHERE vehicleId = ?',
            [req.params.id]
        );
        
        if (vehicles.length === 0) {
            return res.status(404).json({ success: false, message: 'Vehicle not found' });
        }
        
        // Get maintenance history
        const [maintenance] = await db.query(
            'SELECT * FROM maintenance WHERE vehicleId = ? ORDER BY serviceDate DESC LIMIT 5',
            [req.params.id]
        );
        
        vehicles[0].maintenance_history = maintenance;
        res.json({ success: true, vehicle: vehicles[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Create new vehicle
exports.createVehicle = async (req, res) => {
    const {
        registrationNo,
        model,
        capacity,
        status,
        mileage,
        fuelEfficiency
    } = req.body;

    if (!registrationNo || !model || !capacity) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields: registrationNo, model, capacity' 
        });
    }

    try {
        // Check if the registration number already exists
        const [existing] = await db.query(
            'SELECT vehicleId FROM vehicles WHERE registrationNo = ?',
            [registrationNo]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Registration number already exists' 
            });
        }

        const [result] = await db.query(
            `INSERT INTO vehicles (registrationNo, model, capacity, status, mileage, fuelEfficiency)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [registrationNo, model, capacity, status || 'active', mileage || 0, fuelEfficiency || null]
        );

        const [newVehicle] = await db.query(
            'SELECT * FROM vehicles WHERE vehicleId = ?',
            [result.insertId]
        );
        
        res.json({ success: true, vehicle: newVehicle[0], message: 'Vehicle added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Update the vehicle
exports.updateVehicle = async (req, res) => {
    const {
        registrationNo,
        model,
        capacity,
        status,
        mileage,
        fuelEfficiency
    } = req.body;

    try {
        const [existing] = await db.query(
            'SELECT vehicleId FROM vehicles WHERE vehicleId = ?',
            [req.params.id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Vehicle not found' });
        }

        await db.query(
            `UPDATE vehicles SET 
                registrationNo = ?, model = ?, capacity = ?, 
                status = ?, mileage = ?, fuelEfficiency = ?
             WHERE vehicleId = ?`,
            [registrationNo, model, capacity, status, mileage, fuelEfficiency, req.params.id]
        );

        const [updated] = await db.query(
            'SELECT * FROM vehicles WHERE vehicleId = ?',
            [req.params.id]
        );
        
        res.json({ success: true, vehicle: updated[0], message: 'Vehicle updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Delete vehicle (delete - set status to inactive)
exports.deleteVehicle = async (req, res) => {
    try {
        // Check if vehicle has upcoming schedules
        const [schedules] = await db.query(
            `SELECT scheduleId FROM schedules 
             WHERE vehicleId = ? AND scheduleDate >= CURDATE()`,
            [req.params.id]
        );
        
        if (schedules.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot delete vehicle with upcoming schedules. Mark as inactive instead.' 
            });
        }

        await db.query(
            'UPDATE vehicles SET status = "inactive" WHERE vehicleId = ?',
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Vehicle marked as inactive' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Update vehicle status
exports.updateVehicleStatus = async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['active', 'maintenance', 'inactive'];
    
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    try {
        await db.query(
            'UPDATE vehicles SET status = ? WHERE vehicleId = ?',
            [status, req.params.id]
        );
        
        res.json({ success: true, message: 'Vehicle status updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get available vehicles for assignment
exports.getAvailableVehicles = async (req, res) => {
    try {
        const [vehicles] = await db.query(`
            SELECT vehicleId, registrationNo, model, capacity, mileage, status
            FROM vehicles 
            WHERE status = 'active'
            ORDER BY registrationNo
        `);
        res.json({ success: true, vehicles });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get vehicle maintenance history
exports.getVehicleMaintenance = async (req, res) => {
    try {
        const [maintenance] = await db.query(
            `SELECT * FROM maintenance 
             WHERE vehicleId = ? 
             ORDER BY serviceDate DESC`,
            [req.params.id]
        );
        res.json({ success: true, maintenance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Add maintenance record
exports.addMaintenance = async (req, res) => {
    const {
        maintenanceType,
        description,
        cost,
        serviceDate,
        nextServiceDue,
        status
    } = req.body;

    if (!maintenanceType || !serviceDate) {
        return res.status(400).json({ 
            success: false, 
            message: 'Maintenance type and service date required' 
        });
    }

    try {
        const [result] = await db.query(
            `INSERT INTO maintenance (vehicleId, maintenanceType, description, cost, serviceDate, nextServiceDue, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.params.id, maintenanceType, description || null, cost || null, 
             serviceDate, nextServiceDue || null, status || 'pending']
        );
        
        // Update vehicle status to maintenance if repair or emergency
        if (maintenanceType === 'repair' || maintenanceType === 'emergency') {
            await db.query(
                'UPDATE vehicles SET status = "maintenance" WHERE vehicleId = ?',
                [req.params.id]
            );
        }
        
        res.json({ success: true, maintenanceId: result.insertId, message: 'Maintenance record added' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};