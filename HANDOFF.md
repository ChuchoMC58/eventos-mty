# Eventos MTY — Handoff / Estado del proyecto

> Documento de continuidad para retomar el trabajo en una sesión nueva.
> Última actualización: 2026-08-21.

## Qué es

Agregador de eventos de Monterrey (música, deportes, cultura) con cartelera web
pública + digest semanal y recordatorios por WhatsApp. Monolito Next.js 16 +
Postgres (Prisma 6), nombres/UI en español, marca **"Vibra MX"**.

- **En producción, desplegado en Coolify**: https://vibramx.fun (+`www.`).
- **Migración completada (2026-08):** el proyecto corre en un VPS nuevo
  (`srv1915765`); DNS, webhook de GitHub y certificado Let's Encrypt ya apuntan
  ahí y verificados (válido hasta 2026-11-19). Los docs de la migración se
  borraron al completarse — quedan en el historial de git.
- Producto vivo con ~146 eventos reales, 10 fuentes (`FUENTES.md`), digest +
  recordatorios con el sender de producción de WhatsApp (plantillas aprobadas,
  baja total = apaga resumen y recordatorios).

## Reglas de trabajo (no repetirlas aquí, están en `AGENTS.md`)

1. **Push a `main` = deploy a producción** (webhook de GitHub → Coolify). Cada
   push requiere el OK explícito del usuario, en ese momento. No hay staging.
2. **Squash de commits locales justo antes de pushear** (`git reset --soft
   origin/main && git commit`) — no force-push.
3. **Nunca borrá nunca la BD de desarrollo** con `npm test`: ese comando ya NO
   la toca. El que resetea es `npm run test:borra-bd` (archivos `*.db.test.ts`).
4. **El host está en UTC**: todo preview a mano pinta 6h de más. Levantarlos
   con `TZ=America/Monterrey`. No perseguir bugs de fechas sin descartar esto.
5. **Push sellado ⛔ ya NO existe**: el bloqueo del OTP/plantillas de WhatsApp
   quedó resuelto (sender de producción operativo). No reintroducir ese bloqueo.

## Pendientes reales (abiertos en 2026-08)

- **Un evento que desaparece de su fuente sigue publicado** — la ingesta sólo
  agrega, no quita (`FUENTES.md` § "La ingesta sólo agrega"). Los eventos deben
  retirarse si la fuente ya no los trae. Es la mejora pendiente de mayor peso.
- **Recordatorios: falta el reintento real de rebotes** y el tope de intentos
  (`reminderAttempts`, cortar a 3–4) — se dejó fuera del fix a propósito
  (requería plantillas aprobadas; ya las hay). El cron diario solo mira
  "mañana", así que un rebote no se reintenta. Plan: cron cada hora + ventana de
  12–36 h + tope. Cuidado: con ventana más ancha el texto "Mañana es X" se rompe
  y hay que fijarlo contra la fecha real.
- **Cerca de una sexta categoría se rompería "Todo"** — el match y "Todo" viven
  en la lista de las 5 categorías actuales (`CATEGORIES` en
  `src/lib/events/types.ts`); agregar una afecta a todos los filtros perfilado.
- **Regla 7 (cero duplicados)** documentada para fuentes nuevas — ver
  `FUENTES.md`.

## Cómo comprobar cosas rápido

```bash
npm test                  # tests puros, SIN BD — seguro con dev server arriba
npm run test:borra-bd     # los *.db.test.ts; RESETEA eventos_mty_test
npm run test:todo         # los dos (correr antes de pushear)
npm run build             # build de producción
npm run ingest|digest|reminders   # jobs CLI (necesitan credenciales + TZ)
```

Detalle de comandos y test en dos bases: `AGENTS.md` (§ Tests) y `README.md`.

## Mapa de archivos clave

- Contrato de eventos y **fuente de verdad de las 5 categorías**:
  `src/lib/events/types.ts` (`NormalizedEvent`, `CATEGORIES`).
- Cómo se ve cada categoría (clases de color tipadas): `src/lib/events/categorias.ts`.
- Ingesta: `src/lib/ingest/` (registry, run, `sources/{ticketmaster,arena,…}`)
  + `scripts/ingest.ts`. El criterio de "fuente caída": `connector.ts`.
- Dedupe/upsert: `src/lib/events/{normalize,upsert}.ts` — `upsertEvents` **sólo
  agrega**, nunca quita (ver "Fuentes reales" arriba).
- Web: `src/app/` (page = Explorar, `eventos/[id]`, entrar, perfil,
  mis-eventos, admin/salud) + `src/app/api/`.
- WhatsApp/auth: `src/lib/whatsapp.ts`, `src/lib/auth/{otp,session}.ts`.
- Digest/recordatorios: `src/lib/digest/`, `src/lib/reminders/` + `scripts/`.
- Diseño (color, tipo, accesibilidad): el sistema visual está en `globals.css`
  (tokens Tailwind v4) + `tailwind.config`. El doc `DISENO.md` se borró al
  dejar el sistema en código — su guía está aquí de forma resumida.
- Despliegue: `DEPLOY-COOLIFY.md`. Fuentes: `FUENTES.md`.

## Docs en el repo (y su estado)

| Doc | Rol |
|---|---|
| `AGENTS.md` | **Reglas de trabajo + trampas** (previews, test, CDP/Chrome, squash/push). Léelo primero. |
| `README.md` | Vista general + guía de arranque. |
| `FUENTES.md` | Las 10 fuentes: cómo están implementadas, trampas, defensas. |
| `DEPLOY-COOLIFY.md` | El plan de despliegue en Coolify (fase 4). |
| `docs/agents/` | Hooks y vocabulario de los skills de ingeniería (issue-tracker, triage, domain). |