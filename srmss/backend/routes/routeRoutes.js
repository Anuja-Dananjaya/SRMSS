const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');

// All routes require login
router.use(verifyToken);

// Static routes must come before dynamic /:id routes
router.get('/active/list', allowRoles('superadmin', 'admin', 'supervisor'), routeController.getActiveRoutes);
router.get('/available-drivers', allowRoles('superadmin', 'admin', 'supervisor'), routeController.getAvailableDrivers);

// Basic CRUD
router.get('/', allowRoles('superadmin', 'admin', 'supervisor'), routeController.getAllRoutes);
router.post('/', allowRoles('superadmin', 'admin'), routeController.createRoute);
router.get('/:id', allowRoles('superadmin', 'admin', 'supervisor'), routeController.getRouteById);
router.put('/:id', allowRoles('superadmin', 'admin'), routeController.updateRoute);
router.delete('/:id', allowRoles('superadmin', 'admin'), routeController.deleteRoute);
router.get('/:id/map-data', allowRoles('superadmin', 'admin', 'supervisor'), routeController.getRouteMapData);

// Assignment routes
router.get('/:routeId/available-vehicles', allowRoles('superadmin', 'admin', 'supervisor'), routeController.getAvailableVehiclesForRoute);
router.get('/:routeId/available-drivers', allowRoles('superadmin', 'admin', 'supervisor'), routeController.getAvailableDriversForRoute);
router.post('/:routeId/assign', allowRoles('superadmin', 'admin', 'supervisor'), routeController.assignVehicleToRoute);

module.exports = router;
