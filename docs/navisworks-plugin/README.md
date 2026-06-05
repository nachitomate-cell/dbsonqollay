# Aura BIM → Navisworks (API en vivo)

Trae a Navisworks los datos editados en las planillas de
`https://basesonqollay.synaptechspa.cl/` mediante un plugin .NET que los
descarga por HTTP y los escribe como **propiedades custom** en los elementos
del modelo, vinculando por **TAG**.

## Arquitectura

```
Web Aura BIM (edita planilla)
   │  POST /api/datasets/:key   (botón "Publicar para Navisworks")
   ▼
Backend (Vercel) ── guarda el dataset como JSON en el bucket APS
   ▲
   │  GET /api/datasets/:key    (Authorization: Bearer <SQY_API_TOKEN>)
Plugin Navisworks (.NET)  ── matchea por TAG y escribe propiedades custom
```

- **`key`** = el `dataKey` de la subcategoría/planilla. La web lo muestra al
  publicar (toast: `key: <...>`).
- Los datos NO viven en el servidor hasta que pulsas **"Publicar para
  Navisworks"** en la web (ícono de compartir, en la barra de la planilla).

## Endpoints

### `POST /api/datasets/:key` (lo usa la web)
Body JSON: `{ name, tagField, headers: [...], rows: [{col: val, ...}] }`.
Respuesta: `{ ok: true, key, count, url }`.

### `GET /api/datasets` (lo usa el plugin para listar)
Header: `Authorization: Bearer <SQY_API_TOKEN>` (o `?token=<...>`).
Respuesta: `{ datasets: [ { key, name, count, updatedAt } ] }`.
El plugin usa esto para mostrar el cuadro de selección de planillas.

### `GET /api/datasets/:key` (lo usa el plugin para descargar una)
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

En Vercel → Environment Variables (Production), agrega:

- `SQY_API_TOKEN` = un secreto largo y aleatorio. El plugin debe enviarlo en
  `Authorization: Bearer …` para poder **leer**. Si no se define, la lectura
  queda **abierta** (solo para pruebas — no lo dejes así en producción).

> Nota de seguridad: el `POST` (publicar) queda abierto porque el frontend es
> JS público y no puede guardar un secreto. La `key` no es adivinable
> fácilmente. El control real está en el `GET` (token). Para algo más estricto,
> conviene sumar autenticación de usuario a la app.

## El plugin (.NET)

Ver [`AuraBIM.cs`](./AuraBIM.cs). Hace tres cosas:

1. **Descarga** el dataset (`WebClient` + `JavaScriptSerializer`, sin NuGet).
2. **Matchea por TAG**: arma un índice recorriendo los elementos y leyendo la
   propiedad de vínculo (por defecto `BIM` / `TAG/Commodity`, p. ej.
   `06940-BAT-011`) y la compara con `row[tagField]`. Es el mismo criterio que la web.
3. **Escribe** los campos como una pestaña de propiedades custom ("Aura BIM")
   usando el **COM API** (`InwGUIPropertyNode2.SetUserDefined` por elemento), ya
   que el API .NET es de solo lectura para propiedades.

## Distribución a clientes (lo simple)

El cliente **no** compila ni edita nada. Recibe un `.zip` y hace **1 clic**.

### A) Tú: compilar y empaquetar (una sola vez)
1. **Compila** el DLL (PC con Navisworks 2024-2026 + Visual Studio 2022,
   .NET Framework 4.8 x64):
   ```powershell
   dotnet build AuraBIM.csproj -c Release
   # si Navisworks está en otra ruta:
   #   ... -p:NavisworksPath="D:\Program Files\Autodesk\Navisworks Manage 2026\"
   ```
2. **Pon el token**: copia [`instalador/AuraBIM.config.example.json`](./instalador/AuraBIM.config.example.json)
   a `instalador/AuraBIM.config.json` y completa `apiToken` (= el mismo valor
   de `SQY_API_TOKEN` de Vercel). Ese `.json` con el token **está gitignored**: no va
   al repo. (En CI no hace falta: el workflow inyecta el secret sobre el `.example`.)
3. **Empaqueta**: clic derecho en `Empaquetar.ps1` → *Ejecutar con PowerShell*
   (o `powershell -ExecutionPolicy Bypass -File Empaquetar.ps1`).
   Genera **`AuraBIM-instalador.zip`** listo para enviar.

### B) El cliente: instalar (1 clic)
1. Descomprime el `.zip`.
2. Doble clic en **`Instalar.bat`** (copia el plugin a la carpeta de Navisworks
   de su usuario — detecta Manage/Simulate 2024-2026, sin permisos de admin).
3. Abre Navisworks → pestaña **Aura BIM** → botón **Asignar Propiedades**.

> La configuración (URL + token + propiedad de vínculo) vive en
> **`AuraBIM.config.json`** junto al DLL (gitignored; en el repo solo está el
> `.example`). Para cambiar el token **no hace falta recompilar**: editas el `.json`
> y reempaquetas (o se lo reemplazas al cliente en su carpeta de plugins).

> **Vínculo por TAG**: el plugin matchea `linkCategory`/`linkProperty` (por
> defecto `BIM` / `TAG/Commodity`) contra el TAG de la planilla. El **valor** del
> TAG debe coincidir entre planilla y modelo (misma numeración, p. ej. `06940-`).

> La planilla a sincronizar se elige al ejecutar (no se configura): el mismo DLL
> sirve para todas.

## Publicar online (link estable + botón en la web)

En vez de mandar el `.zip` por mano, se puede publicar en **GitHub Releases** y
que el cliente lo baje siempre del mismo link (o desde el botón **"Descargar
plugin Navisworks"** en Configuración de la web).

**Link estable (latest):**
`https://github.com/nachitomate-cell/dbsonqollay/releases/latest/download/AuraBIM-instalador.zip`

### Automático (GitHub Actions)
El workflow [`.github/workflows/plugin-release.yml`](../../.github/workflows/plugin-release.yml)
compila el plugin **en la nube** (sin Navisworks, vía paquetes NuGet) y publica
el `.zip` en una Release.

Configuración (una vez):
1. En GitHub → **Settings → Secrets and variables → Actions → New repository
   secret**: nombre `SQY_API_TOKEN`, valor = tu token. Se inyecta en el config
   del instalador (no queda en el repo).
2. Para publicar una versión, pusheá un tag:
   ```bash
   git tag plugin-v1.0
   git push origin plugin-v1.0
   ```
   El workflow compila, arma el zip y crea la Release. El link *latest* y el
   botón de la web pasan a apuntar a esa versión.

### Manual (respaldo)
Si prefieres no usar CI: ejecuta `Empaquetar.ps1` localmente y **sube el
`AuraBIM-instalador.zip` a una Release** a mano (GitHub → Releases → Draft
a new release → adjunta el zip con **ese mismo nombre**). El link *latest* y el
botón funcionan igual.

> El botón de la web da 404 hasta que exista la **primera** Release con el asset
> `AuraBIM-instalador.zip`.

### Usar
1. En la web: edita cada planilla → **"Publicar para Navisworks"** (una vez por
   planilla; al re-editar, vuelves a publicar y se sobrescribe).
2. En Navisworks: abre el modelo → pestaña **Aura BIM** → botón **Asignar Propiedades**.
3. Aparece la **lista de planillas publicadas** con checkboxes → marca las que
   quieras (vienen todas marcadas) → **Sincronizar**.
4. El plugin descarga las elegidas, matchea por TAG y agrega la pestaña
   **"Aura BIM"** a los elementos. **Guarda** como `.nwf`/`.nwd` para persistir.

> No hace falta recompilar para cambiar de planilla ni cuando cambia su `key`:
> el plugin siempre lista lo que haya publicado.
