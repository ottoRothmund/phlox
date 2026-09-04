# Multi-stage build for any container host (Fly, Railway, Render, a VPS).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S phlox && adduser -S phlox -G phlox
COPY --from=build --chown=phlox:phlox /app/.next/standalone ./
COPY --from=build --chown=phlox:phlox /app/.next/static ./.next/static
COPY --from=build --chown=phlox:phlox /app/public ./public
USER phlox
EXPOSE 3000
CMD ["node", "server.js"]
