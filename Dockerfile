FROM mcr.microsoft.com/playwright:v1.41.0-jammy

WORKDIR /app

# 1️⃣ deps 먼저 복사 (캐시 레이어)
COPY package.json package-lock.json ./

RUN npm ci

# 2️⃣ 소스 복사
COPY . .

# 3️⃣ 타입스크립트 빌드
RUN npm run build

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
