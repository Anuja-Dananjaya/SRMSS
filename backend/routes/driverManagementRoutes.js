const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');
const controller = require('../controllers/driverManagementController');

// All routes limited to driver role
router.use(verifyToken, allowRoles('driver'));

router.get('/routes', controller.listRoutes);               // list today's routes
router.get('/search', controller.searchRoutes);            // query params driverName, startPoint
router.post('/route/:scheduleId/start', controller.startRoute);
router.post('/route/:scheduleId/end', controller.endRoute);

router.post('/schedule', controller.createSchedule); // admin only
router.put('/schedule/:scheduleId', controller.updateSchedule); // admin only
router.delete('/schedule/:scheduleId', controller.deleteSchedule); // admin only
module.exports = router;
