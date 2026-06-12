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
 *       properties:
 *         userId:
 *           type: integer
 *           description: Auto-incremented user ID
 *           example: 1
 *         name:
 *           type: string
 *           example: Anuja Dananjaya
 *         email:
 *           type: string
 *           format: email
 *           example: admin@srmss.com
 *         role:
 *           type: string
 *           enum: [admin, supervisor, operator]
 *           example: admin
 *         phone:
 *           type: string
 *           example: "+94771234567"
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: admin@srmss.com
 *         password:
 *           type: string
 *           format: password
 *           example: password123
 *
 *     LoginResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Login successful.
 *         token:
 *           type: string
 *           description: JWT access token — paste into the Authorize button above
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         user:
 *           $ref: '#/components/schemas/User'
 *
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *         - role
 *       properties:
 *         name:
 *           type: string
 *           example: Jane Perera
 *         email:
 *           type: string
 *           format: email
 *           example: jane@srmss.com
 *         password:
 *           type: string
 *           format: password
 *           example: strongpassword123
 *         role:
 *           type: string
 *           enum: [admin, supervisor, operator]
 *           example: supervisor
 *         phone:
 *           type: string
 *           example: "+94775678901"
 */

// ─── Public Routes ─────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login and receive a JWT token
 *     description: |
 *       Authenticates a user with email and password.
 *       On success, copy the returned **token** and paste it into the
 *       **Authorize** button (🔒) at the top of this page to unlock protected endpoints.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             admin:
 *               summary: Admin login
 *               value:
 *                 email: admin@srmss.com
 *                 password: password123
 *             supervisor:
 *               summary: Supervisor login
 *               value:
 *                 email: supervisor@srmss.com
 *                 password: password123
 *             operator:
 *               summary: Operator login
 *               value:
 *                 email: operator@srmss.com
 *                 password: password123
 *     responses:
 *       200:
 *         description: Login successful — use the returned token in the Authorize button
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Email and password are required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Email and password are required.
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid email or password.
 */
router.post('/login', login);

// ─── Protected Routes ──────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new system user (Admin only)
 *     description: |
 *       Creates a new user account. Only administrators can access this endpoint.
 *       The new user's password will be securely hashed before storage.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           examples:
 *             newSupervisor:
 *               summary: Register a supervisor
 *               value:
 *                 name: Jane Perera
 *                 email: jane@srmss.com
 *                 password: strongpassword123
 *                 role: supervisor
 *                 phone: "+94775678901"
 *             newOperator:
 *               summary: Register an operator
 *               value:
 *                 name: Tom Silva
 *                 email: tom@srmss.com
 *                 password: operatorpass456
 *                 role: operator
 *                 phone: "+94776543210"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully.
 *                 userId:
 *                   type: integer
 *                   example: 5
 *       400:
 *         description: Missing required fields or invalid role
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Name, email, password and role are required.
 *       401:
 *         description: Unauthorized — JWT token missing or expired
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Access denied. No token provided.
 *       403:
 *         description: Forbidden — Admin role required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Access denied. Insufficient permissions.
 *       409:
 *         description: Email already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Email already exists.
 */
router.post('/register', verifyToken, allowRoles('superadmin', 'admin'), register);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get the current logged-in user's profile
 *     description: Returns full profile details of the user authenticated by the provided JWT token.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized — JWT token missing or expired
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Access denied. No token provided.
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User not found.
 */
router.get('/me', verifyToken, getMe);

module.exports = router;
