# Análisis de Aura AWP (aura-awp.com) — para replicar el concepto en AURA GIP

> Reconstrucción del sistema **Aura AWP** a partir del acceso completo (proyecto
> demo **SQY-2025-01 · PLANTA DE SERVICIOS AUXILIARES**, Minera del Norte S.A.).
> Sirve de base para definir cómo AURA GIP incorpora "el mismo concepto".
> Fecha: 2026-06-07.

## 0. Resumen ejecutivo
Aura AWP es una **plataforma de gestión AWP a nivel de paquetes de trabajo**:
organiza el proyecto en la jerarquía **CWA → CWP → IWP** (+ EWP/PWP/SWP), sobre un
**plot plan georreferenciado**, con **cronograma, restricciones, revisiones,
sesiones IPS, reportes PDF y dashboards**. Es la capa de **planificación y
control**. AURA GIP (lo nuestro) es fuerte en la capa **de información de
ingeniería** (componentes/planillas, BIM 3D, plugin Navisworks) — que es
justamente donde Aura AWP es más liviano. **Los dos comparten el modelo BIM**
(`SQY_BIM.nwf`): los PWP de Aura AWP se poblan importando componentes desde ese
NWF.

## 1. Jerarquía y navegación

```
AURA (marca)
└── Organización (SQY Ingeniería · 17 usuarios)
    └── Proyecto (SQY-2025-01 · 7 miembros · 258.850 HH)
        ├── Configuración (10 pestañas)
        └── Workspace
            ├── Dashboard
            ├── Sesiones (IPS)            3
            ├── CWAs (Áreas)              8   [Lista | Plano georreferenciado]
            ├── CWPs (Construcción)       29  [Listado | Matriz CWA×Disciplina]
            ├── IWPs (Instalación)        261 (en 26 CWPs)
            ├── SWPs (Sistema/commissioning) 1
            ├── PWPs (Procura)            29  (origen BIM = SQY_BIM.nwf)
            ├── EWP (Ingeniería/docs)     65
            ├── Cronograma (Gantt)
            ├── Restricciones             30
            ├── Reportes (PDF)
            └── Revisiones (Rev A–D)
```

Jerarquía de paquetes AWP: **CWA** (área física) → **CWP** (paquete de
construcción, por disciplina) → **IWP** (paquete de instalación, granular). En
paralelo: **EWP** (ingeniería), **PWP** (procura), **SWP** (sistemas/commissioning).

## 2. Datos reales del proyecto demo (para validar el modelo)
- 8 CWAs, 29 CWPs, 261 IWPs, 1 SWP, 29 PWPs, 65 EWP, 3 sesiones, 30 restricciones.
- 258.850 HH estimadas, 100% asignadas. Máx por CWA: 100.000 HH.
- Cronograma: 04 ene 2027 → 19 oct 2027 (288 días construcción; entrega a
  operaciones 30 nov 2027). Revisión actual **Rev D (Aprobada)**.
- CWAs (código · nombre · HH · restricciones):
  CWA-01 Movimientos de tierra masivos 9.200 ·0 | CWA-02 Caminos y veredas 7.100 ·0
  | CWA-03 Planta enfriado de agua 45.250 ·0 | CWA-04 Planta compresión de aire
  28.450 ·1 | CWA-05 Planta de reactivos 84.150 ·0 | CWA-06 Pipe rack 36.200 ·1 |
  CWA-07 Subestaciones 1 y 2 38.800 ·3 | CWA-08 Obras transversales 9.700.

## 3. Módulos del Workspace (con campos)

### 3.1 Dashboard
KPIs: **CWAs** (validadas/definidas/borrador + HH asignadas) · **Horas Hombre**
(asignadas/total/sin asignar + % asignación) · **Cronograma** (inicio/fin,
progreso temporal %, días restantes) · **Estado de Revisión** (rev actual,
aprobadas/pendientes). Gráficos: **sunburst CWA/CWP/IWP**, **donut distribución de
esfuerzo por HH**, **donut de restricciones**.

### 3.2 CWAs (Construction Work Areas)
- Vista **Lista**: código, nombre, descripción, tipo (Gráfica), estado
  (Planificada/Validada/Borrador), HH estimadas, nº restricciones, acción exportar
  PDF por CWA.
- Vista **Plano** (clave): lienzo interactivo sobre el **Plot Plan** del sitio.
  Niveles/planos (PP-001…PP-004), **plano calibrado** (escala px/m, línea de
  referencia), dibujar CWAs con **rectángulo/círculo**, mostrar/ocultar, cargar
  plano, recalibrar. → **georreferenciación de áreas**.

### 3.3 CWPs (Construction Work Packages)
- Vista **Listado** y vista **Matriz CWA × Disciplina**: por cada cruce
  CWA×disciplina activa, se indica cuántos CWPs crear → **creación masiva** de
  CWP/EWP/PWP de forma atómica.
- Cada CWP: código (ej. `CWP-03-M-01`), nombre, CWA, disciplina (letra+color),
  HH, nº IWPs ("apertura" del CWP en IWPs).

### 3.4 IWPs (Installation Work Packages)
- 261 IWPs en 26 CWPs. Lista por CWP: CWA, nº IWPs, disciplina, HH del CWP.
- Se **autogeneran** al "abrir" un CWP (estado "Sin apertura" si aún no). HH
  objetivo por IWP configurable (default 1.350). "Regenerar Códigos".

### 3.5 SWPs (System Work Packages)
- Paquetes de **commissioning/puesta en marcha**. Campos: código, nombre, sistema,
  prioridad, estado, progreso, docs (n/total).

### 3.6 PWPs (Procurement Work Packages) — **punto de integración con BIM/GIP**
- 29 PWPs. Campos: código, nombre, CWP, CWA, **Origen (BIM)**, **Fuente
  (`SQY_BIM.nwf`)**, fecha importado, **Comp. (nº de componentes + tags)**, estado
  (En Edición). Filtros por origen/CWA/CWP.
- → Los PWP **se poblan importando componentes desde el modelo Navisworks**. Aquí
  es donde el dato de AURA GIP (componentes/BIM) se cruza con el paquete AWP.

### 3.7 EWP (Universo Documental de Ingeniería)
- 65 entregables. Stat: total, técnicos, gestión, CWP sí/no, sin clasificar, req.
  en obra, asignados a EWP. Importar/Exportar, **asignación masiva**.
- Por documento: N° documento, descripción, disciplina, tipo (Plano…), **categoría**
  (Técnico/Gestión), **req. obra** (Sí/No), **aplicabilidad** (CWP Sí/No), estado,
  fecha término. Filtro por disciplina.

### 3.8 Cronograma (Gantt)
- Línea de tiempo CWA/CWP. Vistas Mensual/Trimestral/Anual, expandir, **Look
  Ahead**, exportar. Barras por estado: **Planificada / En Construcción /
  Completada**; color de CWP = disciplina; hitos **Entrega a Operaciones** y
  **Sobrepasa Operaciones**; badges de restricciones por barra.

### 3.9 Restricciones (Constraint management)
- 30 restricciones. Stat: total, críticas, en gestión, resueltas, vencidas.
  Importar/Exportar, nueva. Vista Tabla/Tarjetas.
- Por restricción: código (RST-###), **prioridad** (Alta/Media), título, CWA, CWP,
  **tipo** (Equipos/Permisos/Documentación/Materiales), **fecha límite** (+ días
  vencida), **estado** (Identificada/En Gestión/Resuelta), responsable, origen,
  impacto. Objetivo AWP: los IWP deben quedar "libres de restricciones" antes de
  liberarse a terreno (ventana look-ahead configurable).

### 3.10 Reportes (PDF, con marca SQY)
- **Informe de Áreas (CWA)** consolidado · **Informe CWP N3** (técnico: identificación,
  ingeniería, abastecimiento, cubicaciones, precedentes) · **Informe CWA/CWP**
  (fichas) · **Informe PoC** (consolida sesiones IPS: métricas, decisiones, action
  items). Con historial y "regenerar".

### 3.11 Revisiones (control documental de reportes)
- Revisiones **Rev A–D** con estado (Aprobada/Reemplazada), nº de revisores
  (aprobaciones), autor. **Historial de bloqueos**: bloqueo/desbloqueo de CWAs,
  **aprobación de cliente**. → ciclo formal de revisión y congelamiento.

### 3.12 Sesiones (IPS — Interactive Planning Sessions)
- Sesiones de planificación AWP (3). Alimentan el **Informe PoC** (decisiones,
  action items). *(Pendiente ver el detalle de una sesión.)*

## 4. Configuración del proyecto (10 pestañas)
1. **Identificación**: código, nombre, descripción, cliente, división del cliente,
   contratista, imagen del proyecto (+ descripción, va al informe CWA).
2. **Clasificación**: *(pendiente de ver)* — tipo de contrato (E), sector (Minería), fase (FEL-3).
3. **Disciplinas**: 9 de 11 activas; cada una con **toggle + prefijo (letra) + color
   (hex)**. (A #8FBC8F, P #FFFF00, C #B0C4DE, E #ADD8E6, S #4682B4, H, M, I, T…).
4. **Actividades**: catálogo de **70 actividades estándar** por disciplina para
   desglosar CWPs (ej. Cañerías: PF, MT, SP, SW, ND, PH, FL, PI; Civil: EX…). Opcional.
5. **Ubicación**: país, región, ciudad, dirección, **coordenadas UTM/WGS84** (zona,
   hemisferio, easting, northing), **altitud**, **zona sísmica**.
6. **Ambiente**: zona climática (BWh), temp min/max, temporada de lluvias, horas luz
   verano/invierno.
7. **Fechas**: inicio/fin planificado, **entrega a operaciones**.
8. **Presupuesto**: monto total, **moneda**, HH estimadas.
9. **Configuración AWP**: **HH máx por CWA/CWP**, **HH objetivo por IWP**, **semanas
   lookahead** de restricciones; **nomenclatura de paquetes** (modo Guiado/Libre,
   prefijos + correlativos + incluir nº CWA / disciplina; ej. `CWP-01-ME-001`).
10. **Roles AWP**: categorías expandibles con sub-roles — **Functional Owner**,
    **Gestión de Proyecto**, **Gestión de Construcción**, **Ingeniería**,
    **Contratista de Construcción** (≈39 roles posibles, se activan por proyecto).
- **Ciclo de vida**: Activo → Suspendido / Completado / Cancelado. **Zona de
  peligro**: eliminar proyecto.

## 5. Equipo y accesos
- Roles de miembro vistos: **Project Manager**, **AWP Champion**, **Control de
  Documentos**. Agregar miembro.
- **Acceso Externo**: invitar externos con **empresa, vencimiento y revocación**.

## 6. Mapa de brechas — AURA GIP vs Aura AWP
| Concepto | Aura AWP | AURA GIP hoy |
|---|---|---|
| Org → Proyecto | ✅ | 🟡 scaffold |
| Config rica de proyecto (10 pestañas) | ✅ | 🔴 (solo nombre/desc) |
| Disciplinas con prefijo+color | ✅ | 🟡 (disciplinas sí; sin prefijo/color editable) |
| Roles AWP (5 categorías, ~39 roles) + acceso externo | ✅ | 🔴 (modelo básico en DB) |
| **CWA/CWP/IWP/EWP/PWP/SWP como entidades** | ✅ | 🔴 (GIP solo etiqueta CWA/CWP en componentes) |
| **Plot plan georreferenciado** (dibujar CWAs) | ✅ | 🔴 |
| **Matriz CWA×Disciplina** (creación masiva) | ✅ | 🔴 |
| **Cronograma / Gantt + Look Ahead** | ✅ | 🔴 |
| **Restricciones** (constraint mgmt) | ✅ | 🔴 |
| **Revisiones** (Rev A–D, aprobación, bloqueo) | ✅ | 🔴 |
| **Sesiones IPS** | ✅ | 🔴 |
| **Reportes PDF** (CWA, CWP N3, PoC) | ✅ | 🟡 (export Excel/CSV; sin PDF) |
| Dashboards (sunburst, donuts, HH) | ✅ | 🟡 (cobertura/avance por CWP) |
| **Componentes/elementos a nivel ítem** (planillas, edición masiva) | 🟡 (PWP los importa de BIM) | ✅ GIP |
| **BIM 3D embebido** (APS) + colorear/aislar | 🔴 | ✅ GIP |
| **Plugin Navisworks** (escribir props al modelo) | 🔴 | ✅ GIP |

**Lectura:** Aura AWP = capa de **paquetes/control**. AURA GIP = capa de
**información/BIM**. El NWF (`SQY_BIM.nwf`) es el puente: los PWP de AWP nacen de
los componentes del modelo, que es justo lo que GIP gestiona en detalle.

## 7. Decisión estratégica (a confirmar con el cliente)
Tres caminos posibles para "que AURA GIP tenga el mismo concepto":
- **A) Clonar** el concepto AWP completo dentro de GIP (todo lo 🔴). Es,
  esencialmente, **reconstruir Aura AWP** — varios meses de desarrollo por fases.
- **B) Complementar/Integrar**: GIP sigue siendo la capa de información+BIM y se
  **integra** con Aura AWP (vía export/API) — menor esfuerzo, evita duplicar.
- **C) Híbrido**: GIP adopta **parte** del concepto (config de proyecto rica +
  CWA/CWP/IWP como entidades + dashboards + reportes PDF) y deja
  cronograma/restricciones/revisiones para una fase 2.

## 8. Roadmap por fases (si se elige A o C)
1. **Modelo de proyecto AWP**: config rica (10 pestañas), disciplinas con
   prefijo+color, roles, acceso externo, ciclo de vida.
2. **Entidades de paquetes**: CWA, CWP (matriz de creación masiva), IWP (apertura),
   EWP, PWP (import desde BIM/NWF — aprovecha el plugin), SWP. Nomenclatura
   configurable.
3. **Plot plan georreferenciado** (dibujar CWAs sobre el plano).
4. **Dashboards** (sunburst CWA/CWP/IWP, HH, donuts) + **reportes PDF**.
5. **Cronograma/Gantt** (+ Look Ahead) y **Restricciones** (constraint mgmt).
6. **Revisiones** (Rev A–D, aprobación, bloqueo) y **Sesiones IPS** + Informe PoC.

## 9. Detalle de entidades (2ª tanda de capturas)

### 9.1 Ficha CWA (editar)
Campos: **Nombre**, **Descripción**, **Número de Secuencia (PoC)** = orden en el
Path of Construction, **Fecha inicio/fin planificada**, **HH estimadas** (máx
recomendado 100.000). Estado (Planificada/Validada/Borrador). Extras:
- **Historial de Estimaciones IA** (ver 9.5): conversaciones de estimación de HH
  con IA (principal/secundarias, en progreso/completada, "Recalcular con IA").
- **Imágenes** (hasta 10, PNG/JPEG/WebP ≤5MB).
- **Vistas en Planos** (los PP donde está dibujada; una marcada como principal ★).
- **Restricciones** de la CWA (liberación). Banner: para cambiar el polígono se va
  a "Gestionar Planos". **Descargar Ficha PDF**.

### 9.2 Ficha CWP (editar) — nodo central de relaciones
Campos: **Disciplina** (prefijo+color), **Nombre**, **Descripción** (suele
contener **cubicaciones**, ej. "Plataforma P1 · Escarpe 1.741 m³ · Excavación
masiva 3.429 m³"), **Número de Secuencia (PoC)**, fechas, **HH estimadas** (máx
40.000). Estado (En planificación…). Relaciones que muestra la ficha:
- **CWA Padre** (suma de HH de sus CWPs).
- **IWPs** (HH distribuidas / HH por IWP / nº) → "Ver IWPs".
- **EWP Asociado** (documentos asignados).
- **PWPs Asociados**.
- **SWP** (agregar).
- **Actividades de Construcción** (del catálogo, para detallar el alcance).
- **Restricciones** · **Imágenes** · **Estimación IA de HH**.
- **Descargar Ficha PDF** · **Generar Informe CWP**.

### 9.3 Apertura del CWP en IWPs
Botón que **divide** el CWP en N IWPs (HH del CWP repartidas en partes iguales;
ej. 9.200 HH / 10 = 920 HH c/u). Cada IWP nace en estado **Borrador** con código
`IWP-{CWA}-{disc}-{nCWP}-{nIWP}`. Es **reversible** ("Revertir Apertura"). HH
objetivo por IWP es configurable (default 750–1.350).

### 9.4 Pestaña Clasificación (config)
**Tipo de Proyecto** (catálogo, ver 9.6), **Tipo de Contrato** (EPC/EPCM/E/EP/C/PC),
**Sector Industrial**, **Fase** (FEL-2/FEL-3…).

### 9.5 Estimación de HH con IA  ⭐ (esta es la "IA" del producto)
Por **CWA y por CWP** hay un asistente que **estima las HH conversando** (hilo de
mensajes; ej. 13 mensajes → "Resultado: 13.200 HH"). Una conversación es la
"principal", puede haber varias; estado en progreso/completada; botón "Recalcular
con IA" actualiza el valor de HH actuales. Genera reportes de estimación.

### 9.6 Wizard "Nuevo Proyecto" (8 pasos)
1. **Información básica**: código (mayús/números/guiones), nombre, cliente,
   división, contratista, descripción (≤5000).
2. **Clasificación**: **Tipo de Proyecto** (catálogo de ~21: Planta de Proceso
   Minero, Oil&Gas, Química, Energía, Tratamiento de Agua, Mina Cielo
   Abierto/Subterránea, Tranque de Relaves, Carretera, Puente, Puerto, Aeropuerto,
   Metro, Edificio en Altura, Hospital, Centro de Datos, Línea AT/MT, Subestación,
   Trolley…), **Tipo de Contrato** (EPC/EPCM/E/EP/C/PC con su alcance), **Sector**,
   **Fase FEL**.
3. **Ubicación**: país/región/ciudad + **mapa Mapbox** (buscar/arrastrar marcador)
   → **UTM auto** (zona/easting/northing) + **altitud auto (Open-Meteo)**.
4. **Condiciones ambientales**: **riesgo sísmico** (zona/PGA/NCh433) y **datos
   sugeridos por ubicación** (temp, temporada de lluvias, horas luz) con "Aplicar".
5. **Fechas**: inicio/fin planificada + entrega a operaciones.
6. **Presupuesto**: moneda, monto, HH estimadas (+ recomendaciones de contingencia
   y costo HH).
7. **Configuración AWP**: **presets** (Estándar CII / Proyecto Grande >1M HH /
   Pequeño <200K HH); sliders HH máx CWA/CWP, HH objetivo IWP, semanas lookahead;
   **nomenclatura** (modo Guiado/Libre).
8. **Resumen** + "Crear Proyecto".

### 9.7 Nomenclatura de paquetes (config AWP)
Constructor visual por segmentos con separador configurable por posición:
- CWA = `CWA` + correlativo (1–6 díg.) → `CWA-01`
- CWP = `CWP` + [CWA#] + [Disc] + correlativo → `CWP-01-ME-001`
- EWP/PWP = análogo a CWP.
- IWP = `IWP` + [CWA#] + [Disc] + [CWP#] + correlativo → `IWP-01-ME-001-0001`
Cada nivel: incluir/excluir nº CWA, disciplina, nº CWP; nº de dígitos; preview en
vivo. **WBS / Facilities**: importar la estructura WBS desde **Excel/CSV** para
generar códigos de CWA.

## 10. Capturas que aún faltarían (menores)
Con lo enviado el modelo está **~90% mapeado**. Para el 10% restante:
- **Sesión IPS** por dentro (agenda, asistentes, decisiones, action items) — alimenta el Informe PoC.
- **Crear/editar una Restricción** (formulario completo: tipo, responsable, impacto, origen, vínculo a IWP).
- **PWP por dentro** y el **flujo de importar componentes desde el BIM/NWF** (cómo se cargan los `Comp.`).
- **EWP "Asignación masiva"** (cómo se asignan documentos a CWP en lote).
- **Estimación IA** abierta (qué pregunta/responde el asistente).
*(Nada de esto bloquea definir el concepto; son detalles de pantalla.)*
```
