# Vibra MX — eventos de Monterrey

Agregador de eventos de Monterrey (música, deportes, cultura): cartelera web
pública + digest semanal y recordatorios por WhatsApp. Monolito Next.js 16 +
Postgres (Prisma 6). En español.

- **Producción:** https://vibramx.fun (desplegado vía Coolify en un VPS Hostinger)
- **Push a `main` = deploy a producción.** Ver `AGENTS.md`.

## Comandos

```bash
npm install                  # instalar dependencias
npm run dev                  # http://localhost:3000 (usar TZ=America/Monterrey)
npm test                     # tests puros, SIN BD
npm run test:borra-bd        # tests de BD (RESETEAN eventos_mty_test)
npm run test:todo            # los dos (antes de pushear)
npm run build                # build de producción
npm run ingest|digest|reminders  # jobs: ingesta de fuentes, digest, recordatorios
```

## Docs

- `AGENTS.md` — reglas de trabajo y trampas (previews, tests, deploy).
- `HANDOFF.md` — estado del proyecto y pendientes reales.
- `FUENTES.md` — cómo están implementadas las fuentes de eventos.
- `DEPLOY-COOLIFY.md` — plan de despliegue.