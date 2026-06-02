# Sonqollay → Navisworks (API en vivo)

Trae a Navisworks los datos editados en las planillas de
`https://basesonqollay.synaptechspa.cl/` mediante un plugin .NET que los
descarga por HTTP y los escribe como **propiedades custom** en los elementos
del modelo, vinculando por **TAG**.

## Arquitectura

```
Web Sonqollay (edita planilla)
   │  POST /api/datasets/:key   (botón "Publicar para Navisworks")
   ▼
Backend (Vercel) ── guarda el dataset como JSON en el bucket APS
   ▲
   │  GET /api/datasets/:key    (Authorization: Bearer <SQY_API_TOKEN>)
Plugin Navisworks (.NET)  ── matchea por TAG y escribe propiedades custom
```

- **`key`** = el `dataKey` de la subcategoría/planilla. La web lo muestra al
  publicar (toast: `key: <...>`).
- Los datos NO viven en el servidor hasta que apretás **"Publicar para
  Navisworks"** en la web (ícono de compartir, en la barra de la planilla).

## Endpoints

### `POST /api/datasets/:key` (lo usa la web)
Body JSON: `{ name, tagField, headers: [...], rows: [{col: val, ...}] }`.
Respuesta: `{ ok: true, key, count, url }`.

### `GET /api/datasets/:key` (lo usa el plugin)
Header: `Authorization: Bearer <SQY_API_TOKEN>` (o `?token=<...>`).
Respuesta:
```json
{
  "key": "imp_1717…",
  "name": "SQY_ALU01 (SQYA)",
  "tagField": "TAG/COMMODITY",
  "headers": ["TAG/COMMODITY", "DESCRIPCIÓN_GENERAL", "ESTADO_AVANCE", "..."],
  "rows": [
    { "TAG/COMMODITY": "06940-LUM-001", "ESTADO_AVANCE": "E4", "...": "..." }
  ],
  "count": 97,
  "updatedAt": "2026-06-02T12:34:56.000Z"
}
```

## Configuración del backend

En Vercel → Environment Variables (Production), agregá:

- `SQY_API_TOKEN` = un secreto largo y aleatorio. El plugin debe enviarlo en
  `Authorization: Bearer …` para poder **leer**. Si no se define, la lectura
  queda **abierta** (solo para pruebas — no lo dejes así en producción).

> Nota de seguridad: el `POST` (publicar) queda abierto porque el frontend es
> JS público y no puede guardar un secreto. La `key` no es adivinable
> fácilmente. El control real está en el `GET` (token). Para algo más estricto,
> conviene sumar autenticación de usuario a la app.

## El plugin (.NET)

Ver [`SonqollaySync.cs`](./SonqollaySync.cs). Hace tres cosas:

1. **Descarga** el dataset (`HttpClient` + `System.Text.Json`).
2. **Matchea por TAG**: para cada fila busca los `ModelItem` cuya propiedad de
   vínculo (por defecto la **capa**, p. ej. `06940-LUM-001`) coincide con
   `row[tagField]`. Es el mismo criterio que usa la web.
3. **Escribe** los campos como una pestaña de propiedades custom ("Sonqollay")
   usando el **COM API** (`ComApiBridge` + `InwOpState10.SetUserDefined`), ya
   que el API .NET es de solo lectura para propiedades.

### Compilar
- Proyecto **Class Library (.NET Framework)** — la versión la marca tu
  Navisworks (p. ej. 4.8).
- Referencias (en `C:\Program Files\Autodesk\Navisworks Manage <año>\`):
  - `Autodesk.Navisworks.Api.dll`
  - `Autodesk.Navisworks.ComApi.dll`
  - `Autodesk.Navisworks.Interop.ComApi.dll`
- Copiá el `.dll` compilado a:
  `%PROGRAMDATA%\Autodesk Navisworks Manage <año>\Plugins\SonqollaySync\`
  (o la carpeta `Plugins` de la instalación).

### Configurar el plugin
Editá las constantes al inicio de `SonqollaySync.cs`:
- `BaseUrl` = `https://basesonqollay.synaptechspa.cl`
- `ApiToken` = el mismo valor de `SQY_API_TOKEN`
- `DatasetKey` = la `key` que mostró la web al publicar
- `LinkProperty` = propiedad del modelo que tiene el TAG (por defecto `"Layer"`;
  en tus DWG podría ser la **Capa**).

### Usar
1. En la web: editá la planilla → **"Publicar para Navisworks"** (anotá la `key`).
2. En Navisworks: abrí el modelo → pestaña **Add-ins** → **Sonqollay Sync**.
3. El plugin descarga, matchea y agrega la pestaña **"Sonqollay"** a los
   elementos. **Guardá** como `.nwf`/`.nwd` para persistir las propiedades.

> Los nombres exactos de algunos métodos COM pueden variar según la versión del
> SDK; están señalados con `// TODO verificar` en el código.
