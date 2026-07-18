# Despliegue en Coolify (FASE 4)

Reemplaza el plan original de Railway. Coolify (self-hosted en tu VPS) construye
desde un repo Git usando el `Dockerfile` de este proyecto.

## Requisitos previos
- Coolify instalado en el VPS (ya está).
- El repo empujado a un remoto Git (GitHub/GitLab) al que Coolify tenga acceso,
  **o** el repo conectado vía la app de GitHub de Coolify / deploy key.

## 1. Base de datos PostgreSQL
En Coolify: **+ New → Database → PostgreSQL 16**. Coolify genera credenciales y una
`DATABASE_URL` interna (host = nombre del servicio en la red de Coolify). Cópiala.

## 2. Aplicación (servicio web)
**+ New → Application → Public/Private Repository** → elegir el repo y la rama `main`.
- Build Pack: **Dockerfile** (este repo lo trae en la raíz).
- Port: **3000**.
- Health check path: `/` (opcional).

### Variables de entorno del servicio web
```
DATABASE_URL=<la URL interna del Postgres de Coolify>
SESSION_SECRET=<cadena aleatoria larga>
BASE_URL=https://<tu-dominio-asignado>
TICKETMASTER_API_KEY=<...>
ANTHROPIC_API_KEY=<...>
LLM_MODEL=claude-sonnet-5
TWILIO_ACCOUNT_SID=<...>
TWILIO_AUTH_TOKEN=<...>
TWILIO_WHATSAPP_FROM=+14155238886
ADMIN_WHATSAPP=+52<tu número>
WHATSAPP_TEST_MODE=true          # NO cambiar a false hasta plantillas Meta aprobadas
ADMIN_KEY=<cadena aleatoria para /admin/salud>
TZ=America/Monterrey
```
El `CMD` del Dockerfile aplica `prisma migrate deploy` antes de arrancar, así que
las migraciones corren solas en cada despliegue.

## 3. Jobs programados (cron)
En Coolify, dentro de la aplicación → **Scheduled Tasks**. Cada tarea corre un
comando DENTRO del contenedor de la app (por eso el Dockerfile conserva `tsx`,
`src/` y `scripts/`). Monterrey es UTC-6 fijo (sin horario de verano).

| Tarea         | Comando              | Cron (UTC)   | Hora local |
|---------------|----------------------|--------------|------------|
| Ingesta       | `npm run ingest`     | `0 12 * * *` | 06:00 diario |
| Recordatorios | `npm run reminders`  | `0 16 * * *` | 10:00 diario |
| Digest        | `npm run digest`     | `0 0 * * *`  | 18:00 diario (envía solo a quien le toca ese día) |

## 4. Webhook de WhatsApp (Twilio)
En Twilio (sandbox: "When a message comes in") apuntar a:
`https://<tu-dominio>/api/whatsapp/webhook` — procesa la respuesta "BAJA".

## 5. Verificación de producción
- Abrir `BASE_URL` → cartelera (vacía hasta la primera ingesta con claves reales).
- `/admin/salud?key=<ADMIN_KEY>` → tabla de fuentes; correr ingesta primero.
- Registrarte con tu número, guardar un evento; el digest/recordatorio llega al
  WhatsApp del admin con la etiqueta `[PRUEBA → ...]` (modo prueba).

## Notas
- Imagen: el `Dockerfile` conserva `node_modules` completo para que los cron (tsx)
  funcionen en el mismo contenedor. Suficiente para v1.
- Salir del sandbox de Twilio a producción requiere número de WhatsApp Business y
  plantillas aprobadas por Meta (digest = *marketing*, recordatorio/OTP = *utility*).
  Iniciar ese trámite temprano (tarda días).
