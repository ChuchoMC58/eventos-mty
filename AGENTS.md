<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Flujo de trabajo — branch + PR, nunca push directo a `main`

`main` está protegida: no se puede pushear directo. Para cada feature/fix:

1. Crear una rama nueva desde `main` (p. ej. `feat/save-button`, `fix/tz-horas`).
2. Commitear ahí y abrir un PR a `main` con `gh pr create --assignee @me`.
3. El usuario revisa y mergea. El merge a `main` deploya a producción
   (auto-deploy vía Coolify).

**NUNCA hagas merge a `main`.** Abre el PR, asígnalo al usuario, avísale y
detente — el merge lo hace SIEMPRE el usuario, aunque técnicamente puedas
hacerlo tú y aunque te lo hayan pedido antes. Si el usuario quiere que mergees,
que lo diga explícitamente en ese momento; por default, no.

# Al terminar un fix/feature — dejar la app corriendo en vivo para revisar

Cuando termines un fix o feature, **corre la app en vivo** y comparte la URL
para que el usuario lo revise antes de darlo por cerrado:

- Si ya está en `main`/producción, comparte la URL de prod y confirma que el
  cambio se ve ahí.
- Si sigue en una rama sin mergear, levanta la app (dev server contra la BD del
  contenedor, ver [flujo de verificación local]) y comparte la URL/puerto.

No basta con tests o build verdes: el usuario quiere ver el cambio funcionando
en la app real.

## ⚠️ Previews con `next dev`: hidratación y orígenes permitidos

Dos trampas ya pisadas (2026-07-23) al levantar el dev server para revisión:

1. **Next 16 bloquea los chunks JS del dev server desde orígenes no listados**
   (`127.0.0.1`, la IP del VPS, dominios `*.sslip.io`) → la página carga SIN
   JavaScript y los componentes cliente parecen rotos (así nació el falso bug de
   "el input de teléfono acepta letras"). El origen del preview debe estar en
   `allowedDevOrigins` de `next.config.ts`. Si un componente cliente "no
   reacciona" en un preview, verifica esto ANTES de tocar el código. Solo aplica
   a `next dev`; producción no se ve afectada.
2. **Si Turbopack da FATAL "Permission denied" en `.next`**: hay residuos owned
   por root de corridas dockerizadas. Borrar `.next` completo (vía contenedor si
   hace falta) y dejar que recompile.

# Docs de progreso — `HANDOFF.md` vive en `main`, no en PRs de features

Como todo merge a `main` deploya a producción, los docs de progreso deben
mantenerse al día para que una sesión nueva no arranque desde cero, pero:

- **Los PRs de features NO tocan `HANDOFF.md`** (evita conflictos entre ramas).
  Las actualizaciones de estado (fecha de "Última actualización", hecho vs.
  pendiente) van en una rama/PR de docs aparte (p. ej. `docs/notas-revision`).
- `README.md` / `DEPLOY-COOLIFY.md` — actualizar solo si el cambio los vuelve
  obsoletos (eso sí puede ir en el PR del feature que los invalida).
<!-- END:nextjs-agent-rules -->
