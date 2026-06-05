# Despliegue — Sonqollay (frontend + backend APS)

El **visor 3D real (APS)** necesita el backend (`server/`) accesible por una URL
pública. En el sitio publicado, el frontend NO puede hablar con `localhost:3000`
(eso solo existe en tu PC). Hay que **desplegar el backend** y apuntar el
frontend a su URL con `VITE_APS_API`.

> Síntoma si falta: en la consola del navegador aparece
> `Failed to load .../api/aps/token net::ERR_CONNECTION_REFUSED` y un
> "Failed to fetch" en el visor. El resto de la app (planillas, fichas, 3D
> propio, export) sí funciona sin backend.

## Despliegue en Vercel (recomendado si ya usas Vercel)

El backend está implementado **también** como **funciones serverless** en `api/`,
así que Vercel sirve el frontend y la API en el **mismo dominio**, sin servidor
aparte. No hace falta `VITE_APS_API` (mismo origen).

Pasos:
1. En el proyecto de Vercel, agrega las **Environment Variables**:
   - `APS_CLIENT_ID`, `APS_CLIENT_SECRET` (de aps.autodesk.com)
   - `APS_BUCKET` (p. ej. `sonqollay-models-2026`)
2. Deploy (Vercel detecta `vercel.json`, build con Vite, funciones en `/api`).
3. Verifica `https://TU_DOMINIO/api/aps/token` → debe devolver un `access_token`.

Endpoints (funciones): `GET /api/aps/token`, `GET /api/aps/models`,
`POST /api/aps/upload-url`, `POST /api/aps/complete`, `GET /api/aps/status/:urn`.

> La subida del modelo (NWD 55 MB) **no pasa por la función** (Vercel limita el
> payload a ~4.5 MB): el navegador pide una URL firmada (`/api/aps/upload-url`)
> y sube el archivo **directo a Autodesk (S3)**; luego `/api/aps/complete`
> confirma y lanza la traducción. Por eso funciona pese al tamaño.

> ⚠️ **Si `/api/aps/token` devuelve `200` con HTML (el `index.html`) en vez de
> JSON:** la reescritura SPA estaba capturando `/api/*` y sirviendo el app shell.
> En `vercel.json` la regla de `rewrites` **excluye** `/api/` con
> `"source": "/((?!api/).*)"`, de modo que `/api/*` siempre se enruta a las
> funciones serverless (nunca a `index.html`). Si una función falta o falla,
> verás `404`/`500` con JSON claro, no HTML. Tras cambiar variables de entorno
> en Vercel hay que **volver a desplegar** para que tomen efecto.

---

## ⚠️ Causa del 404 en `/api/*`

Si el sitio está en un **hosting estático** (solo sirve archivos: Netlify, Vercel
estático, cPanel, S3, Nginx sirviendo `dist/`…), las rutas `/api/*` devuelven
**404** porque ahí **no corre Node**. La app (planillas, 3D propio, export) sí
funciona, pero el **visor APS no**, porque necesita el backend.

Solución: el sitio debe ser servido por el **proceso Node** (`server/index.js`),
que sirve el frontend **y** la API. Usa una de estas opciones.

## Opción A (recomendada): un solo despliegue

El backend ya sirve el frontend compilado. Es lo más simple: misma URL, sin
CORS ni contenido mixto, y `VITE_APS_API` puede quedar vacío (mismo origen).

### A.1 — Docker (cualquier host con contenedores)

```bash
docker build -t sonqollay .
docker run -p 3000:3000 --env-file server/.env sonqollay
```

### A.2 — Render (incluye `render.yaml`)

1. Conecta el repo en Render → "New Web Service" (detecta `render.yaml`).
2. Carga las variables secretas `APS_CLIENT_ID` y `APS_CLIENT_SECRET`.
3. Deploy. Verifica `https://TU_SERVICIO.onrender.com/api/health`.

### A.3 — VPS / manual

```bash
npm install && npm run build        # genera dist/
cd server
cp .env.example .env                # pega tus credenciales APS
npm install && npm start            # sirve dist/ + API en el puerto 3000
```

(Con un VPS, pon Nginx como proxy inverso a ese puerto y PM2 para mantenerlo vivo.)

## Opción B: frontend y backend separados

## 1. Desplegar el backend (`server/`)

Cualquier host de Node sirve (Render, Railway, Fly.io, un VPS con PM2, etc.).

Pasos genéricos:
1. Sube la carpeta `server/` (o el repo) al host.
2. Configura las **variables de entorno** (no subas `.env` al repo):
   - `APS_CLIENT_ID`, `APS_CLIENT_SECRET` (de aps.autodesk.com)
   - `APS_BUCKET` (p. ej. `sonqollay-models-2026`)
   - `CLIENT_ORIGIN=https://basesonqollay.synaptechspa.cl` (tu dominio del front)
   - `PORT` (el host suele inyectarlo)
3. Comando de arranque: `npm install && npm start`.
4. Anota la URL pública resultante, p. ej. `https://sonqollay-api.onrender.com`.

Verifica: abrir `https://TU_BACKEND/api/health` debe devolver `{"ok":true}`.

## 2. Apuntar el frontend al backend

Antes de compilar el frontend, define la variable:

```
# .env.production (o variable de entorno del build en tu hosting)
VITE_APS_API=https://sonqollay-api.onrender.com
```

Luego `npm run build` y publica `dist/`.

> Importante: el backend debe ir por **HTTPS** (igual que el front) para evitar
> bloqueo de contenido mixto, y `CLIENT_ORIGIN` debe incluir el dominio del
> front para que CORS lo permita.

## 3. Checklist

- [ ] `GET https://TU_BACKEND/api/health` → `{ ok: true }`
- [ ] `CLIENT_ORIGIN` = dominio del frontend
- [ ] `VITE_APS_API` configurado en el build del frontend
- [ ] Backend y frontend ambos en HTTPS

Hecho esto, el visor APS, la subida de modelos y los "Proyectos" funcionan
desde el sitio publicado y desde cualquier dispositivo.
