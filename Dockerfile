FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY public ./public
# Persistent storage is attached by the platform at /data (Railway volume,
# `docker run -v fmq-data:/data`, …). No VOLUME instruction: Railway rejects it.
RUN mkdir -p /data
ENV NODE_ENV=production PORT=3000 DB_FILE=/data/fingermcqueen.db TRUST_PROXY=1
EXPOSE 3000
CMD ["node", "--no-warnings=ExperimentalWarning", "server/index.js"]
