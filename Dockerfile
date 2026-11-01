# syntax=docker/dockerfile:1

# ---------- Сборка: проверка типов + astro build (изображения и шрифты оптимизируются здесь) ----------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- Только production-зависимости для сервера ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# sharp и прочие нативные модули в рантайме не нужны: страница пререндерится при сборке
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---------- Рантайм ----------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:4321/ || exit 1
CMD ["node", "dist/server/entry.mjs"]
