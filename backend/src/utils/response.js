function sendSuccess(res, data, options = {}) {
  const {
    statusCode = 200,
    message = 'OK',
    meta = {},
  } = options;

  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: {
      serverTime: res.locals.serverTime || new Date().toISOString(),
      ...meta,
    },
  });
}

module.exports = { sendSuccess };
