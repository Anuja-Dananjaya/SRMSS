const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');

// All routes require login
router.use(verifyToken);

// View routes - all authenticated roles
router.get('/', allowRoles('admin', 'supervisor', 'user', 'driver'), vehicleController.getAllVehicles);
router.get('/available/for-assignment', allowRoles('admin', 'supervisor', 'user', 'driver'), vehicleController.getAvailableVehicles);
router.get('/:id', allowRoles('admin', 'supervisor', 'user', 'driver'), vehicleController.getVehicleById);
router.get('/:id/maintenance', allowRoles('admin', 'supervisor', 'user', 'driver'), vehicleController.getVehicleMaintenance);

// Admin only routes
router.post('/', allowRoles('admin'), vehicleController.createVehicle);
router.put('/:id', allowRoles('admin'), vehicleController.updateVehicle);
router.delete('/:id', allowRoles('admin'), vehicleController.deleteVehicle);

// Admin and supervisor
router.patch('/:id/status', allowRoles('admin', 'supervisor'), vehicleController.updateVehicleStatus);
router.post('/:id/maintenance', allowRoles('admin', 'supervisor'), vehicleController.addMaintenance);

module.exports = router;