const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const auth = require('../middleware/auth');

// Basic CRUD routes
router.get('/', auth, routeController.getAllRoutes);
router.get('/:id', auth, routeController.getRouteById);
router.post('/', auth, routeController.createRoute);
router.put('/:id', auth, routeController.updateRoute);
router.delete('/:id', auth, routeController.deleteRoute);

// Assignment of routes
router.get('/:routeId/available-vehicles', auth, routeController.getAvailableVehiclesForRoute);
router.get('/:routeId/available-drivers', auth, routeController.getAvailableDriversForRoute);
router.post('/:routeId/assign', auth, routeController.assignVehicleToRoute);

// Map and helper routes
router.get('/:id/map-data', auth, routeController.getRouteMapData);
router.get('/active/list', auth, routeController.getActiveRoutes);
router.get('/available-drivers', auth, routeController.getAvailableDrivers);

module.exports = router;