# AURA GIP — Gestor de Información de Proyectos
## Alcances del servicio (base para el SLA)

> **Documento borrador.** Define el alcance funcional y los niveles de servicio
> de AURA GIP. Los valores entre corchetes `[ ]` son decisiones comerciales a
> confirmar (porcentajes de disponibilidad, horarios y tiempos de soporte,
> retención de respaldos, etc.). Última actualización: **2026-06-07**.

### Estado de cada componente
- ✅ **Operativo** — implementado y en uso; se puede comprometer en el SLA.
- 🟡 **En desarrollo** — parcialmente implementado; comprometer con plazo, no como entregado.
- 🔴 **Fase futura** — no implementado; incluir solo como hoja de ruta, no como alcance vigente.

---

## 1. Definiciones

- **AURA GIP**: plataforma web de gestión de información de proyectos de ingeniería,
  con foco en **AWP** (Advanced Work Packaging) y **BIM**.
- **Organización**: empresa cliente. Puede tener uno o más proyectos.
- **Proyecto**: instancia de trabajo (ej. *Planta Servicios Auxiliares*) con sus
  disciplinas y planillas.
- **Disciplina**: agrupación de ingeniería (Eléctrico, Mecánica, Cañerías, Civil,
  Estructura, Arquitectura, Instrumentación, General, Sustentabilidad).
- **Planilla**: tabla de elementos de una disciplina (TAG/Commodity + atributos).
- **TAG / Commodity**: identificador único del componente; vincula la planilla con
  el modelo 3D.
- **CWA / CWP**: Construction Work Area / Construction Work Package (AWP).
- **Componente / elemento**: ítem de ingeniería (una fila de la planilla).

---

## 2. Alcance funcional

### 2.1 Acceso, organización y proyecto
- ✅ Autenticación de usuarios (correo + contraseña).
- ✅ Sesión de demostración para evaluación.
- ✅ Flujo de trabajo **Organización → Proyecto** (un usuario opera sobre el
  proyecto que selecciona).
- ✅ Estructura del proyecto por **disciplinas** y **planillas**.
- 🟡 Administración real de **organizaciones y proyectos** desde la base de datos
  (hoy la autenticación es real; la lista de organizaciones/proyectos se está
  migrando del modo local al servidor).
- 🟡 **Roles y permisos** por organización (viewer / editor / approver / admin):
  modelo de datos creado; aplicación efectiva en la interfaz en desarrollo.

### 2.2 Gestión de información de ingeniería (núcleo del GIP)
- ✅ Carga de planillas por **importación de Excel / CSV**.
- ✅ **Edición en línea** de celdas, con **deshacer / rehacer**.
- ✅ **Autoguardado en la nube**; los datos se recuperan en cualquier equipo al
  reabrir el proyecto.
- ✅ **Columnas configurables** (mostrar/ocultar, reordenar, crear), densidad de
  vista (cómodo / compacto), ordenamiento y filtros.
- ✅ **Exportación** de la información a **Excel / CSV**.
- ✅ Vista **"Todas las disciplinas"**: tabla unificada del proyecto, búsqueda
  global.
- ✅ **Control de calidad de datos**: detección de **TAGs duplicados** (cruce de
  disciplinas) y **elementos sin TAG**.
- ✅ Creación de **disciplinas y planillas nuevas** por el usuario.

### 2.3 AWP — Advanced Work Packaging
- ✅ **Importación de CWPs** desde el export del sistema AWP (CSV).
- ✅ **Asociación de componentes a CWA/CWP**, desde la planilla y desde el modelo 3D.
- ✅ **Cobertura de paquetización** por CWP (componentes asignados / sin asignar).
- ✅ **% de avance por CWP** (a partir de los estados E1–E4) y **avance global del
  proyecto** ponderado por horas-hombre (HH).
- ✅ Filtro de la información por CWP.

### 2.4 BIM — Modelo 3D
- ✅ **Visor 3D** integrado (Autodesk Platform Services).
- ✅ **Vínculo bidireccional** planilla ↔ modelo: seleccionar una fila resalta el
  elemento, y viceversa.
- ✅ **Coloreado / aislamiento por CWP** y **mapa de calor de avance** (E1–E4)
  sobre el modelo.
- ✅ **Edición múltiple** de elementos seleccionados en el modelo.
- ✅ **Asociación a AWP** desde el modelo 3D.

### 2.5 Integración con Autodesk Navisworks
- ✅ **Plugin "Aura GIP"** para Navisworks (2024–2026; preparado para 2027): trae
  los datos publicados en AURA GIP y los **escribe como propiedades BIM** en los
  elementos del modelo, vinculando por TAG.
- ✅ Selección de qué planillas sincronizar; registro de sincronización para
  soporte.
- ✅ Distribución del plugin mediante instalador y enlace de descarga estable.

### 2.6 Persistencia y disponibilidad de la información
- ✅ Información almacenada en **base de datos en la nube** (PostgreSQL / Supabase).
- ✅ Acceso vía web (PWA instalable, uso offline básico de la interfaz).
- 🟡 **Aislamiento de datos por proyecto** a nivel de base de datos (en curso).

### 2.7 Fase futura (hoja de ruta — NO incluido en el alcance vigente)
- 🔴 **Cronograma / Gantt** y **simulación 4D** (TimeLiner) a partir de fechas de CWP.
- 🔴 **Conjuntos de selección (Search/Selection Sets)** por CWP/disciplina en Navisworks.
- 🔴 **Reportes y tableros ejecutivos** (dashboards de avance, KPIs).
- 🔴 **Asistencia con IA**.
- 🔴 **Control documental** formal (versionado de documentos, transmittals).
- 🔴 **Conexión directa con la API del sistema AWP** (hoy el intercambio es por CSV).

---

## 3. Niveles de servicio

> Valores a confirmar con el cliente. Se proponen referencias.

### 3.1 Disponibilidad
- Plataforma alojada en **Vercel** (aplicación) y **Supabase** (datos), con
  redundancia del proveedor.
- Disponibilidad objetivo: **[99,0 %] mensual**, excluyendo ventanas de
  mantenimiento informadas y causas de fuerza mayor / fallas de terceros
  (Autodesk APS, proveedores de nube).

### 3.2 Soporte
- Canal de soporte: **[correo / WhatsApp / portal]**.
- Horario de atención: **[L–V, 9:00–18:00 CLT]**.
- Tiempos de respuesta objetivo por severidad:
  - **Crítica** (plataforma caída / pérdida de datos): **[4 h hábiles]**.
  - **Alta** (función clave inoperante): **[1 día hábil]**.
  - **Media / baja** (consultas, mejoras menores): **[3 días hábiles]**.

### 3.3 Respaldos y recuperación
- Respaldos de la base de datos: **[diarios]**, con retención de **[30 días]**.
- Objetivo de recuperación (RPO/RTO): **[RPO 24 h / RTO 8 h]**.

### 3.4 Seguridad y privacidad
- Acceso mediante **autenticación de usuario**.
- Comunicación **cifrada en tránsito (HTTPS/TLS)**.
- Control de acceso por **organización** (y por **rol**, en implementación).
- 🟡 Endurecimiento pendiente: control de acceso en la **publicación de datos**
  hacia el modelo y **aislamiento estricto por proyecto** (en curso).

### 3.5 Propiedad y portabilidad de los datos
- Los datos del proyecto son **propiedad del cliente**.
- El cliente puede **exportar toda su información** a Excel/CSV en cualquier momento.

### 3.6 Roles y permisos
- Modelo de roles: **viewer** (lectura), **editor** (edición), **approver**
  (aprobación), **admin** (administración de la organización).
- Estado: modelo definido en la base de datos; aplicación en la interfaz **en
  desarrollo**.

---

## 4. Supuestos y dependencias
- El cliente provee la información de ingeniería (planillas) y los **modelos 3D**
  (formatos compatibles con Autodesk APS / Navisworks).
- La numeración de **TAG** es consistente entre planilla y modelo (es la clave de
  vínculo BIM).
- La integración con Navisworks requiere **Navisworks Manage/Simulate** instalado
  en el equipo del cliente y la instalación del plugin.
- Dependencia de servicios de terceros: **Autodesk Platform Services**, **Vercel**,
  **Supabase**.

## 5. Exclusiones
- No incluye los componentes marcados como **🔴 Fase futura** (sección 2.7) salvo
  acuerdo y planificación específica.
- No incluye **modelado 3D** ni **levantamiento de información** (el cliente aporta
  modelos y datos).
- No incluye **licencias de Autodesk** (Navisworks, etc.), que son del cliente.

---

## 6. Hoja de ruta (referencial)
1. Multi-tenant real (organizaciones/proyectos desde la base) + aislamiento por
   proyecto + roles efectivos.
2. Endurecimiento de seguridad de la publicación de datos.
3. Conjuntos de selección por CWP y **TimeLiner 4D** en Navisworks.
4. Reportes / tableros de avance.
5. Conexión directa con la API del sistema AWP.

---

> *Documento preparado como base técnica para el SLA de AURA GIP. Ajustar el
> lenguaje legal, los valores de servicio y el formato a la plantilla contractual
> del cliente.*
