# Distribución del plugin Aura BIM (Etapa 1)

Cómo se descarga el plugin **desde el backend de Aura** (no desde un link público
de GitHub), para que el repositorio pueda ser **privado** y cada **empresa**
baje su instalador con **su propio token** (revocable, aislado).

## Cómo funciona

```
Botón "Descargar plugin"  (web Aura, con ?key=<empresa>)
        │
        ▼
GET /api/plugin/download   (función Vercel)
        │
        ├─ busca la empresa por su key en PLUGIN_CLIENTS
        ├─ baja el ZIP plantilla de la última GitHub Release (repo privado, vía GITHUB_TOKEN)
        ├─ inyecta el token de esa empresa en AuraBIM.config.json
        ▼
Instalador personalizado  (AuraBIM-<empresa>.zip)
```

El token inyectado es el que el plugin envía al backend para leer datasets
(`Authorization: Bearer <token>`). El backend acepta el token compartido
(`SQY_API_TOKEN`) **o** el de cualquier empresa activa del registro.

## Variables de entorno (en Vercel → Settings → Environment Variables)

| Variable | Para qué |
|---|---|
| `GITHUB_TOKEN` | PAT con lectura del repo privado (Contents: read). El backend baja la Release con esto. |
| `PLUGIN_REPO` | `owner/repo` (def: `nachitomate-cell/dbsonqollay`). |
| `PLUGIN_ASSET` | Nombre del asset (def: `AuraBIM-instalador.zip`). |
| `PLUGIN_CLIENTS` | Registro de empresas en JSON (ver abajo). |
| `PLUGIN_DEFAULT_TOKEN` | Token a inyectar si se descarga **sin** `key` (despliegue de un solo cliente). Si falta, usa `SQY_API_TOKEN`. |

## Dar de alta una empresa

1. Generá su entrada con el helper:

   ```bash
   node scripts/new-client.mjs "ACME Construcciones SpA"
   ```

   Imprime algo como:

   ```json
   { "id": "acme-construcciones-spa", "name": "ACME Construcciones SpA",
     "key": "dl_3f9a…", "token": "tok_8c21…", "active": true }
   ```

2. Agregá esa entrada al array de `PLUGIN_CLIENTS` en Vercel (todo en una línea).
3. La empresa descarga desde `…/api/plugin/download?key=dl_3f9a…`.
   (Cuando esté el login —Etapa 3— la `key` se completa sola con la empresa logueada.)

## Revocar / desactivar una empresa

Poné `"active": false` en su entrada de `PLUGIN_CLIENTS` (o cambiale el `token`).
Deja de poder descargar y su token deja de autenticar — sin afectar al resto.

## Hacer el repo privado

Una vez que la web descarga desde el backend, el repo de GitHub puede pasar a
privado. La GitHub Action `plugin-release.yml` sigue publicando la Release
(usa el `GITHUB_TOKEN` interno del repo); el backend la baja con el PAT.

> Pendiente Etapa 3: aislamiento de datos por empresa (bucket/prefijo propio) y
> login para no pasar la `key` a mano. Esto solo cubre la **descarga** y el
> **token por empresa**.
