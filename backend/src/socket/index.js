const { getPumpRoom } = require('../services/socketEmitter');

function setupSocket(io) {
  io.on('connection', (socket) => {
    // eslint-disable-next-line no-console
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('join:pump', (pumpId) => {
      if (!pumpId) return;
      const room = getPumpRoom(pumpId);
      socket.join(room);
      socket.emit('pump:joined', { pumpId: String(pumpId), room });
    });

    socket.on('leave:pump', (pumpId) => {
      if (!pumpId) return;
      socket.leave(getPumpRoom(pumpId));
    });

    socket.on('ping:time', () => {
      socket.emit('pong:time', { serverTime: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
      // eslint-disable-next-line no-console
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}

module.exports = {
  setupSocket,
};
