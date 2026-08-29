FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json eslint.config.mjs ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/queue/package.json packages/queue/package.json
COPY packages/cache/package.json packages/cache/package.json
COPY database/package.json database/package.json
RUN pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages
COPY database ./database
COPY doc/requirement/products-seed.json ./doc/requirement/products-seed.json
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app /app
USER node
CMD ["node", "apps/api/dist/main.js"]
