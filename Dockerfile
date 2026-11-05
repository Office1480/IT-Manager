# Image unique : build + exécution (Railway, Render, Fly, serveur Docker…)
FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production PORT=3000 STORAGE_DIR=/data/storage
EXPOSE 3000
CMD ["sh", "scripts/start.sh"]
