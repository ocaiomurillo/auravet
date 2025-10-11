# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm install

COPY . .
ENV DATABASE_URL=postgresql://auravet:auravet@db:5432/auravet?schema=public
RUN npm run prisma:generate --workspace apps/api
RUN npm run build --workspace apps/api

# Production stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./package.json

EXPOSE 4000
CMD ["node", "dist/main.js"]
