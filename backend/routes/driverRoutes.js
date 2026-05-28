const express = require('express');
const router = express.Router();
const {
  getAllDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  updateDriverStatus,
  deactivateDriver,
  getAvailableDrivers
} = require('../controllers/driverController');
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');

// All routes require login
router.use(verifyToken);

// Get all drivers - admin and supervisor
router.get('/', allowRoles('admin', 'supervisor'), getAllDrivers);

// Get available drivers - admin and supervisor
router.get('/available', allowRoles('admin', 'supervisor'), getAvailableDrivers);

// Get single driver - admin and supervisor
router.get('/:id', allowRoles('admin', 'supervisor'), getDriverById);

// Create driver - admin only
router.post('/', allowRoles('admin'), createDriver);

// Update driver - admin only
router.put('/:id', allowRoles('admin'), updateDriver);

// Update driver status - admin and supervisor
router.put('/:id/status', allowRoles('admin', 'supervisor'), updateDriverStatus);

// Deactivate driver - admin only
router.delete('/:id', allowRoles('admin'), deactivateDriver);


module.exports = router;