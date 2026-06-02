const express = require('express');
const router = express.Router();
const {
  getAllFuelLogs,
  addFuelLog,
  deleteFuelLog
} = require('../controllers/fuelController');
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');

// Require authentication
router.use(verifyToken);

/**
 * @openapi
 * components:
 *   schemas:
 *     FuelLog:
 *       type: object
 *       required:
 *         - vehicleId
 *         - fuelAmount
 *         - cost
 *         - date
 *       properties:
 *         fuelLogId:
 *           type: integer
 *           description: Auto-incremented ID of the fuel log
 *         vehicleId:
 *           type: integer
 *         scheduleId:
 *           type: integer
 *           description: ID of schedule linked to the refuel (optional)
 *         fuelAmount:
 *           type: number
 *           format: float
 *           description: Fuel added in liters
 *         cost:
 *           type: number
 *           format: float
 *           description: Total cost in Rs.
 *         date:
 *           type: string
 *           format: date
 *           example: "2026-06-15"
 *         odometerReading:
 *           type: number
 *           format: float
 *           description: Odometer reading at refueling time (optional)
 */

/**
 * @openapi
 * /api/fuel:
 *   get:
 *     summary: Retrieve all fuel logs
 *     tags: [Fuel Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of fuel logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 fuelLogs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FuelLog'
 */
router.get('/', allowRoles('admin', 'supervisor', 'operator'), getAllFuelLogs);

/**
 * @openapi
 * /api/fuel:
 *   post:
 *     summary: Add a new fuel log
 *     tags: [Fuel Logs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vehicleId
 *               - fuelAmount
 *               - cost
 *               - date
 *             properties:
 *               vehicleId:
 *                 type: integer
 *               scheduleId:
 *                 type: integer
 *               fuelAmount:
 *                 type: number
 *                 example: 50.5
 *               cost:
 *                 type: number
 *                 example: 18500.00
 *               date:
 *                 type: string
 *                 example: "2026-06-15"
 *               odometerReading:
 *                 type: number
 *                 example: 105400
 *     responses:
 *       201:
 *         description: Fuel log recorded successfully
 *       400:
 *         description: Missing required fields
 */
router.post('/', allowRoles('admin', 'supervisor', 'operator'), addFuelLog);

/**
 * @openapi
 * /api/fuel/{id}:
 *   delete:
 *     summary: Delete a fuel log entry
 *     tags: [Fuel Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Fuel log deleted successfully
 *       404:
 *         description: Fuel log not found
 */
router.delete('/:id', allowRoles('admin', 'supervisor'), deleteFuelLog);

module.exports = router;