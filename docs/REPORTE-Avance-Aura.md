# Aura GIP — Estado de la plataforma

> Resumen de lo que ya está funcionando en producción. Todo lo conversado quedó
> implementado y desplegado.

## En una línea

Cada empresa publica sus modelos de Navisworks a la nube **con un clic**, ve sus
datos **aislados de los demás clientes**, con **versionado automático** y un
**registro de quién cambió qué**.

---

## Lo que ya funciona

### 1. Publicar el modelo a la nube — en un clic ✅
Botón **"Publicar a la nube"** dentro de Navisworks (pestaña Aura GIP): exporta
el modelo (NWD, con la geometría embebida del NWF) y lo sube solo. Aparece en la
web a los pocos minutos. Sin pasar por la web, sin servidores extra.

> Es exactamente el flujo que propusiste (plugin propio → subir → traducir →
> visor), resuelto end-to-end.

### 2. Versionado automático ✅
Publicar con el **mismo nombre** crea una **nueva versión** del mismo proyecto
(v1, v2, v3…), no un duplicado. Se puede ver el **historial** y abrir versiones
anteriores. *(Tal cual lo pediste: "cada vez que publica, cambia de versión".)*

### 3. Cada cliente ve SOLO lo suyo ✅
La plataforma es **multi-empresa**: cada empresa tiene sus usuarios, proyectos,
planillas y modelos, **totalmente aislados**. Ninguna empresa ve los datos de
otra. *(Tu requisito: "no se deben ver entre clientes".)*

### 4. Quién cambió qué ✅
**Login con cuenta real** + **registro de modificaciones**: cada edición de una
planilla queda registrada con **quién, cuándo y qué cambió** (filas agregadas /
eliminadas / modificadas). Visible en Configuración → Historial.

### 5. Datos ligados al modelo 3D ✅
Las planillas por disciplina se vinculan al modelo por TAG; el visor 3D resalta
y filtra por paquete de trabajo (AWP/CWP). Detección de TAGs duplicados y
elementos sin TAG.

### 6. Roles y administración ✅
Panel para crear **empresas**, **proyectos** e **invitar usuarios** con su rol
(ver / editar / aprobar / administrar), desde la misma web.

### 7. Entrega del plugin controlada ✅
Cada empresa descarga su instalador **desde la plataforma**, con su acceso
propio. Se puede dar de alta o **revocar** un cliente sin afectar a los demás.

---

## Cómo se ve el flujo completo

```
Cliente edita planillas (web)  ──►  vinculadas por TAG
        │
Navisworks → "Publicar a la nube" (1 clic)
        │
        ▼
Modelo en la nube (nueva versión)  ──►  Visor 3D + datos, aislado por empresa
```

---

## Estado

Todo lo anterior está **implementado y en producción**. La plataforma ya soporta
varios clientes con datos separados, versionado e historial.

Mejoras opcionales que se pueden sumar a pedido: notificaciones, reportes/tableros
de avance, y aprobaciones formales (flujo de revisión por rol).
