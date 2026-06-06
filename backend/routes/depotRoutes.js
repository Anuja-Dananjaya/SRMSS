const express = require('express');
const router = express.Router();
const {
  getAllDepots,
  getDepotById,
  createDepot,
  updateDepot,
  deleteDepot
} = require('../controllers/depotController');
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');

// All routes require login
router.use(verifyToken);

// Get all depots (admin, supervisor)
router.get('/', allowRoles('admin', 'supervisor'), getAllDepots);

// Get single depot
router.get('/:id', allowRoles('admin', 'supervisor'), getDepotById);

// Create depot - admin only
router.post('/', allowRoles('admin'), createDepot);

// Update depot - admin only
router.put('/:id', allowRoles('admin'), updateDepot);

// Delete (soft) depot - admin only
router.delete('/:id', allowRoles('admin'), deleteDepot);

module.exports = router;
