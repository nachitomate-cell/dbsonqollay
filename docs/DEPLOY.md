# Despliegue — Sonqollay (frontend + backend APS)

El **visor 3D real (APS)** necesita el backend (`server/`) accesible por una URL
pública. En el sitio publicado, el frontend NO puede hablar con `localhost:3000`
(eso solo existe en tu PC). Hay que **desplegar el backend** y apuntar el
frontend a su URL con `VITE_APS_API`.

> Síntoma si falta: en la consola del navegador aparece
> `Failed to load .../api/aps/token net::ERR_CONNECTION_REFUSED` y un
> "Failed to fetch" en el visor. El resto de la app (planillas, fichas, 3D
> propio, export) sí funciona sin backend.

## 1. Desplegar el backend (`server/`)

Cualquier host de Node sirve (Render, Railway, Fly.io, un VPS con PM2, etc.).

Pasos genéricos:
1. Subí la carpeta `server/` (o el repo) al host.
2. Configurá las **variables de entorno** (no subas `.env` al repo):
   - `APS_CLIENT_ID`, `APS_CLIENT_SECRET` (de aps.autodesk.com)
   - `APS_BUCKET` (p. ej. `sonqollay-models-2026`)
   - `CLIENT_ORIGIN=https://basesonqollay.synaptechspa.cl` (tu dominio del front)
   - `PORT` (el host suele inyectarlo)
3. Comando de arranque: `npm install && npm start`.
4. Anotá la URL pública resultante, p. ej. `https://sonqollay-api.onrender.com`.

Verificá: abrir `https://TU_BACKEND/api/health` debe devolver `{"ok":true}`.

## 2. Apuntar el frontend al backend

Antes de compilar el frontend, definí la variable:

```
# .env.production (o variable de entorno del build en tu hosting)
VITE_APS_API=https://sonqollay-api.onrender.com
```

Luego `npm run build` y publicá `dist/`.

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
