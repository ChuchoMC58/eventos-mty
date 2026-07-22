<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Flujo de trabajo — branch + PR, nunca push directo a `main`

`main` está protegida: no se puede pushear directo. Para cada feature/fix:

1. Crear una rama nueva desde `main` (p. ej. `feat/save-button`, `fix/tz-horas`).
2. Commitear ahí y abrir un PR a `main` con `gh pr create`.
3. El usuario revisa y mergea. El merge a `main` deploya a producción
   (auto-deploy vía Coolify).

# Al terminar un fix/feature — dejar la app corriendo en vivo para revisar

Cuando termines un fix o feature, **corre la app en vivo** y comparte la URL
para que el usuario lo revise antes de darlo por cerrado:

- Si ya está en `main`/producción, comparte la URL de prod y confirma que el
  cambio se ve ahí.
- Si sigue en una rama sin mergear, levanta la app (dev server contra la BD del
  contenedor, ver [flujo de verificación local]) y comparte la URL/puerto.

No basta con tests o build verdes: el usuario quiere ver el cambio funcionando
en la app real.

# Docs de progreso — actualizar en cada PR

Como todo merge a `main` deploya a producción, cada PR debe incluir la
actualización de los docs de progreso para que una sesión nueva no arranque
desde cero:

- `HANDOFF.md` — estado actual, fecha de "Última actualización", hecho vs. pendiente
- `README.md` / `DEPLOY-COOLIFY.md` — solo si el cambio los vuelve obsoletos
<!-- END:nextjs-agent-rules -->
