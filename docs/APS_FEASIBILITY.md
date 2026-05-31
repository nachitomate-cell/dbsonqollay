# Factibilidad — Integración Autodesk Platform Services (APS) y modelos NWD

> Estudio de factibilidad para integrar **Autodesk Platform Services (APS)**,
> ex-Forge, en Sonqollay (Aura), para visualizar modelos **NWD de Navisworks** y
> ejecutar los comportamientos de aislamiento por paquetes de trabajo (CWA / CWP
> / IWP / SWP) descritos en la lámina "Uso de BIM".
>
> Estado: **propuesta / no implementado**. No requiere cambios de código aún.

---

## 1. Resumen ejecutivo

**¿Es posible? Sí, en su totalidad.** Todos los requisitos de la lámina son
viables con APS. Ninguno es un bloqueante técnico.

La diferencia clave respecto a lo que Sonqollay ya tiene (visor three.js con
glTF/GLB, 100 % en el navegador) es que **APS exige un backend** y **una cuenta
Autodesk de pago**. El secreto de cliente (Client Secret) no puede vivir en el
frontend, y la traducción del NWD ocurre en la nube de Autodesk.

Buena noticia: la **lógica de negocio AWP ya está construida** en Sonqollay
(filtros visuales por CWA/CWP/EWP/IWP/SWP, aislar/ocultar, color por estado,
exportación CSV/Excel, listados por paquete). Migrar del visor glTF al **APS
Viewer** es principalmente cambiar la *fuente de geometría* y el *motor de
render*, reutilizando el mapeo "TAG ↔ objeto" que ya existe (campo de vínculo
configurable).

---

## 2. Mapa requisito → factibilidad

| # | Requisito de la lámina | ¿Posible? | Mecanismo APS |
|---|------------------------|-----------|---------------|
| 1 | Leer/visualizar **NWD de Navisworks** en web | ✅ | **Model Derivative API** traduce NWD → SVF2; **APS Viewer** lo renderiza (WebGL) |
| 2 | NWD publicado con "Se puede volver a guardar" | ✅ (proceso) | Requisito de Navisworks (Salida → NWD, *Re-saveable* ON) antes de subir |
| 3 | Seleccionar CWA/CWP/IWP/SWP de un listado | ✅ | Listado = datos de Sonqollay (ya existe); dispara acciones en el Viewer |
| 4 | Modelo en **blanco + 75 % transparencia**, salvo objetos del paquete | ✅ | `viewer.setThemingColor()` + `setGhosting(true)` / `isolate(dbIds)` |
| 5 | Resaltar solo los objetos del paquete elegido | ✅ | `viewer.isolate(dbIds)` o `select()` + `fitToView()` |
| 6 | **Exportar imagen** del CWA/CWP/IWP/SWP en **16:9** | ✅ | `viewer.getScreenshot(w,h)` con relación 16:9 + recorte en canvas |
| 7 | Al elegir CWP: **listado de componentes** del paquete | ✅ | Filtro de datos por CWP (ya existe en la planilla) |
| 8 | Exportar ese listado | ✅ | Export CSV/Excel (ya existe) |
| 9 | Insertar el listado en el **informe de CWP** (Ing. de Detalles) | ✅ | Generación de informe (PDF/Excel) — feature nueva de reporting |

---

## 3. ¿Qué hace falta que hoy NO tenemos?

1. **Cuenta Autodesk + app APS** → `APS_CLIENT_ID` y `APS_CLIENT_SECRET`.
   - APS es **de pago**: consumo por *tokens* de procesamiento (traducción de
     modelos) y almacenamiento (OSS). Hay capa gratuita limitada para pruebas.
2. **Backend** (Node/Express, .NET, etc.) — **obligatorio**, por tres motivos:
   - **OAuth 2-legged**: el `Client Secret` jamás puede exponerse al navegador.
     El backend emite *access tokens* de alcance reducido para el Viewer.
   - **Subida + traducción** del NWD (OSS bucket → Model Derivative job).
   - **Webhook/polling** del estado de traducción.
   - Hasta ahora Sonqollay es **frontend puro**; este es el cambio arquitectónico
     mayor.
3. **Pipeline Navisworks** (manual, del lado del cliente):
   - Abrir el modelo, **Salida → NWD**, con **"Se puede volver a guardar"**
     activado, y publicar (no solo guardar).

---

## 4. Arquitectura propuesta

```
┌────────────────────┐        ┌──────────────────────────┐        ┌────────────────────┐
│  Sonqollay (SPA)   │        │  Backend Sonqollay (API) │        │  Autodesk APS      │
│  React + Viewer    │        │  Node/Express            │        │  (nube)            │
│                    │        │                          │        │                    │
│  1. pide token ────┼───────►│ 2. OAuth 2-legged ──────┼───────►│  Authentication    │
│                    │◄───────┤    (token de viewer)     │◄───────┤  (scopes: viewer)  │
│                    │        │                          │        │                    │
│  6. Viewer carga   │        │ 3. subir NWD a OSS ─────┼───────►│  OSS (bucket)      │
│     urn + token ───┼───────►│ 4. lanzar traducción ───┼───────►│  Model Derivative  │
│                    │        │ 5. estado/urn SVF2 ◄────┼────────┤  (NWD → SVF2)      │
│  7. isolate/ghost  │        │                          │        │                    │
│     screenshot 16:9│        │  (TAG ↔ dbId mapping)    │        │                    │
└────────────────────┘        └──────────────────────────┘        └────────────────────┘
```

### Endpoints mínimos del backend

| Método | Ruta | Función |
|--------|------|---------|
| `GET`  | `/api/aps/token` | Devuelve un token *viewer-only* (scope `viewables:read`) |
| `POST` | `/api/aps/models` | Sube un NWD a un bucket OSS y lanza la traducción |
| `GET`  | `/api/aps/models/:urn/status` | Estado de la traducción (pending/success/failed) |
| `GET`  | `/api/aps/models` | Lista de modelos traducidos disponibles (urn + nombre) |

### Variables de entorno

```
APS_CLIENT_ID=...
APS_CLIENT_SECRET=...        # nunca en el frontend
APS_BUCKET=sonqollay-models  # bucket OSS
APS_CALLBACK_URL=...         # si se usa 3-legged a futuro
```

---

## 5. Cómo encajan los comportamientos de la lámina en el Viewer

Pseudocódigo (APS Viewer v7), reutilizable para CWA/CWP/IWP/SWP:

```js
// Aísla un paquete: resto en blanco + 75% transparencia, paquete resaltado.
function isolateWorkPackage(viewer, dbIds) {
  const WHITE = new THREE.Vector4(1, 1, 1, 1)
  viewer.setGhosting(true)                 // "fantasma" para lo no aislado
  viewer.setQualityLevel(false, true)
  viewer.isolate(dbIds)                     // solo el paquete queda opaco
  viewer.model.getData().instanceTree.enumNodeChildren(/* resto */)
  // resto en blanco translúcido:
  allOtherDbIds.forEach((id) => viewer.setThemingColor(id, WHITE, null, true))
  viewer.setOpacity?.(0.25)                 // 25% opacidad = 75% transparencia
  viewer.fitToView(dbIds)
}

// Exportar imagen 16:9 del estado actual.
function exportImage16x9(viewer) {
  const w = 1920, h = 1080            // 16:9
  viewer.getScreenshot(w, h, (blob) => downloadBlob(blob, 'CWP.png'))
}
```

El **mapeo TAG ↔ dbId** se resuelve igual que hoy con el "campo de vínculo
configurable": se leen las **propiedades** de cada objeto del modelo
(`viewer.getProperties(dbId)`) y se cruzan con el TAG/GUID/ObjectId de la base
de datos de Sonqollay.

---

## 6. Esfuerzo y fases sugeridas

| Fase | Alcance | Estimación* |
|------|---------|-------------|
| 0 | Cuenta APS + credenciales + bucket OSS (cliente) | — (lo provee el cliente) |
| 1 | Backend mínimo (token + subida + traducción + estado) | 3–5 días |
| 2 | APS Viewer en Sonqollay (selector de motor three.js ↔ APS) | 2–3 días |
| 3 | Aislar CWA/CWP/IWP/SWP (ghost+white+isolate) + fit | 2 días |
| 4 | Exportar imagen 16:9 | 0.5 día |
| 5 | Listado de componentes por CWP + exportar | (ya existe) 0.5 día |
| 6 | Informe de CWP (PDF/Excel) para Ing. de Detalles | 2–3 días |
| 7 | TAG ↔ dbId desde propiedades del modelo | 1–2 días |

\* Estimación de desarrollo, asumiendo credenciales y un NWD de prueba ya
publicado. No incluye costos de consumo de APS.

---

## 7. Riesgos y consideraciones

- **Costo recurrente de APS** (traducción + almacenamiento + viewer tokens).
- **Privacidad**: el modelo se sube a la nube de Autodesk; validar si el cliente
  lo permite (algunos proyectos mineros/industriales exigen on-premise).
- **Tamaño del NWD**: modelos grandes → tiempos de traducción largos y más costo.
- **Dependencia de Navisworks** para el paso de publicación (manual, del cliente).
- **Alternativa sin nube**: seguir con el visor glTF/GLB actual (IFC→glTF u otro
  export) si APS no es viable por costo/privacidad. Cubre la mayoría de los
  comportamientos de aislamiento/color/exportación que ya tiene Sonqollay, sin
  backend ni cuenta de pago, pero **no lee NWD directamente**.

---

## 8. Conclusión

La integración con APS es **plenamente factible** y la lámina describe un flujo
estándar de APS (Model Derivative + Viewer). El trabajo nuevo se concentra en
**(a)** levantar un backend para OAuth/traducción y **(b)** sustituir el motor de
render por el APS Viewer, reutilizando toda la lógica AWP ya construida en
Sonqollay. Los dos prerrequisitos no técnicos son **credenciales APS de pago** y
la **publicación del NWD** desde Navisworks.

**Recomendación:** confirmar primero con el cliente la **disponibilidad de cuenta
APS y la política de subir el modelo a la nube**. Con eso resuelto, ejecutar las
Fases 1–4 como MVP visual y luego 5–7 para el reporting de CWP.
