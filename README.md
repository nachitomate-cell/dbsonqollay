# Sonqollay

Plataforma web (SaaS) para la **gestión de proyectos de ingeniería, control
documental y empaquetamiento de trabajo (AWP/BIM)**, orientada a equipos de
ingeniería.

**Doble tema con toggle** (botón sol/luna en el header, persistido en
`localStorage`):

- **Claro** (por defecto) — réplica de la plataforma de referencia: fondo
  blanco, acentos azules, badges de selección verde/ámbar.
- **Premium Dark** — alto contraste, fondos profundos y acentos neón cian.

## Marca

La paleta se extrae del logo de Sonqollay (`logo.png`): **naranja `#F77000`** +
**gris pizarra `#586878`**, definidos como `brand` y `steel` en
`tailwind.config.js`. El logo se usa en el sidebar (`public/logo-mark.png`) y
como favicon (`public/favicon.png`).

## Funcionalidades

- **Dos modos de edición** por subcategoría: **Planilla** (tabla) o **Fichas**
  (tarjetas), conmutables desde la barra de herramientas.
- **Ficha editable**: clic en cualquier registro (fila o tarjeta) abre un panel
  lateral con un campo por columna para editar y guardar; permite crear y
  eliminar registros.
- **Gestor de campos**: agrega, quita u oculta columnas desde la UI.
- **Pestañas múltiples**: abre varias subcategorías a la vez en el espacio de
  grillas (`GridWorkspace`), con cierre individual.
- **Columnas redimensionables**: arrastra el borde derecho de cada encabezado
  (ancho independiente por columna).
- **Virtualización de filas** (`@tanstack/react-virtual`): la grilla rinde miles
  de TAGs sin degradar el rendimiento.
- **Importación de datos**: carga Excel (.xlsx/.xls) o CSV (`SQY_*`) desde la UI;
  se registra como nueva subcategoría y persiste en `localStorage`. `xlsx` se
  importa de forma dinámica (chunk aparte) para no inflar el bundle inicial.
- **Edición persistente**: los cambios de datos, columnas y registros se guardan
  en `localStorage` por dataset (`useEditableDataset`), con opción de
  "Restablecer datos".
- **Doble tema** claro/oscuro con toggle.

## Stack

- **React 18** + **Vite** (build/dev server, code-splitting)
- **Tailwind CSS 3** (temas claro/oscuro, marca en `tailwind.config.js`)
- **lucide-react** (iconografía, con registro explícito para tree-shaking)
- **@tanstack/react-virtual** (virtualización de filas)
- **xlsx** (parseo de Excel, carga dinámica)

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
2. **DisciplineView** (`components/DisciplineView.jsx`) — _Vista A_, en dos
   columnas:
   - **Izquierda:** banner con la descripción de la disciplina, tarjeta
     "Seleccionar todos los elementos de ingeniería" y las tarjetas de cada
     subcategoría con badge de selección (✓ verde / ⚠ ámbar). El badge actúa
     como checkbox para armar un "espacio"; el cuerpo de la tarjeta abre la
     grilla de datos (si hay datos).
   - **Derecha:** panel resumen con "Total de elementos" y el desglose de las
     subcategorías seleccionadas (o "La disciplina seleccionada no tiene
     datos"), más las acciones **Nuevo espacio · Agregar a espacio existente ·
     Limpiar espacio**.
3. **DataTable** (`components/DataTable.jsx`) — _Vista B_, réplica del data grid
   de la plataforma de referencia: enlace "Return To Engineering Element
   Selection", chip del elemento abierto, pestañas **Elements / AWP / Commodity
   Code**, barra de herramientas, búsqueda global, **Order By + Sort**, fila
   **Filter By / Value / Search** con chips de filtros activos, **Property
   Change**, botones **Update AWP / Update Commodity Code Relationship**, barra
   de totales (elementos / seleccionados / eliminados) y tabla dinámica con
   orden y filtro por columna, scroll y encabezado/primera columna fijos.

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
