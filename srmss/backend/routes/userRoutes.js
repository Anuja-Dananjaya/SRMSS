const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/userController');
const verifyToken = require('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');

// All routes require login
router.use(verifyToken);

// Own profile routes - all roles
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/profile/change-password', changePassword);

// Admin only routes
router.get('/', allowRoles('superadmin', 'admin'), getAllUsers);
router.get('/:id', allowRoles('superadmin', 'admin'), getUserById);
router.put('/:id', allowRoles('superadmin', 'admin'), updateUser);
router.delete('/:id', allowRoles('superadmin', 'admin'), deleteUser);

module.exports = router;
