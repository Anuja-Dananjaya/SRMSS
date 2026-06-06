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

// Get all drivers - admin, supervisor, user, driver (view-only)
router.get('/', allowRoles('admin', 'supervisor', 'user', 'driver'), getAllDrivers);

// Get available drivers - admin, supervisor, user, driver
router.get('/available', allowRoles('admin', 'supervisor', 'user', 'driver'), getAvailableDrivers);

// Get single driver - admin, supervisor, user, driver
router.get('/:id', allowRoles('admin', 'supervisor', 'user', 'driver'), getDriverById);

// Create driver - admin only
router.post('/', allowRoles('admin'), createDriver);

// Update driver - admin only
router.put('/:id', allowRoles('admin'), updateDriver);

// Update driver status - admin and supervisor
router.put('/:id/status', allowRoles('admin', 'supervisor'), updateDriverStatus);

// Deactivate driver - admin only
router.delete('/:id', allowRoles('admin'), deactivateDriver);


module.exports = router;