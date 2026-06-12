const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');

// All routes require login
router.use(verifyToken);

// View routes - admin and supervisor
router.get('/', allowRoles('superadmin', 'admin', 'supervisor'), vehicleController.getAllVehicles);
router.get('/available/for-assignment', allowRoles('superadmin', 'admin', 'supervisor'), vehicleController.getAvailableVehicles);
router.get('/:id', allowRoles('superadmin', 'admin', 'supervisor'), vehicleController.getVehicleById);
router.get('/:id/maintenance', allowRoles('superadmin', 'admin', 'supervisor'), vehicleController.getVehicleMaintenance);

// Admin only routes
router.post('/', allowRoles('superadmin', 'admin'), vehicleController.createVehicle);
router.put('/:id', allowRoles('superadmin', 'admin'), vehicleController.updateVehicle);
router.delete('/:id', allowRoles('superadmin', 'admin'), vehicleController.deleteVehicle);

// Admin and supervisor
router.patch('/:id/status', allowRoles('superadmin', 'admin', 'supervisor'), vehicleController.updateVehicleStatus);
router.post('/:id/maintenance', allowRoles('superadmin', 'admin', 'supervisor'), vehicleController.addMaintenance);

module.exports = router;
