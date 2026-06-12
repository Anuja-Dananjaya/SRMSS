const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');
const {
  getAllDepots,
  createDepot,
  updateDepot,
  deactivateDepot
} = require('../controllers/depotController');

router.use(verifyToken);

router.get('/', allowRoles('superadmin', 'admin', 'supervisor', 'operator'), getAllDepots);
router.post('/', allowRoles('superadmin'), createDepot);
router.put('/:id', allowRoles('superadmin'), updateDepot);
router.delete('/:id', allowRoles('superadmin'), deactivateDepot);

module.exports = router;
