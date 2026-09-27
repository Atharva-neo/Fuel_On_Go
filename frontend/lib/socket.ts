'use client';

type SocketLike = {
  connected: false;
  on: () => void;
  emit: () => void;
  disconnect: () => void;
  removeAllListeners: () => void;
};

const noop = () => undefined;

const lightweightSocket: SocketLike = {
  connected: false,
  on: noop,
  emit: noop,
  disconnect: noop,
  removeAllListeners: noop,
};

export function getSocket() {
  return lightweightSocket;
}

export function closeSocket() {
  lightweightSocket.removeAllListeners();
  lightweightSocket.disconnect();
}
