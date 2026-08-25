# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Production-only node_modules for the runner stage, installed directly
# instead of `npm ci` + `npm prune --omit=dev` after the build.
FROM node:24-bookworm-slim AS prod-deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

FROM deps AS build

WORKDIR /app

COPY tsconfig*.json nest-cli.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

# Prisma config requires DATABASE_URL while generating the client.
# Override this at build time if needed:
# docker build --build-arg DATABASE_URL="mysql://user:pass@host:3306/db" -t certificate-backend .
ARG DATABASE_URL="mysql://root:password@localhost:3306/certificate_app"
ENV DATABASE_URL=${DATABASE_URL}

RUN npx prisma generate
RUN npm run build

FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/package*.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
