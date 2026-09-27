function requestMeta(req, res, next) {
  const serverTime = new Date().toISOString();
  res.setHeader('x-server-time', serverTime);
  res.locals.serverTime = serverTime;
  next();
}

module.exports = requestMeta;
