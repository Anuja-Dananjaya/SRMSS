const allowRoles = (...roles) =>{
  return (req, res, next) =>{
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized. Please log in.' });
    }

    if (!roles.includes(req.user.role)){
      return res.status(403).json({
        message:'Forbidden. You do not have permission to access this.'
      });
    }

    next();
  };
};

module.exports = allowRoles;