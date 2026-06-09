# Aura GIP — Publicación a la nube

> Plan de producto: cómo el cliente publica sus modelos de Navisworks a la nube con un clic, y cómo se vende a varias empresas con datos aislados y versionado automático.

## En una línea

El cliente trabaja en Navisworks como siempre y, con **un solo botón**, su modelo queda actualizado en la web de Aura — sin servidores extra, sin equipos dedicados y sin licencias de Autodesk adicionales.

---

## Cómo funciona (el flujo)

**Para el usuario, es un solo clic:**

1. Trabaja normal en Navisworks (con su NWF).
2. Aprieta el botón **"Publicar a la nube"** del plugin Aura.
3. Listo: el modelo aparece actualizado en Aura, en la web.

**Por detrás (automático, el usuario no lo ve):**

```
Botón "Publicar a la nube"
        |
        v
El plugin genera el NWD  (toma el modelo abierto y lo aplana)
        |
        v
Lo sube al servidor de Aura  (con el token del cliente)
        |
        v
Aura lo procesa para el visor 3D  (Model Derivative -> SVF2)
        |
        v
Queda disponible en la web, como nueva versión del proyecto
```

Corre dentro del Navisworks que el cliente ya tiene: no hace falta una máquina dedicada ni un servicio aparte.

---

## Cómo se vende a varias empresas

La unidad de cliente es la **empresa** (constructora, consultora o minera que contrata Aura). Dentro de cada empresa hay varios usuarios y sus proyectos.

```
Empresa (cliente)  <- la cuenta / suscripción
   |- Varios usuarios  (sus ingenieros, BIM managers, etc.)
   |- Sus proyectos y modelos  (privados de esa empresa)
```

Tres reglas del modelo:

- **Aislamiento total entre clientes.** Cada empresa ve solo lo suyo; ninguna otra empresa ve sus modelos. Datos separados por empresa, sin cruces.
- **Token por empresa.** Cada empresa publica con su propia llave, revocable. Si una llave se filtra o un cliente deja de pagar, se desactiva solo a esa empresa, sin afectar al resto.
- **Versionado automático.** Cada vez que se publica, queda como **nueva versión del mismo proyecto** (v1, v2, v3…), con fecha y posibilidad de volver a una versión anterior. No se duplica el proyecto: es el mismo, actualizado.

> Nota de costos: cada procesamiento de modelo y el almacenamiento se pagan del lado de Aura (plataforma Autodesk). Se contempla dentro del precio de cada plan (p. ej., cantidad de publicaciones/almacenamiento por mes).

---

## Plan por etapas

| Etapa | Qué se entrega | Para qué |
|---|---|---|
| **1. Acceso por cliente** | Descarga del plugin desde Aura + token propio por empresa | Que cada empresa tenga su acceso, revocable y privado |
| **2. Botón "Publicar a la nube"** | El plugin exporta y sube el NWD en un clic | La función estrella: publicar sin tocar la web |
| **3. Versiones + multi-empresa** | Cada empresa ve solo sus proyectos, con historial de versiones | Producto listo para vender a escala |

---

## Por qué este camino (y no otros)

- **Plugin dentro de Navisworks** (no un servicio en un servidor): corre en el equipo que el cliente ya tiene. Escala a muchas empresas sin que Aura ponga infraestructura por cada una.
- **Almacenamiento propio de Aura** (no la gestión documental de Autodesk Construction Cloud): evita obligar a cada cliente a pagar licencias de Autodesk por usuario. Más barato de vender y sin atarse a Autodesk.
- **NWD, no NWF:** el NWD lleva toda la geometría adentro (el NWF solo apunta a archivos externos). Por eso la nube necesita el NWD; el plugin lo genera solo al publicar.

---

## Próximo paso

Arrancar por la **Etapa 1** (acceso + token por empresa), que es la base de todo lo demás. Sobre eso se construye el botón "Publicar a la nube" (Etapa 2) y el aislamiento con versionado (Etapa 3).
