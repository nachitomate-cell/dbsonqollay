# Aura GIP — Onboarding de un cliente nuevo

> Paso a paso para dar de alta una empresa nueva: crear su acceso, aislar sus
> datos, entregarle el plugin y dejarla publicando modelos. Marca quién hace cada
> cosa (**Tú/Aura** vs **el Cliente**) y dónde.

## Resumen del flujo

```
1. Crear usuario        (Supabase)        ─┐
2. Crear empresa        (web · Admin)      │  Lo haces tú (Aura)
3. Invitar usuario      (web · Admin)      │
4. Crear proyecto       (web · Admin)     ─┘
5. Token del plugin     (Vercel)          ─── Lo haces tú (Aura)
        │
        ▼
6. Descargar e instalar plugin   (Cliente, desde la web)
7. Cargar/editar planillas        (Cliente)        ─── aisladas en su proyecto
8. Publicar modelo a la nube      (Cliente, plugin)
```

---

## Parte A — Lo que haces tú (Aura) para habilitar al cliente

### 1. Crear el usuario del cliente
En **Supabase → Authentication → Users → Add user**:
- **Email** del cliente + una **contraseña** provisoria.
- ✅ Marca **"Auto Confirm User"** (entra sin verificar correo).
- Pásale email + contraseña (que la cambie después).

*(Alternativa: que se registre solo desde "¿No tienes cuenta? Regístrate".)*

### 2. Crear la empresa
En la web → **Configuración → Administración → "Empresas, proyectos y usuarios"**:
- Escribe el nombre de la empresa → **crear**. Quedas como **admin**.

### 3. Invitar al usuario del cliente a la empresa
En el mismo panel, con la empresa seleccionada → **Miembros**:
- Email del cliente + **rol** (`admin` / `editor` / `approver` / `viewer`) → **agregar**.
- *(El usuario debe existir — paso 1.)*

**Roles:**
| Rol | Puede |
|---|---|
| viewer | Ver |
| editor | Ver + editar planillas + crear proyectos |
| approver | Ver + aprobar (flujo de revisión) |
| admin | Todo + administrar miembros |

### 4. Crear el/los proyecto(s) de la empresa
En el panel, con la empresa seleccionada → **Proyectos** → nombre → **crear**.
- Cada proyecto tiene **sus propias planillas y modelos**, aislados.

### 5. Generar el token del plugin para la empresa
En tu PC, en la carpeta del proyecto:
```
node scripts/new-client.mjs "Nombre de la Empresa"
```
Copia la entrada JSON que imprime y agrégale el **projectId** del proyecto
(lo obtienes de **Supabase → Table Editor → sqy_projects**, columna `id`):
```json
{"id":"acme","name":"ACME","key":"dl_...","token":"tok_...","projectId":"<uuid-del-proyecto>","active":true}
```
Pega esa entrada en la variable **`PLUGIN_CLIENTS`** de **Vercel → Settings →
Environment Variables** (es un array JSON, en una línea) → **Redeploy**.

> El `key` es la llave de descarga; el `token` es lo que el plugin usa para
> leer/escribir, **scopeado al `projectId`** de esa empresa.

---

## Parte B — Lo que hace el cliente

### 6. Descargar e instalar el plugin
- Entra a la web con su email + contraseña.
- **Configuración → Plugin Navisworks → "Descargar plugin"** → `Instalar.bat`.
  *(El instalador trae su token ya inyectado.)*

### 7. Cargar y editar sus planillas
- Elige su **empresa → proyecto** → carga/edita las planillas por disciplina.
- Todo queda **aislado en su proyecto**: ninguna otra empresa lo ve.

### 8. Publicar el modelo a la nube
- En Navisworks, pestaña **Aura GIP → "Publicar a la nube"** → nombre del modelo.
- Aparece en la web (vista 3D → "Modelos"). **Mismo nombre = nueva versión.**

---

## Checklist rápido (por cliente)

- [ ] Usuario creado en Supabase (con contraseña + Auto Confirm)
- [ ] Empresa creada en el panel de Administración
- [ ] Usuario invitado a la empresa con su rol
- [ ] Proyecto(s) creado(s)
- [ ] `projectId` copiado de `sqy_projects`
- [ ] Entrada agregada a `PLUGIN_CLIENTS` (con `projectId`) + Redeploy en Vercel
- [ ] Cliente descargó e instaló el plugin
- [ ] Cliente cargó planillas y publicó un modelo de prueba

---

## Notas

- **Aislamiento:** cada empresa/proyecto ve solo sus planillas y modelos.
- **Auditoría:** todo cambio queda registrado (quién/qué/cuándo) en
  **Configuración → Historial de modificaciones**.
- **Migrar datos existentes** a un proyecto (si venías con planillas globales):
  Admin → proyecto → **"Migrar planillas"**.
- **Revocar un cliente:** poné `"active": false` en su entrada de `PLUGIN_CLIENTS`
  (deja de descargar y su token deja de funcionar), sin afectar a los demás.
