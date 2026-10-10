# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=vera-npm-cache,target=/root/.npm npm ci --strict-ssl=true
COPY . .
RUN npm run build
RUN --mount=type=cache,id=vera-npm-cache,target=/root/.npm npm prune --omit=dev --strict-ssl=true

FROM node:24-bookworm-slim
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/data ./src/data
COPY --from=build /app/src/lib/brand.js ./src/lib/brand.js
COPY --from=build /app/src/i18n/content.js ./src/i18n/content.js
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
RUN mkdir -p /data
EXPOSE 3000
CMD ["npm", "start"]
