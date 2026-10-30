FROM node:20-alpine AS runtime

WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY server ./

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY backend ./

WORKDIR /app/server
EXPOSE 5000

CMD ["node", "index.js"]
