<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Docs de progreso — actualizar en cada commit a `main`

Todo push a `main` deploya a producción (auto-deploy vía Coolify). Antes de cada
commit que vaya a `main`, actualiza **en ese mismo commit** los docs de progreso
para que una sesión nueva no arranque desde cero:

- `HANDOFF.md` — estado actual, fecha de "Última actualización", hecho vs. pendiente
- `README.md` / `DEPLOY-COOLIFY.md` — solo si el cambio los vuelve obsoletos
<!-- END:nextjs-agent-rules -->
