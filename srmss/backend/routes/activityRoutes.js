const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../controllers/activityController');
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');

// All routes require login
router.use(verifyToken);

/**
 * @openapi
 * components:
 *   schemas:
 *     ActivityLog:
 *       type: object
 *       properties:
 *         logId:
 *           type: integer
 *         userId:
 *           type: integer
 *         action:
 *           type: string
 *           description: Mutation action (e.g. CREATE, UPDATE, DELETE)
 *         module:
 *           type: string
 *           description: System module affected (e.g. Schedules, Fuel, Maintenance)
 *         description:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /api/activities:
 *   get:
 *     summary: Retrieve system activity logs
 *     tags: [Activity Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of activity logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 activities:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ActivityLog'
 */
router.get('/', allowRoles('superadmin', 'admin', 'supervisor'), getActivityLogs);

module.exports = router;
