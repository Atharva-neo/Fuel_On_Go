const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const AppError = require('../utils/AppError');

async function authMiddleware(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authorization token is required.', 401));
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).lean();

    if (!user) {
      return next(new AppError('Invalid token user.', 401));
    }

    req.user = {
      id: String(user._id),
      role: user.role,
      pumpId: user.pumpId ? String(user.pumpId) : null,
      name: user.name,
      phone: user.phone,
    };
    return next();
  } catch (_error) {
    return next(new AppError('Invalid or expired token.', 401));
  }
}

function adminOnly(req, _res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return next(new AppError('Admin access required.', 403));
}

module.exports = {
  authMiddleware,
  adminOnly,
};
