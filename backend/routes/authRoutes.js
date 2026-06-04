const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');

/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - role
 *       properties:
 *         userId:
 *           type: integer
 *           description: Auto-incremented user ID
 *         name:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         role:
 *           type: string
 *           enum: [admin, supervisor, operator]
 *         phone:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Log into the system and get a JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@srmss.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                   description: JWT access token
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing credentials
 *       401:
 *         description: Invalid email or password
 */
router.post('/login', login);

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user (Admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@srmss.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: strongpassword123
 *               role:
 *                 type: string
 *                 enum: [admin, supervisor, operator]
 *                 example: supervisor
 *               phone:
 *                 type: string
 *                 example: "+94771234567"
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Missing fields or invalid values
 *       409:
 *         description: Email already in use
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin role required)
 */
router.post('/register', verifyToken, allowRoles('admin'), register);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get details of the currently logged in user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized / invalid token
 */
router.get('/me', verifyToken, getMe);

module.exports = router;
