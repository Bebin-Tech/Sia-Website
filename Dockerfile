FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
COPY scripts/build.mjs ./scripts/build.mjs
COPY public/index.html public/admin.html ./public/
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY package*.json ./
COPY public ./public
COPY --from=build /app/public/build ./public/build
COPY --from=build /app/public/index.html /app/public/admin.html ./public/
COPY server.mjs seed.mjs catalogue-update.mjs ./
COPY scripts/setup-admin.mjs ./scripts/setup-admin.mjs
RUN mkdir -p data public/uploads && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node","--env-file-if-exists=.env","server.mjs"]
