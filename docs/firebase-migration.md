# Migración a Firebase (Firestore) — plan

> Estado actual: los datos de las planillas viven en el **navegador**
> (localStorage). Funciona para **un** usuario/PC. Cuando entre un **segundo**
> usuario o una segunda máquina, conviene mover los datos a una base central.
> Este documento es ese plan. **No hace falta ejecutarlo todavía.**

## Qué se gana
- **Datos compartidos**: todos ven y editan la misma planilla (una fuente de verdad).
- **Login real** (Firebase Auth) → de paso asegura el `POST /api/datasets/:key`.
- **Sync a Navisworks casi automático**: el plugin lee del mismo lugar; se puede
  eliminar el paso manual "Publicar".

## El seam ya está preparado
Todo el acceso a los datos editables pasa por un único módulo:
**`src/utils/datastore.js`** (`loadWorking` / `saveWorking` / `removeWorking`).
Hoy usa localStorage. Para migrar, se reescribe **solo ese archivo**; los hooks
y componentes no cambian su lógica (sí pasan a tratar las funciones como
`async` — ver más abajo).

## Datos a migrar vs. lo que queda local
| Clave localStorage | Qué es | ¿Migrar? |
|---|---|---|
| `sqy-ds-<dataKey>` | **Planilla editada** (columns + rows) | ✅ sí (vía datastore) |
| `sqy-created-sheets-v2` | Planillas nuevas creadas por el usuario | ✅ sí |
| registro de `useImportedDatasets` | Datasets importados (CSV/Excel) + subcategorías | ✅ sí |
| notas de `BimViewer` (`notesKey`) | Notas por subcategoría | ✅ opcional |
| `sqy-w-<dataKey>` (anchos de columna), `sqy-3d-engine`, etc. | **Preferencias de UI** | ❌ quedan locales |

## Modelo de datos en Firestore
```
datasets (colección)
  <dataKey> (documento)
    name: string
    tagField: string
    columns: [{ key, visible }]
    rows: [{ _id, <col>: <val>, ... }]
    updatedAt: timestamp
    updatedBy: string (uid)
```
> Firestore limita cada documento a 1 MB. Una planilla de cientos de filas entra
> sin problema. Si alguna creciera muchísimo, se pasa `rows` a una subcolección.

## Pasos de implementación

### 1) Crear el proyecto
- console.firebase.google.com → nuevo proyecto → habilitar **Firestore** y
  **Authentication** (Email/Password o Google).
- Copiar la config web (apiKey, projectId, etc.).

### 2) Frontend
```bash
npm i firebase
```
- `src/lib/firebase.js`: inicializa la app con la config (las keys web de
  Firebase NO son secretas; la seguridad la dan las **reglas**).
- Reescribir `src/utils/datastore.js` para usar Firestore:
  ```js
  import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
  import { db } from '../lib/firebase'

  export async function loadWorking(dataKey) {
    const snap = await getDoc(doc(db, 'datasets', dataKey))
    return snap.exists() ? snap.data() : null
  }
  export async function saveWorking(dataKey, state) {
    await setDoc(doc(db, 'datasets', dataKey), { ...state, updatedAt: serverTimestamp() })
  }
  export async function removeWorking(dataKey) {
    await deleteDoc(doc(db, 'datasets', dataKey))
  }
  ```
- Ajustar los **3 call sites** (ya centralizados) para `await`:
  - `src/hooks/useEditableDataset.js` (`init` y el guardado en el `useEffect`
    pasan a async; cargar dentro de un `useEffect` con `setState`).
  - `src/utils/projectExport.js` (`resolveWorking` pasa a `await`).
  Es un cambio chico porque ya hay un solo punto de entrada.

### 3) Reglas de seguridad (Firestore)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /datasets/{dataKey} {
      allow read, write: if request.auth != null;   // solo usuarios logueados
    }
  }
}
```

### 4) Backend / plugin (queda casi igual)
El plugin de Navisworks **no cambia**: sigue haciendo `GET /api/datasets/:key`.
Solo se cambia la implementación del endpoint para que lea de Firestore:
- `api/datasets/[key].js`: en vez de `readJsonObject` (bucket), leer el documento
  con el **Firebase Admin SDK** (`firebase-admin`, usando un service account en
  variables de entorno de Vercel) y devolver el mismo JSON plano
  `{ key, name, tagField, headers, rows }`.
- Así el plugin sigue **sin dependencias** y con JSON limpio (no el formato REST
  de Firestore con `{stringValue: ...}`).
- El `POST` se puede **eliminar** (la web escribe directo en Firestore) o
  mantener para compatibilidad.

### 5) Migrar los datos existentes (una vez)
Script puntual: leer las claves `sqy-ds-*` del navegador del usuario actual y
hacer `saveWorking` de cada una hacia Firestore. O reimportar los Excel base.

## Esfuerzo estimado
- Setup Firebase + reglas: ~0,5 día.
- Reescribir `datastore.js` + async en los 3 call sites: ~0,5–1 día.
- Auth (login) en la web: ~0,5–1 día.
- Endpoint con Admin SDK: ~0,5 día.

**Total ~2–3 días**, sin reescribir la UI. El seam (`datastore.js`) es lo que
mantiene el cambio acotado.

## Alternativa: Supabase (Postgres)
Mismo plan, cambia el motor: tabla `datasets(data_key pk, name, tag_field,
columns jsonb, rows jsonb, updated_at)`, Row Level Security para el equivalente
a las reglas, y `@supabase/supabase-js` en `datastore.js`. Elegir según si
preferís NoSQL (Firestore) o SQL (Supabase).
