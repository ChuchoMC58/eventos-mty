<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Flujo de trabajo — branch + PR, nunca push directo a `main`

`main` está protegida: no se puede pushear directo. Para cada feature/fix:

1. Crear una rama nueva desde `main` (p. ej. `feat/save-button`, `fix/tz-horas`).
2. Commitear ahí y abrir un PR a `main` con `gh pr create`.
3. El usuario revisa y mergea. El merge a `main` deploya a producción
   (auto-deploy vía Coolify).

# Docs de progreso — actualizar en cada PR

Como todo merge a `main` deploya a producción, cada PR debe incluir la
actualización de los docs de progreso para que una sesión nueva no arranque
desde cero:

- `HANDOFF.md` — estado actual, fecha de "Última actualización", hecho vs. pendiente
- `README.md` / `DEPLOY-COOLIFY.md` — solo si el cambio los vuelve obsoletos
<!-- END:nextjs-agent-rules -->
