# Cómo está montado este VPS (y cómo rehacerlo en otro)

Levantado el 2026-08-15 leyendo la máquina, no los docs. Sirve para dos cosas:
entender la instalación actual y reconstruirla en una instancia nueva antes de
borrar ésta.

> ⚠️ **Este archivo va al repo, que es PÚBLICO.** No lleva ni una contraseña, ni
> un token, ni un número. Sólo dice **qué** variables existen y **de dónde** se
> sacan. Los valores viven en el `.env` local y en la UI de Coolify — cópialos a
> mano y **fuera de git**.

---

## 0. Lo que de verdad se pierde si borras la máquina

Todo lo demás se reconstruye desde el repo. Esto no:

| Qué | Dónde está hoy | Cómo sacarlo |
|---|---|---|
| **Datos de producción** (146 eventos, 1 usuario, eventos guardados) | volumen docker `postgres-data-t8h92n0ojfm4dpzsizghl93q` | `pg_dump`, ver §5 |
| **Secretos de producción** (12 variables) | UI de Coolify → app `eventos-mty` → Environment Variables | copiar a mano, ver §3 |
| **Secretos de desarrollo** | `/home/claude/eventos-mty/.env` (ignorado por git) | copiar el archivo |
| **BD de desarrollo** | `/home/claude/pgsql/data` (78 MB) | opcional; se puede repoblar con `npm run ingest` |

**No hay backups automáticos configurados** — la tabla
`scheduled_database_backups` de Coolify está vacía. Hoy el único respaldo de
producción es el que hagas a mano. Vale la pena dejarlo programado en la
instancia nueva (§6).

Lo que **no** hay que migrar porque no vive aquí: el número y las plantillas de
WhatsApp (viven en las cuentas de Twilio y Meta), el repo (está en GitHub), y el
dominio (está en el registrador).

---

## 1. La máquina

- **Hostinger VPS**, hostname `srv1835797`, Ubuntu 24.04, 96 GB de disco (27 GB
  usados), 7.8 GB de RAM.
- **IP pública `187.127.254.144`** — aparece en tres lugares que hay que cambiar
  al migrar: el registro DNS, el webhook de GitHub y `BASE_URL`.
- **Zona horaria del host: `Etc/UTC`.** A propósito o no, es así, y tiene
  consecuencias en dos lados (§7).
- Extras de Hostinger que corren solos y no son del proyecto: `monarx-agent`
  (escáner de seguridad), `unattended-upgrades`, `qemu-guest-agent`.
- **Tailscale** activo: este nodo es `srv1835797` = `100.115.135.119`, en la
  tailnet de `jesusmc765@`. Es como se entra sin exponer SSH.
- Puertos escuchando de cara al mundo: **22** (SSH), **80/443** (Traefik),
  **8000** (panel de Coolify), 6001‑6002 (realtime de Coolify). El firewall de
  Hostinger bloquea cualquier otro puerto directo — por eso los previews van por
  túnel de Cloudflare y no por `http://IP:3105`.

## 2. La pila: Coolify + Traefik + Docker

**Coolify 4.1.2** es quien orquesta todo. Panel en `http://187.127.254.144:8000`.
Registra el servidor como `localhost` vía `host.docker.internal`.

Contenedores permanentes:

| Contenedor | Imagen | Papel |
|---|---|---|
| `coolify` | `coollabsio/coolify:4.1.2` | panel y orquestador |
| `coolify-db` | `postgres:15-alpine` | BD **de Coolify** (no la de la app) |
| `coolify-redis` | `redis:7-alpine` | colas de Coolify |
| `coolify-proxy` | `traefik:v3.6` | reverse proxy, 80/443, TLS |
| `coolify-realtime` | `coollabsio/coolify-realtime` | websockets del panel |
| `coolify-sentinel` | `coollabsio/sentinel` | métricas |
| `t8h92n0ojfm4dpzsizghl93q` | `postgres:16-alpine` | **BD de producción de la app** |
| `m58mjf955rtyr48celfqjg2a-…` | imagen construida del repo | **la app** |

Todos en la red docker `coolify`. El contenedor `cdp` (`zenika/alpine-chrome`)
que quizá veas corriendo **no es de producción**: es la herramienta de
screenshots/CDP de AGENTS.md y se puede matar sin consecuencias.

**TLS y ruteo** los pone Traefik por etiquetas en el contenedor de la app, que
Coolify genera solas a partir del FQDN:

- `Host('vibramx.fun')` y `Host('www.vibramx.fun')` → servicio en el puerto 3000
- http → https forzado (middleware `redirect-to-https`), gzip activado
- certificado por `certresolver: letsencrypt` (automático, nada que copiar)

## 3. La aplicación en Coolify

- Proyecto `eventos-mty`, entorno `production`, app id 1.
- Repo `ChuchoMC58/eventos-mty.git`, rama **`main`**, build pack **`dockerfile`**,
  puerto expuesto **3000**.
- FQDN: `https://vibramx.fun,https://www.vibramx.fun`.
- **Deploy automático por webhook de GitHub**: `push` →
  `http://187.127.254.144:8000/webhooks/source/github/events/manual`. Está activo.
  Por eso *cada push a `main` deploya a producción*.

El `Dockerfile` es multi‑etapa (deps → build → runner). Dos detalles que importan:

1. El runner arranca con `npx prisma migrate deploy && npm run start`, así que
   **las migraciones se aplican solas en cada deploy**. En una BD vacía y nueva,
   el primer arranque crea el esquema completo (3 migraciones).
2. El runner se lleva el `node_modules` completo (incluye `tsx`) **a propósito**,
   para que los jobs programados puedan correr `npm run ingest|digest|reminders`
   dentro del mismo contenedor.

### Variables de entorno de producción (nombres, no valores)

Puestas a mano en la UI de Coolify:

```
DATABASE_URL            SESSION_SECRET          BASE_URL
TICKETMASTER_API_KEY    ADMIN_KEY               ADMIN_WHATSAPP
TWILIO_ACCOUNT_SID      TWILIO_AUTH_TOKEN       TWILIO_WHATSAPP_FROM
WHATSAPP_TEST_MODE      TZ                      PORT / HOST / NODE_ENV
```

Coolify inyecta además `COOLIFY_*` y `SOURCE_COMMIT` solo.

⚠️ **Producción NO tiene `ANTHROPIC_API_KEY` ni `LLM_MODEL`**, y el `.env` local
sí. Si algún día una ruta de producción llega a necesitarlas, va a fallar allá y
funcionar acá. Tenlo presente al copiar variables: la lista de prod y la de dev
no son la misma.

⚠️ `SESSION_SECRET` firma las cookies de sesión. Si pones uno nuevo en la
instancia nueva, las sesiones abiertas se invalidan y hay que volver a entrar
(hoy es 1 usuario, así que da igual — pero es más limpio copiar el mismo).

## 4. Los jobs programados (crons)

**No están en `crontab`** — son *Scheduled Tasks* de Coolify, y corren `docker
exec` dentro del contenedor de la app. En la instancia nueva hay que volver a
crearlos a mano en el panel:

| Nombre | Comando | Frecuencia | Hora en Monterrey |
|---|---|---|---|
| `ingesta` | `npm run ingest` | `0 12 * * *` | 06:00 |
| `recordatorios` | `npm run reminders` | `0 16 * * *` | 10:00 |
| `digest` | `npm run digest` | `0 0 * * *` | **18:00 del día anterior** |

⚠️ **Las frecuencias están en UTC**, porque el host está en UTC — aunque el
contenedor tenga `TZ=America/Monterrey`. Por eso el digest de las 6 de la tarde
se escribe `0 0 * * *` y no `0 18 * * *`. Si la instancia nueva queda en otra
zona horaria, **estos tres números cambian**.

## 5. Las dos bases de datos

Hay dos Postgres distintos y es fácil confundirlos.

**Producción** — contenedor `postgres:16-alpine` gestionado por Coolify:

- usuario `eventos`, base `eventos_mty`, volumen `postgres-data-t8h92n0ojfm4dpzsizghl93q`
- IP interna `172.16.1.7:5432`, **no expuesta al host** (`is_public = false`)
- 8.4 MB: `Event` 146, `EventSource` 147, `SourceRun` 52, `Venue` 9,
  `SavedEvent` 5, `User` 1, `OtpCode` 15

**Desarrollo** — un Postgres 16.14 *de espacio de usuario*, no un contenedor y no
un servicio de systemd:

```
/home/claude/pgsql/root/usr/lib/postgresql/16/bin/postgres \
  -k /home/claude/pgsql/run -h 127.0.0.1 -p 5432
```

Datos en `/home/claude/pgsql/data` (78 MB), usuario `postgres`, base
`eventos_mty`. **Lo arrancó alguien a mano** (padre PID 1, `systemctl
is-enabled postgresql` → *not-found*): si reinicias la máquina, **no vuelve
solo**. Es el que usa el `.env` local y el que los tests usan con sufijo `_test`.
En la instancia nueva vale la pena montarlo como servicio de verdad, o como
contenedor.

### Sacar y meter los datos de producción

```bash
# EN LA VIEJA — respaldo (8 MB, tarda un parpadeo)
sg docker -c 'docker exec t8h92n0ojfm4dpzsizghl93q \
  pg_dump -U eventos -d eventos_mty --no-owner --no-acl' > prod-$(date +%F).sql
```

Ese archivo trae teléfonos de usuarios: **guárdalo fuera del repo** y bórralo
cuando termines.

```bash
# EN LA NUEVA — después de que el primer deploy haya creado el esquema
cat prod-2026-08-15.sql | sg docker -c 'docker exec -i <NUEVO_CONTENEDOR_BD> \
  psql -U eventos -d eventos_mty'
```

Como el dump ya trae las tablas, la alternativa limpia es restaurar **antes** del
primer deploy y dejar que `prisma migrate deploy` encuentre todo aplicado (el
dump incluye `_prisma_migrations`, 3 filas).

---

## 6. Receta para la instancia nueva

1. **Antes de tocar nada**: `pg_dump` de producción (§5) y copia del `.env` local.
   Guarda ambos fuera del VPS.
2. Anota los valores de las 12 variables de la UI de Coolify. **Es el paso que no
   se puede deshacer** una vez borrada la máquina.
3. VPS nuevo con Ubuntu 24.04, e instalar Coolify:
   `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`
4. En el panel: crear proyecto → **Database → PostgreSQL 16**, con usuario
   `eventos` y base `eventos_mty`.
5. Crear la **aplicación** desde el repo público `ChuchoMC58/eventos-mty`, rama
   `main`, build pack `dockerfile`, puerto `3000`, FQDN `vibramx.fun` y
   `www.vibramx.fun`.
6. Pegar las 12 variables. `DATABASE_URL` apunta al hostname interno de la BD que
   Coolify acaba de crear, **no** a `172.16.1.7` (esa IP no se conserva).
   `BASE_URL` sigue siendo `https://vibramx.fun`.
7. **DNS**: en el registrador, mover el registro `A` de `vibramx.fun` y de `www`
   a la IP nueva. Hoy los nameservers son `hyperion.dns-parking.com` /
   `atlas.dns-parking.com` (DNS de Hostinger). Hazlo *antes* del primer deploy
   para que Let's Encrypt pueda validar y emitir el certificado.
8. Primer deploy. Restaurar el dump (§5).
9. Recrear los **3 jobs programados** (§4), ajustando las horas si el host nuevo
   no está en UTC.
10. **Webhook de GitHub**: Coolify genera uno nuevo con la IP nueva. Verifica en
    *Settings → Webhooks* del repo que el viejo (`187.127.254.144:8000`) ya no
    esté, o quedará disparando al vacío.
11. **Twilio / Meta: nada que cambiar**, siempre que el dominio siga siendo
    `vibramx.fun`. El webhook de WhatsApp apunta a
    `https://vibramx.fun/api/whatsapp/webhook`, que seguirá resolviendo. Si el
    dominio cambiara, hay que repuntarlo en la consola de Twilio.
12. Opcional pero recomendado: dejar programado un **backup de la BD** en Coolify,
    que hoy no existe.
13. Herramientas de desarrollo, si vas a seguir trabajando ahí: `cloudflared` en
    `~/.local/bin` (hoy la 2026.7.2), el contenedor `cdp` para screenshots, y
    Tailscale para entrar. Todo eso está descrito en `AGENTS.md`.

## 7. Trampas que ya costaron tiempo aquí

Están en `AGENTS.md` con más detalle; las repito porque se heredan a la máquina
nueva:

- **El host en UTC hace mentir a todos los previews.** `next dev` o el build
  standalone levantados a mano pintan las horas 6 horas adelantadas, y las
  funciones de tarde‑noche saltan de día. Levantarlos siempre con
  `TZ=America/Monterrey`. Los datos en la BD están bien; lo que engaña es cómo se
  pintan. Ya provocó un diagnóstico falso el 2026‑08‑14.
- **El mismo UTC es el que define los crons** (§4). Es la otra cara de lo mismo.
- **Puertos directos bloqueados por el firewall de Hostinger**: para enseñar un
  preview se usa un túnel de Cloudflare, no `http://IP:3105`. Y enrutar por el
  Traefik de Coolify hacia un proceso del *host* tampoco funciona
  (contenedor→host bloqueado).
- **`npm test` vs `npm run test:borra-bd`**: el segundo RESETEA la base. Lo que
  separa los dos comandos es el sufijo `.db.test.ts` del archivo, no el conteo.
- **La BD de tests no se migra sola**: después de cada `prisma migrate dev` hay
  que correr `prisma migrate deploy` contra `eventos_mty_test`.
- **`docker` y `sudo` fallan en sesiones viejas de tmux** aunque el usuario esté
  en los grupos: el servidor de tmux es de antes de que se agregaran. Usar `sg
  docker -c '...'` o abrir un login SSH nuevo.
- **Push a `main` = deploy a producción.** No hay entorno de staging.
