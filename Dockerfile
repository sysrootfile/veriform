# Veriform panel — multi-stage build
FROM node:22-alpine AS build
WORKDIR /app
RUN npm i -g pnpm@12
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --allow-build=esbuild
COPY . .
RUN pnpm build:panel

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN npm i -g pnpm@12
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod --allow-build=esbuild
COPY --from=build /app/dist ./dist
EXPOSE 4620
CMD ["node", "dist/panel.mjs"]
