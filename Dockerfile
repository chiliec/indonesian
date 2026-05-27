# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
# better-sqlite3 (dev-only, used by the Anki prep scripts) has no musl prebuilt,
# so npm ci compiles it from source — needs python3 + a C++ toolchain.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* tsconfig.json ./
RUN npm ci
COPY src ./src
COPY scenarios ./scenarios
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scenarios ./scenarios
# Quiz YAML + generated audio; the bot refuses to start without content/quiz.
COPY content ./content
USER node
CMD ["node", "dist/index.js"]
