FROM node:22-alpine AS base
RUN apk add --no-cache git
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source and config
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src/ ./src/

# Build
FROM base AS build
RUN npm run build

# Production
FROM node:22-alpine AS production
RUN apk add --no-cache git
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

EXPOSE 3000
CMD ["node", "dist/server/index.js"]

# Development — used by docker-compose
FROM base AS development
EXPOSE 3000
CMD ["npm", "run", "test:watch"]
