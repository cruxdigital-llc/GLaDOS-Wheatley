FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source and config
COPY tsconfig.json ./
COPY vitest.config.ts ./
COPY src/ ./src/

# Build
FROM base AS build
RUN npm run build

# Production
FROM node:22-alpine AS production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

EXPOSE 3000
CMD ["node", "dist/server/index.js"]

# Development — used by docker-compose
FROM base AS development
EXPOSE 3000
CMD ["npm", "run", "test:watch"]
