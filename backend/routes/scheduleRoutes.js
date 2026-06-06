const express = require('express');
const router = express.Router();
const {
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  apiCheckConflicts
} = require('../controllers/scheduleController');
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');

// Require authentication for all schedule operations
router.use(verifyToken);

/**
 * @openapi
 * components:
 *   schemas:
 *     Schedule:
 *       type: object
 *       required:
 *         - routeId
 *         - vehicleId
 *         - driverId
 *         - departureTime
 *         - arrivalTime
 *         - scheduleDate
 *       properties:
 *         scheduleId:
 *           type: integer
 *           description: Auto-incremented ID of the schedule
 *         routeId:
 *           type: integer
 *           description: ID of the route
 *         vehicleId:
 *           type: integer
 *           description: ID of the vehicle
 *         driverId:
 *           type: integer
 *           description: ID of the driver
 *         departureTime:
 *           type: string
 *           format: time
 *           example: "08:00:00"
 *         arrivalTime:
 *           type: string
 *           format: time
 *           example: "17:00:00"
 *         scheduleDate:
 *           type: string
 *           format: date
 *           example: "2026-06-15"
 *         scheduleType:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         notes:
 *           type: string
 *         status:
 *           type: string
 *           enum: [scheduled, ongoing, completed, delayed, cancelled]
 *           default: scheduled
 *         actualDeparture:
 *           type: string
 *           format: date-time
 *         actualArrival:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /api/schedules:
 *   get:
 *     summary: Retrieve all schedules
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of schedules retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 schedules:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Schedule'
 */
router.get('/', allowRoles('admin', 'supervisor', 'user', 'driver'), getAllSchedules);

/**
 * @openapi
 * /api/schedules/check-conflicts:
 *   post:
 *     summary: Precheck scheduling conflicts for a driver, vehicle, and date/time range
 *     tags: [Schedules]
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
 *               - driverId
 *               - departureTime
 *               - arrivalTime
 *               - scheduleDate
 *             properties:
 *               vehicleId:
 *                 type: integer
 *               driverId:
 *                 type: integer
 *               departureTime:
 *                 type: string
 *                 example: "08:00"
 *               arrivalTime:
 *                 type: string
 *                 example: "12:00"
 *               scheduleDate:
 *                 type: string
 *                 example: "2026-06-15"
 *               scheduleType:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *               endDate:
 *                 type: string
 *                 example: "2026-07-15"
 *               excludeId:
 *                 type: integer
 *                 description: Exclude this schedule ID during check (e.g. for update validation)
 *     responses:
 *       200:
 *         description: Conflict check execution complete
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 hasConflicts:
 *                   type: boolean
 *                 conflicts:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.post('/check-conflicts', allowRoles('admin', 'supervisor'), apiCheckConflicts);

/**
 * @openapi
 * /api/schedules:
 *   post:
 *     summary: Create one or multiple schedules
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - routeId
 *               - vehicleId
 *               - driverId
 *               - departureTime
 *               - arrivalTime
 *               - scheduleDate
 *             properties:
 *               routeId:
 *                 type: integer
 *               vehicleId:
 *                 type: integer
 *               driverId:
 *                 type: integer
 *               departureTime:
 *                 type: string
 *                 example: "08:00"
 *               arrivalTime:
 *                 type: string
 *                 example: "12:00"
 *               scheduleDate:
 *                 type: string
 *                 example: "2026-06-15"
 *               scheduleType:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *               endDate:
 *                 type: string
 *                 example: "2026-07-15"
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Schedule(s) created successfully
 *       409:
 *         description: Conflict detected
 *       400:
 *         description: Invalid/Missing body parameters
 */
router.post('/', allowRoles('admin', 'supervisor'), createSchedule);

/**
 * @openapi
 * /api/schedules/{id}:
 *   put:
 *     summary: Update schedule details or update trip status/execution details
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               routeId:
 *                 type: integer
 *               vehicleId:
 *                 type: integer
 *               driverId:
 *                 type: integer
 *               departureTime:
 *                 type: string
 *               arrivalTime:
 *                 type: string
 *               scheduleDate:
 *                 type: string
 *               scheduleType:
 *                 type: string
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [scheduled, ongoing, completed, delayed, cancelled]
 *               actualDeparture:
 *                 type: string
 *               actualArrival:
 *                 type: string
 *     responses:
 *       200:
 *         description: Schedule updated successfully
 *       404:
 *         description: Schedule not found
 *       409:
 *         description: Conflict detected
 */
router.put('/:id', allowRoles('admin', 'supervisor'), updateSchedule);

/**
 * @openapi
 * /api/schedules/{id}:
 *   delete:
 *     summary: Delete a schedule
 *     tags: [Schedules]
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
 *         description: Schedule deleted successfully
 *       404:
 *         description: Schedule not found
 */
router.delete('/:id', allowRoles('admin', 'supervisor'), deleteSchedule);

module.exports = router;