FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY public ./public
ENV NODE_ENV=production PORT=3000 DB_FILE=/data/fingermcqueen.db TRUST_PROXY=1
VOLUME /data
EXPOSE 3000
CMD ["npm", "start"]
