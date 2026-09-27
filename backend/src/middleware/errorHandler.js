const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

function formatValidationError(error) {
  if (error.name !== 'ZodError') return null;
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

function errorHandler(error, req, res, _next) {
  let err = error;

  if (err.name === 'CastError') {
    err = new AppError('Invalid identifier provided.', 400);
  }

  if (err instanceof mongoose.Error.ValidationError) {
    err = new AppError('Validation failed.', 400, Object.values(err.errors).map((e) => e.message));
  }

  if (err.code === 11000) {
    const duplicateKeys = Object.keys(err.keyPattern || {});
    err = new AppError(`Duplicate value for: ${duplicateKeys.join(', ')}`, 409);
  }

  const zodErrors = formatValidationError(err);
  if (zodErrors) {
    err = new AppError('Request validation failed.', 400, zodErrors);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error('[Server Error]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    details: err.details || null,
    meta: {
      serverTime: res.locals.serverTime || new Date().toISOString(),
    },
  });
}

module.exports = errorHandler;
