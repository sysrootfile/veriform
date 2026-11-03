# Veriform panel — multi-stage build
# WITH_SCANNER=1 → playwright + chromium dahil (self-servis /tarama çalışır)
FROM node:22-alpine AS build
WORKDIR /app
RUN npm i -g pnpm@12
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --allow-build=esbuild
COPY . .
RUN pnpm build:panel && pnpm build:embed

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ARG WITH_SCANNER=0
RUN npm i -g pnpm@12
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN if [ "$WITH_SCANNER" = "1" ]; then pnpm install --frozen-lockfile --allow-build=esbuild && apk add --no-cache chromium && echo "chromium kuruldu"; else pnpm install --frozen-lockfile --prod --allow-build=esbuild; fi
COPY --from=build /app/dist ./dist
EXPOSE 4620
CMD ["node", "dist/panel.mjs"]
