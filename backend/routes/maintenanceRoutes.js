const express = require('express');
const router = express.Router();
const {
  getAllMaintenance,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance
} = require('../controllers/maintenanceController');
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');

// Require authentication
router.use(verifyToken);

/**
 * @openapi
 * components:
 *   schemas:
 *     Maintenance:
 *       type: object
 *       required:
 *         - vehicleId
 *         - maintenanceType
 *         - serviceDate
 *       properties:
 *         maintenanceId:
 *           type: integer
 *           description: Auto-incremented ID of the maintenance record
 *         vehicleId:
 *           type: integer
 *         maintenanceType:
 *           type: string
 *           enum: [routine, repair, emergency]
 *         description:
 *           type: string
 *         cost:
 *           type: number
 *           format: float
 *         serviceDate:
 *           type: string
 *           format: date
 *           example: "2026-06-15"
 *         nextServiceDue:
 *           type: string
 *           format: date
 *           example: "2026-09-15"
 *         status:
 *           type: string
 *           enum: [pending, completed]
 *           default: pending
 */

/**
 * @openapi
 * /api/maintenance:
 *   get:
 *     summary: Retrieve all maintenance logs
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of maintenance records retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 maintenance:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Maintenance'
 */
router.get('/', allowRoles('admin', 'supervisor', 'user', 'driver'), getAllMaintenance);

/**
 * @openapi
 * /api/maintenance:
 *   post:
 *     summary: Create a new vehicle maintenance log
 *     tags: [Maintenance]
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
 *               - maintenanceType
 *               - serviceDate
 *             properties:
 *               vehicleId:
 *                 type: integer
 *               maintenanceType:
 *                 type: string
 *                 enum: [routine, repair, emergency]
 *               description:
 *                 type: string
 *               cost:
 *                 type: number
 *               serviceDate:
 *                 type: string
 *                 example: "2026-06-15"
 *               nextServiceDue:
 *                 type: string
 *                 example: "2026-09-15"
 *               status:
 *                 type: string
 *                 enum: [pending, completed]
 *     responses:
 *       201:
 *         description: Maintenance log created successfully. Auto-sets vehicle to 'maintenance' status if pending and type is repair or emergency.
 *       400:
 *         description: Missing required fields
 */
router.post('/', allowRoles('admin', 'supervisor'), createMaintenance);

/**
 * @openapi
 * /api/maintenance/{id}:
 *   put:
 *     summary: Update an existing maintenance record status/details
 *     tags: [Maintenance]
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
 *               status:
 *                 type: string
 *                 enum: [pending, completed]
 *               cost:
 *                 type: number
 *               description:
 *                 type: string
 *               nextServiceDue:
 *                 type: string
 *     responses:
 *       200:
 *         description: Maintenance record updated. Automatically reverts vehicle status to 'active' if completed.
 *       404:
 *         description: Maintenance record not found
 */
router.put('/:id', allowRoles('admin', 'supervisor'), updateMaintenance);

/**
 * @openapi
 * /api/maintenance/{id}:
 *   delete:
 *     summary: Delete a maintenance record
 *     tags: [Maintenance]
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
 *         description: Maintenance record deleted successfully
 *       404:
 *         description: Maintenance record not found
 */
router.delete('/:id', allowRoles('admin', 'supervisor'), deleteMaintenance);

module.exports = router;