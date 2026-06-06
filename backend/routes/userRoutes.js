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

// Admin and supervisor can list/view users
router.get('/', allowRoles('admin', 'supervisor'), getAllUsers);
router.get('/:id', allowRoles('admin', 'supervisor'), getUserById);

// Admin only can modify/delete users
router.put('/:id', allowRoles('admin'), updateUser);
router.delete('/:id', allowRoles('admin'), deleteUser);

module.exports = router;