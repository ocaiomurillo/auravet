# Build stage
FROM node:20-bullseye-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends libssl1.1 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm install

COPY . .
ENV DATABASE_URL=postgresql://auravet:auravet@db:5432/auravet?schema=public
RUN npm run prisma:generate --workspace apps/api
RUN npm run build --workspace apps/api

# Production stage
FROM node:20-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends libssl1.1 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./package.json

EXPOSE 4000
CMD ["node", "dist/main.js"]
