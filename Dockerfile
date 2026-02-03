# 1) build stage
FROM node:20.18.1-bookworm-slim AS build
WORKDIR /app

# 의존성 설치 (package 파일만 변경 시 캐시 무효화)
COPY package.json package-lock.json ./
RUN npm ci

# 소스 빌드
COPY . .
RUN npm run build

# devDependencies 제거 → runtime 복사 용량 축소
RUN npm prune --production


# 2) runtime stage (slim node + chromium 전용)
FROM node:20.18.1-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# production node_modules 복사 (better-sqlite3 prebuilt 포함)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Chromium 시스템 의존성만 설치 (브라우저 바이너리는 기동 시 lazy install)
RUN ./node_modules/.bin/playwright install-deps chromium \
 && rm -rf /var/lib/apt/lists/*

# 빌드 산출물 + 런타임 파일
COPY --from=build /app/dist ./dist
COPY --from=build /app/prompts ./prompts
COPY --from=build /app/assets ./assets

CMD ["node", "dist/index.js"]
