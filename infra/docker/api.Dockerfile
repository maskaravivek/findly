FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/model-sdk/package.json packages/model-sdk/package.json
COPY packages/retailer-sdk/package.json packages/retailer-sdk/package.json
COPY packages/test-fixtures/package.json packages/test-fixtures/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "--filter", "@findly/api", "start"]
