# syntax=docker/dockerfile:1

# ---------- deps: instala todas las dependencias (incluye dev para build y tsx) ----------
FROM node:22-slim AS deps
WORKDIR /app
# Prisma necesita openssl para su motor de consultas.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---------- build: genera el cliente Prisma y compila Next.js ----------
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Placeholder para el build; en runtime Coolify inyecta el real.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npm run build

# ---------- runner: imagen final. Corre el web y también los jobs cron (tsx). ----------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=America/Monterrey
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# node_modules completo (incluye tsx y el cliente Prisma generado) para que
# los jobs programados de Coolify puedan correr `npm run ingest|digest|reminders`.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY package.json package-lock.json next.config.ts tsconfig.json ./
COPY public ./public
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts

EXPOSE 3000
# Aplica migraciones pendientes y arranca el servidor web.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start -- -H 0.0.0.0 -p 3000"]
