# ---- build stage ----
#FROM node:20-bookworm-slim AS build
FROM node:18-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG SQL_SERVER_HOST
ENV SQL_SERVER_HOST=${SQL_SERVER_HOST}
# Optional: faster, smaller installs without dev’s cache
RUN corepack enable
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["npx","next","start","-p","3000"]
