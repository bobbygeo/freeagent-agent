FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3847 \
    BIND_HOST=0.0.0.0 \
    FREEAGENT_REDIRECT_URI=http://127.0.0.1:3847/oauth/callback \
    FREEAGENT_TOKEN_PATH=/app/data/.oauth-tokens.json
RUN mkdir -p /app/data
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3847
VOLUME ["/app/data"]
USER node
CMD ["node", "dist/server.js"]
