# Sonqollay

Plataforma web (SaaS) para la **gestión de proyectos de ingeniería, control
documental y empaquetamiento de trabajo (AWP/BIM)**. Estética _Premium Dark_,
alto contraste y acentos neón cian, orientada a equipos de ingeniería.

## Stack

- **React 18** + **Vite** (build/dev server)
- **Tailwind CSS 3** (tema oscuro personalizado en `tailwind.config.js`)
- **lucide-react** (iconografía)

## Puesta en marcha

```bash
npm install
npm run dev      # servidor de desarrollo (http://localhost:5173)
npm run build    # build de producción a /dist
npm run preview  # previsualizar el build
```

## Estructura de navegación (simulada, sin router)

El estado de navegación vive en `src/App.jsx`:

```
Sidebar (disciplina)  →  DisciplineView (tarjetas)  →  DataTable (grilla)
   activeDiscipline           activeSub = null              activeSub = <id>
```

1. **Sidebar** (`components/Sidebar.jsx`) — menú lateral colapsable con las 9
   disciplinas. Al seleccionar una, se actualiza `activeDiscipline`.
2. **DisciplineView** (`components/DisciplineView.jsx`) — _Vista A_. Tarjetas de
   subcategorías (ícono, título, descripción y badge "Total de elementos").
   Las subcategorías sin datos quedan deshabilitadas.
3. **DataTable** (`components/DataTable.jsx`) — _Vista B_. Grilla de datos de
   ingeniería con búsqueda global, filtros por columna, ordenamiento,
   selección con checkbox, acciones `Update AWP Relationship` /
   `Update Commodity Code`, y scroll horizontal/vertical con encabezado y
   primera columna fijos (sticky).

`Header.jsx` muestra breadcrumbs clicables, búsqueda global y acciones rápidas.

## Datos

Los datos reales provienen de los Excel de ingeniería (`SQY_*`) y se cargan
desde `src/data/engineering.json`:

| Dataset | Disciplina → Subcategoría        | Elementos |
| ------- | -------------------------------- | --------- |
| `alu`   | Eléctrico → Alumbrado (ALU)      | 97        |
| `hor`   | Estructura → Hormigón (HOR)      | 192       |
| `mec`   | Mecánica → Equipos Mecánicos     | 115       |

Además, `src/data/mock.js` aporta un dataset de demostración para
**Eléctrico → Equipos (ELE)** con las columnas del modelo solicitado
(`TAG`, `DESCRIPCIÓN`, `FACILITIES`, `COMMODITY`, `ESPECIALIDAD`, `COSTO_US`,
`CWP`, `CWA`, `ESTADO_DE_APROBACION`, `PESO_KG`).

La tabla es **dinámica**: se adapta automáticamente a las columnas del dataset
activo, detecta columnas categóricas para los filtros y formatea costos, pesos
y estados de aprobación.

### Mapeo / definición de disciplinas

`src/data/disciplines.js` define las 9 disciplinas, sus subcategorías, íconos y
el `dataKey` que enlaza cada subcategoría con su dataset.

## Próximos pasos sugeridos

- Reemplazar la tabla nativa por **TanStack Table** o **ag-Grid** para
  virtualización de filas, filtros por columna avanzados y _freeze panes_
  (necesario al manejar miles de TAGs).
- Hook de carga de datos para ingerir nuevos Excel/CSV (`SQY_*`) como JSON.
- Persistencia (backend/API) y autenticación.
