# syntax=docker/dockerfile:1

# Imagem de produção da API Anjos Protetores. Detalhes em docs/deploy-backend.md.
#
# Base: Debian slim (glibc) em vez de Alpine (musl). O Prisma 7 roda o client em WASM, mas o
# `prisma migrate deploy` usa o schema-engine nativo, que tem como alvo mais testado o
# Debian com OpenSSL 3; o bcrypt também traz binário pronto para glibc. O adapter MariaDB é
# JavaScript puro e funciona em qualquer uma.
#
# Node: 24 (LTS ativo). Mantenha igual ao .nvmrc, que o CI usa.
ARG NODE_VERSION=24.22.1
# prisma.config.ts exige DATABASE_URL ao ser carregado, mas o `prisma generate` não conecta
# ao banco. Valor falso, só para o build; em produção a variável vem do ambiente.
ARG BUILD_DATABASE_URL="mysql://build:build@localhost:3306/build"

# ---- base: Node + OpenSSL (o Prisma detecta a versão do OpenSSL para escolher o engine) ----
FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- build: dependências completas, Prisma client, tsc e assets ----
FROM base AS build
ARG BUILD_DATABASE_URL
# Primeiro só os manifestos: a camada do npm ci fica em cache enquanto eles não mudarem.
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
RUN DATABASE_URL="$BUILD_DATABASE_URL" npx prisma generate
COPY src ./src
# tsc + cópia de src/assets (logo do termo em PDF) para dist/assets
RUN npm run build

# ---- prod-deps: só dependências de produção ----
# Não instala o vitest e afins: o package-lock (gerado no Windows) não tem os binários de
# Linux do rolldown, e a imagem não precisa deles. O CLI `prisma` está em "dependencies",
# então o `migrate deploy` funciona na imagem final.
FROM base AS prod-deps
ARG BUILD_DATABASE_URL
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN DATABASE_URL="$BUILD_DATABASE_URL" npx prisma generate

# ---- final ----
FROM base AS final
ENV NODE_ENV=production \
    PORT=4000
# Arquivos de root e só leitura para o usuário da aplicação.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Usuário sem privilégios que já vem na imagem oficial do Node.
USER node
EXPOSE 4000

# Liveness: não depende do banco (a readiness é GET /health/ready).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

# Node como processo principal (sem npm nem tsx) para receber o SIGTERM do docker stop e
# encerrar de forma limpa (src/utils/encerramento.ts).
CMD ["node", "dist/server.js"]
