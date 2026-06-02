const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');

// All routes require login
router.use(verifyToken);

// Static routes must come before dynamic /:id routes
router.get('/active/list', allowRoles('admin', 'supervisor'), routeController.getActiveRoutes);
router.get('/available-drivers', allowRoles('admin', 'supervisor'), routeController.getAvailableDrivers);

// Basic CRUD
router.get('/', allowRoles('admin', 'supervisor'), routeController.getAllRoutes);
router.post('/', allowRoles('admin'), routeController.createRoute);
router.get('/:id', allowRoles('admin', 'supervisor'), routeController.getRouteById);
router.put('/:id', allowRoles('admin'), routeController.updateRoute);
router.delete('/:id', allowRoles('admin'), routeController.deleteRoute);
router.get('/:id/map-data', allowRoles('admin', 'supervisor'), routeController.getRouteMapData);

// Assignment routes
router.get('/:routeId/available-vehicles', allowRoles('admin', 'supervisor'), routeController.getAvailableVehiclesForRoute);
router.get('/:routeId/available-drivers', allowRoles('admin', 'supervisor'), routeController.getAvailableDriversForRoute);
router.post('/:routeId/assign', allowRoles('admin', 'supervisor'), routeController.assignVehicleToRoute);

module.exports = router;