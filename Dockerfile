FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests
COPY backend/package*.json ./backend/

# Install backend production dependencies
RUN cd backend && npm ci --omit=dev

# Copy backend source code
COPY backend ./backend

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "backend/src/index.js"]
