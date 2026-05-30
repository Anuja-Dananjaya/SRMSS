const jwt = require('jsonwebtoken');
require ('dotenv').config();

const verifyToken = (req, res, next) => {
  // ===== TEMPORARY FOR TESTING =====
  // This will let test without logging in
  // Remove this once the testing is done
  
  // Add a dummy user for testing
  req.user = { 
    userId: 1, 
    role: 'admin',
    name: 'Test User'
  };
  return next();  
  
  /* ORIGINAL AUTH CODE - COMMENTED OUT FOR TESTING
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access Denied. No token Provided'});
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or Expired token'});
  }
  */
};

module.exports = verifyToken;