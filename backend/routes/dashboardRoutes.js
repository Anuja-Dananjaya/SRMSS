const express = require('express');
const router = express.Router();
const { getDashboardData } = require('../controllers/dashboardController');
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');

router.use(verifyToken);

router.get('/', allowRoles('admin', 'supervisor'), getDashboardData);

module.exports = router;