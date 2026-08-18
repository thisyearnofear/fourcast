FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY telegraph.yaml ./

ENV NODE_ENV=production
ENV PORT=8402

EXPOSE 8402

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:8402/health || exit 1

CMD ["node", "src/server.js"]
