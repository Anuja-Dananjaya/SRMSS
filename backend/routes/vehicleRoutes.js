const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');

// All routes require login
router.use(verifyToken);

// View routes - admin and supervisor
router.get('/', allowRoles('admin', 'supervisor'), vehicleController.getAllVehicles);
router.get('/available/for-assignment', allowRoles('admin', 'supervisor'), vehicleController.getAvailableVehicles);
router.get('/:id', allowRoles('admin', 'supervisor'), vehicleController.getVehicleById);
router.get('/:id/maintenance', allowRoles('admin', 'supervisor'), vehicleController.getVehicleMaintenance);

// Admin only routes
router.post('/', allowRoles('admin'), vehicleController.createVehicle);
router.put('/:id', allowRoles('admin'), vehicleController.updateVehicle);
router.delete('/:id', allowRoles('admin'), vehicleController.deleteVehicle);

// Admin and supervisor
router.patch('/:id/status', allowRoles('admin', 'supervisor'), vehicleController.updateVehicleStatus);
router.post('/:id/maintenance', allowRoles('admin', 'supervisor'), vehicleController.addMaintenance);

module.exports = router;