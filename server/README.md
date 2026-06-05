# Sonqollay — Backend APS (Autodesk Platform Services)

Backend mínimo para visualizar **modelos reales** (NWD de Navisworks, RVT, IFC,
etc.) en Sonqollay usando el **APS Viewer**. Mantiene el `Client Secret` fuera
del navegador y se encarga de subir y traducir los modelos.

## Puesta en marcha (en tu PC)

```bash
cd server
cp .env.example .env        # pega tus llaves reales de aps.autodesk.com
npm install
npm start                   # http://localhost:3000
```

En otra terminal, la app:

```bash
npm install
npm run dev                 # http://localhost:5173
```

En la app: abre una subcategoría → vista **3D** → botón **"APS (real)"** →
**"Subir modelo"**. El archivo se sube a Autodesk, se traduce y se muestra.

## Variables (.env)

| Variable | Qué es |
|----------|--------|
| `APS_CLIENT_ID` | Client ID de tu app APS |
| `APS_CLIENT_SECRET` | Client Secret (¡privado!, nunca al frontend ni a git) |
| `APS_BUCKET` | Nombre del bucket OSS (minúsculas, único global; se crea solo) |
| `PORT` | Puerto del backend (3000, coincide con la Callback URL) |
| `CLIENT_ORIGIN` | Origen del frontend para CORS (http://localhost:5173) |

> El `.env` está en `.gitignore`. **Nunca** lo subas al repositorio.

## Endpoints

| Método | Ruta | Función |
|--------|------|---------|
| `GET`  | `/api/aps/token` | Token de solo lectura para el visor (`viewables:read`) |
| `POST` | `/api/aps/models` | Sube un modelo (multipart `file`) y lanza la traducción |
| `GET`  | `/api/aps/models` | Lista los modelos del bucket (proyectos, visibles en cualquier dispositivo) |
| `GET`  | `/api/aps/models/:urn/status` | Estado de la traducción |
| `GET`  | `/api/health` | Healthcheck |

## Requisito Navisworks (NWD)

El NWD debe estar **publicado** desde Navisworks (Salida → NWD) con la opción
**"Se puede volver a guardar"** activada, no solo guardado.

## Notas

- La traducción de modelos grandes puede tardar varios minutos (el visor
  reintenta solo hasta que esté lista).
- El SDK del visor se carga desde el CDN de Autodesk; no se empaqueta en la app.
- El frontend toma la URL del backend de `VITE_APS_API` (por defecto
  `http://localhost:3000`).
