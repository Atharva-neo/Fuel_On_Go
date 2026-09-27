const AppError = require('../utils/AppError');

function validateRequest(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return next(new AppError('Request validation failed.', 400, result.error.issues));
    }

    req.validated = result.data;
    return next();
  };
}

module.exports = validateRequest;
