# Sonqollay como base de datos del modelo (DataTools en vivo)

Hace que Navisworks lea **en vivo** los datos de Sonqollay por **TAG**, vía
**DataTools (ODBC) → Postgres (Supabase)**. Al "Publicar para Navisworks", la web
replica la planilla en la base; en Navisworks se hace *Refresh* y la pestaña se
actualiza sola.

```
Sonqollay web ──publica──> Postgres (Supabase) <──ODBC/TAG── Navisworks (DataTools)
```

> Es **aditivo**: si no está la variable `SQY_DATABASE_URL`, el publish sigue
> funcionando como antes (JSON en el bucket APS). La base es un extra.

---

## Fase 0 — Crear la base (una vez)

1. Crear un proyecto en **https://supabase.com** (plan free alcanza para empezar).
2. **Settings → Database → Connection string**:
   - Para **Vercel/serverless** usá la cadena del **pooler "Transaction"** (puerto **6543**):
     `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`
3. En **Vercel → Project → Settings → Environment Variables**, agregá:
   - `SQY_DATABASE_URL` = esa cadena de conexión.  *(secreto; no va al repo)*
4. Redeploy. Listo: el próximo "Publicar para Navisworks" ya escribe a la base.

> La **tabla y las vistas se crean solas** en el primer publish (no hay que correr
> migraciones a mano).

---

## Esquema (lo crea el backend automáticamente)

```sql
create table if not exists sqy_dataset_rows (
  dataset_key text not null,         -- p. ej. "ele" (Equipos)
  tag         text not null,         -- valor del TAG/Commodity
  data        jsonb not null,        -- toda la fila { columna: valor }
  updated_at  timestamptz not null default now(),
  primary key (dataset_key, tag)
);
```

Y por cada planilla se (re)crea una **vista** `sqy_v_<key>` con **una columna por
encabezado**, p. ej. `sqy_v_ele`. Esa vista es la que consulta DataTools.

```sql
-- ejemplo generado para la planilla "ele"
create view sqy_v_ele as
select tag,
       data->>'TAG/Commodity'          as "TAG/Commodity",
       data->>'DESCRIPCIÓN_GENERAL'    as "DESCRIPCIÓN_GENERAL",
       data->>'CWA' as "CWA", data->>'CWP' as "CWP", ...
from sqy_dataset_rows where dataset_key = 'ele';
```

---

## Fase 2 — Conectar Navisworks por DataTools (por máquina)

**Requisito una vez por PC:** instalar el **driver ODBC de PostgreSQL** (psqlODBC,
*"PostgreSQL Unicode(x64)"*) — https://www.postgresql.org/ftp/odbc/versions/msi/

1. **Crear el DSN** (Panel de control → *Orígenes de datos ODBC (64 bits)* →
   pestaña *DSN de sistema* → Agregar → *PostgreSQL Unicode(x64)*):
   - **Server:** `db.<ref>.supabase.co`  ·  **Port:** `5432`
   - **Database:** `postgres`  ·  **User/Password:** los de Supabase
   - **SSL Mode:** `require`
   - Nombre del DSN, p. ej. `Sonqollay`.
2. En **Navisworks → Inicio → Herramientas → DataTools → Nuevo**:
   - **Nombre:** `Sonqollay`
   - **Conexión ODBC:** seleccioná el DSN `Sonqollay` (o pegá la cadena).
   - **SQL:** `SELECT * FROM sqy_v_ele`  *(usá la vista de la planilla; una por disciplina)*
   - **Campo de vínculo:**
     - *Categoría/Propiedad del modelo:* `BIM` / `TAG/Commodity`
     - *Campo de la base:* `TAG/Commodity` (o `tag`)
   - Marcá el vínculo como **Activo** → Aceptar.
3. **Refresh** (botón actualizar de DataTools). Aparece una pestaña **Sonqollay**
   en Propiedades, **alimentada en vivo desde la base**.
4. **Guardá el `.nwf`** para conservar el vínculo.

A partir de ahí: editás en la web → Publicar → **Refresh en Navisworks** → el
modelo muestra el dato actualizado, sin re-exportar nada.

> Nota: DataTools agrega una pestaña viva (no *pisa* la pestaña "BIM" horneada en
> el NWC — eso no lo permite Navisworks). La pestaña "Sonqollay" es la
> autoritativa y siempre refleja la base.

---

## Seguridad

- Usá un **usuario de base de solo lectura** para el DSN de Navisworks (las
  máquinas solo leen). El upsert lo hace el backend con su propia credencial.
- La cadena `SQY_DATABASE_URL` vive **solo** en variables de entorno de Vercel.
