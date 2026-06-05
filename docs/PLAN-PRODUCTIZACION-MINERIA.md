# Plan de acción — Sonqollay como producto para minería

> Objetivo: pasar de **MVP/demo single-tenant local-first** a **SaaS multi-tenant vendible** a proyectos mineros.
> Sizing: **S** ≤2 días · **M** 3–5 días · **L** 1–2 semanas · **XL** >2 semanas (1 dev full-time).
> Estado de cada ítem: ☐ pendiente.

Leyenda de áreas: 🔴 Bloqueante · 🟠 Estructural · 🟡 Madurez de ingeniería · 🟢 Diferenciador.

---

## 🔴 BLOQUEANTES (riesgo legal/seguridad — antes de mostrar el producto a un cliente serio)

### B1 — Sacar datos de cliente del repo público · **M**
**Problema:** [src/data/engineering.json](../src/data/engineering.json) (2.3 MB, con costos USD, vendors, CWP/EWP reales) está commiteado en un repo **público**. La historia de git ya contiene los datos.
**Acciones:**
1. `git rm --cached src/data/engineering.json` + agregarlo a `.gitignore`.
2. Desacoplar el build del dato: el frontend deja de `import` el JSON y carga los datasets desde la API/DB en runtime (ver S1). Mientras tanto, dejar un `engineering.seed.json` chico de ejemplo (datos ficticios) versionado para dev.
3. Purgar la historia: `git filter-repo` (o BFG) para borrar `engineering.json` de todos los commits + `git push --force` (coordinar con el equipo).
4. Volver el repo **privado** (GitHub → Settings → Danger Zone) salvo que haya razón de negocio para mantenerlo público.
5. Rotar por precaución `APS_CLIENT_SECRET`, `SQY_API_TOKEN`, `SQY_DATABASE_URL`.
**Aceptación:** no hay datos reales en el árbol ni en la historia; repo privado; secretos rotados.

### B2 — Cerrar endpoints abiertos · **S**
**Problema:** `POST /api/datasets/:key` ([api/datasets/[key].js](../api/datasets/[key].js)) es público; `GET /api/aps/token` ([api/aps/token.js](../api/aps/token.js)) entrega un token APS a cualquiera; `upload-url`/`complete` permiten subir sin límite. Sin rate-limit ni límite de payload.
**Acciones:**
1. Exigir token/sesión en **todos** los endpoints de escritura y en `/api/aps/*` (reusar `pluginAuthorized` como puente hasta tener auth real; ver B3). El `POST` desde la web pasará a requerir sesión autenticada.
2. `express.json({ limit: '10mb' })` y límite de tamaño en uploads por MIME/tamaño real.
3. Rate-limiting (`express-rate-limit` en server / middleware en las funciones Vercel).
4. CORS estricto: `CLIENT_ORIGIN` obligatorio en prod (hoy si está vacío abre todo — [server/index.js](../server/index.js)).
5. En prod, no devolver `e.message` crudo; loguear el detalle y responder genérico.
**Aceptación:** ningún endpoint de escritura/token responde sin auth; rate-limit y límites de payload activos; CORS cerrado.

### B3 — Autenticación + roles · **L**
**Problema:** no hay login; un único `SQY_API_TOKEN` global; nadie sabe quién hace qué.
**Acciones:**
1. Adoptar **Supabase Auth** (ya usas Supabase Postgres) → email/password + magic link; SSO/SAML como fase posterior (ver D5).
2. Tablas `users`, `memberships(user_id, org_id, role)` con roles `viewer | editor | approver | admin`.
3. Verificación de JWT de Supabase en cada endpoint; el front manda el JWT en `Authorization`.
4. Gating de UI por rol (ocultar editar/eliminar/publicar a `viewer`).
**Aceptación:** login obligatorio; permisos aplicados en backend (no solo UI); el token global queda solo para el plugin (o se reemplaza por API key con scope).

### B4 — Aislamiento multi-tenant · **L**
**Problema:** un solo bucket APS y una sola tabla `sqy_dataset_rows` sin `project_id`/`tenant_id` ([api/_lib/db.js](../api/_lib/db.js)). No se pueden tener dos clientes aislados.
**Acciones:**
1. Modelo `organizations` → `projects`; agregar `project_id` a `sqy_dataset_rows` y a todo dato.
2. **Row-Level Security (RLS)** en Postgres por `org_id`/`project_id` ligada al JWT.
3. APS: prefijo de object key por proyecto (`datasets/<project>/<key>.json`) o bucket por proyecto.
4. Frontend: selector de proyecto; todas las queries scoped por proyecto.
**Aceptación:** un usuario de un proyecto no puede leer/escribir datos de otro (verificado con test).

---

## 🟠 ESTRUCTURAL (de demo a producto real)

### S1 — Una sola fuente de verdad (DB-backed) · **L**
**Problema:** la grilla lee de `engineering.json` (build) + `localStorage`; el plugin lee del bucket APS; Postgres existe pero la web no lo consulta. La edición de un usuario vive solo en su navegador → "multiusuario = 0".
**Acciones:**
1. Reescribir [src/utils/datastore.js](../src/utils/datastore.js) y [src/hooks/useEditableDataset.js](../src/hooks/useEditableDataset.js) para leer/escribir vía API autenticada → Postgres.
2. `localStorage` queda solo como caché offline/optimistic UI (la PWA ya está armada).
3. Migrar las 16 planillas actuales como seed inicial en la DB.
4. Unificar: web, plugin Navisworks y DataTools leen del **mismo** Postgres.
**Aceptación:** editar en una PC se ve en otra; `engineering.json` deja de ser fuente de verdad.

### S2 — AWP como entidades reales (no texto) · **XL**
**Problema:** CWA/CWP/EWP/PWP/IWP/WBS son columnas de texto; "Actualizar relación AWP" es un `window.prompt()` ([src/components/DataTable.jsx](../src/components/DataTable.jsx)). Sin jerarquía, validación ni paquetes. **Es el núcleo del valor de un producto "AWP" y hoy está vacío.**
**Acciones:**
1. Modelo `work_packages(id, project_id, type CWA|CWP|EWP|PWP|IWP, code, parent_id, attrs jsonb)` + `element_package(element_tag, package_id)`.
2. Validación de jerarquía (un CWP pertenece a un CWA), generación automática de códigos correlativos.
3. UI de empaquetamiento: árbol AWP, asignar elementos a paquetes (drag/multi-select), ver cobertura.
4. Roll-up de avance por paquete (% completado).
**Aceptación:** se arma el árbol CWA→…→IWP, se asignan elementos con validación de parentesco, y hay % de avance por paquete.

### S3 — Trazabilidad, versionado y aprobaciones · **L**
**Problema:** estados E1–E4 sin máquina de estados; sin flujo de aprobación; "historial" efímero en memoria.
**Acciones:**
1. Tabla `audit_log` append-only: `user_id, action, entity, before, after, ts` (a nivel app o triggers).
2. Máquina de estados para `ESTADO_AVANCE`/`ESTADO_APROBACIÓN` con transiciones permitidas + flujo de aprobación (solicitar/aprobar/rechazar con comentario).
3. Versionado/soft-delete de filas (poder ver historial y revertir).
**Aceptación:** todo cambio queda auditado (quién/cuándo/antes/después); flujo de aprobación funcional; historial por elemento.

---

## 🟡 MADUREZ DE INGENIERÍA (reduce riesgo de entrega y soporte)

### M1 — Tests + CI para la web · **M**
**Problema:** sin tests ni CI para el frontend/API (solo el release del plugin); `scripts/smoke.mjs` es manual; sin lint ni tipos.
**Acciones:**
1. ESLint + Prettier (config + `npm run lint`).
2. Vitest para utils críticos ([datastore.js](../src/utils/datastore.js), export, lógica AWP); Playwright e2e (promover [scripts/smoke.mjs](../scripts/smoke.mjs) a CI).
3. GitHub Actions en PR: install → lint → build → test. Merge bloqueado si falla.
4. TypeScript incremental: empezar por el modelo de datos y código nuevo.
**Aceptación:** CI verde obligatorio para mergear; cobertura en utils críticos.

### M2 — Observabilidad · **M**
**Problema:** sin logs estructurados, sin error tracking, sin uptime/alertas.
**Acciones:**
1. Sentry en frontend + funciones serverless.
2. Logs estructurados (pino) con request-id en el backend.
3. Monitor de uptime + alertas a Slack/email; health checks reales.
**Aceptación:** errores de prod visibles y con alerta; se detecta caída sin que avise el cliente.

### M3 — Deploy, releases, migraciones, backups · **M**
**Problema:** 3 configs de deploy (Vercel + [render.yaml](../render.yaml) plan **free** + [Dockerfile](../Dockerfile)) sin definir cuál es prod; frontend congelado en `0.1.0`; el esquema Postgres se crea on-the-fly (sin migraciones); sin backups verificados.
**Acciones:**
1. Definir **un** entorno productivo (Vercel front+serverless es razonable); Render free → staging o eliminar. Documentar dev/staging/prod.
2. Migraciones de DB versionadas (Supabase migrations / node-pg-migrate) en vez de `create table if not exists`.
3. Backups con PITR (Supabase) + **test de restore** documentado.
4. Semver + tags de release para la web; Dependabot + `npm audit` en CI.
**Aceptación:** prod único documentado; migraciones versionadas; restore probado; releases versionados.

### M4 — Refactor/mantenibilidad · **M**
**Acciones:** partir [DataTable.jsx](../src/components/DataTable.jsx) (~1.2k líneas) en subcomponentes; extraer la lógica de dominio (AWP, export) a módulos; tipos para dataset/row/package.
**Aceptación:** componentes <400 líneas; lógica de dominio testeable aislada.

---

## 🟢 DIFERENCIADORES (para ganar frente a O3 y afines)

### D1 — Dominio minero configurable por proyecto · **L**
**Problema:** disciplinas/subcategorías hardcodeadas en [src/data/disciplines.js](../src/data/disciplines.js); genéricas, no mineras.
**Acciones:** mover disciplinas/subcategorías a datos por proyecto (editables); plantillas por operador (Codelco/BHP/etc.); catálogo de códigos de mercancía con validación; disciplinas mineras (tronadura, procesamiento, geología).
**Aceptación:** un proyecto nuevo configura su estructura sin tocar código.

### D2 — Navisworks bidireccional + vínculo por GUID · **L**
**Problema:** el vínculo es por TAG como texto normalizado; publish manual.
**Acciones:** vincular por GUID/ObjectId estable además del TAG; sincronización en dos sentidos (traer estado del modelo a la web); auto-publish por webhook al guardar (sin clic manual). Construye sobre el plugin Aura BIM ya existente.
**Aceptación:** match robusto sin colisiones de texto; cambios se reflejan sin pasos manuales.

### D3 — Dashboards y reportes · **L**
**Problema:** solo un panel de contadores; sin curvas S ni reportes.
**Acciones:** dashboards de avance por CWP/EWP, curvas S, pronósticos; export a PDF/Excel con gráficos; reportes de cumplimiento.
**Aceptación:** un gerente ve avance del proyecto sin abrir la grilla.

### D4 — Internacionalización (i18n) · **M**
**Problema:** 100% español hardcodeado.
**Acciones:** i18next con ES/EN/PT; formato de números/fechas por locale.
**Aceptación:** cambiar idioma sin recompilar; cubre clientes fuera de LatAm hispana.

### D5 — Integraciones enterprise · **L**
**Acciones:** SSO/SAML (Azure AD/Okta); API documentada (OpenAPI); webhooks; exportes a Power BI/SAP; certificación (SOC 2 / ISO 27001) como objetivo comercial.
**Aceptación:** TI de la minera puede integrar y auditar.

---

## Secuenciación sugerida

| Fase | Duración aprox. | Ítems | Resultado |
|---|---|---|---|
| **Sprint 0 — Frenar el sangrado** | ~1 semana | B1, B2, M3(parte: prod único + Render free) | Sin fugas de datos ni endpoints abiertos; prod definido |
| **Fase 1 — SaaS real** | ~4–6 semanas | B3, B4, S1, S3, M1, M2, M3 | Login + multi-tenant + 1 fuente de verdad + auditoría + CI/observabilidad |
| **Fase 2 — Valor AWP** | ~4–6 semanas | S2, D1, D2 | AWP como entidades reales + dominio configurable + Navisworks bidireccional |
| **Fase 3 — Escala/comercial** | ~4–6 semanas | D3, D4, D5, M4 | Dashboards, i18n, integraciones enterprise, refactor |

**Dependencias clave:** B3 (auth) habilita B4 (multi-tenant) y S1/S3; S1 es prerequisito de dashboards (D3) y de AWP real (S2). M1/M2/M3 corren en paralelo desde Fase 1.

## Quick wins (se pueden hacer hoy)
- B1 (sacar `engineering.json` de git + gitignore) — **S**, alto impacto.
- B2 (token + rate-limit + límite de payload + CORS) — **S**.
- M3-parcial (sacar Render del plan free / documentar prod único) — **S**.
