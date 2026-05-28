const express = require ('express');
const router =  express.Router();
const { register , login , getMe } = require ('../controllers/authController');
const verifyToken = require ('../middleware/auth');
const allowRoles = require('../middleware/roleCheck');

// Public routes 
router.post('/login', login);

//Protected routes 
router.post('/register', verifyToken, allowRoles('admin'), register);
router.get ('/me', verifyToken, getMe);

module.exports = router;

