const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const auth = require('../middleware/auth');

router.get('/', auth, vehicleController.getAllVehicles);
router.get('/:id', auth, vehicleController.getVehicleById);
router.post('/', auth, vehicleController.createVehicle);
router.put('/:id', auth, vehicleController.updateVehicle);
router.delete('/:id', auth, vehicleController.deleteVehicle);
router.patch('/:id/status', auth, vehicleController.updateVehicleStatus);
router.get('/available/for-assignment', auth, vehicleController.getAvailableVehicles);
router.get('/:id/maintenance', auth, vehicleController.getVehicleMaintenance);
router.post('/:id/maintenance', auth, vehicleController.addMaintenance);

module.exports = router;