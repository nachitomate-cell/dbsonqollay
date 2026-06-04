-- Migración 002 — Alcance por proyecto en los datos (B4)
-- Correr DESPUÉS de 001 y SOLO cuando la API ya setee project_id (ver nota).
-- Diseñada para NO romper la API actual: project_id es NULLABLE.
--
-- Estado actual: el backend escribe sqy_dataset_rows por conexión directa
-- (SQY_DATABASE_URL), que SALTEA RLS. Por eso habilitar RLS acá NO rompe al
-- plugin/backend, pero sí restringe el acceso desde el navegador vía Data API.

-- 1) Columna de proyecto (nullable para compatibilidad con filas ya cargadas).
alter table sqy_dataset_rows
  add column if not exists project_id uuid references sqy_projects(id) on delete cascade;

create index if not exists sqy_dataset_rows_project on sqy_dataset_rows(project_id);

-- 2) (Opcional) Backfill: asignar las filas existentes a un proyecto concreto.
--    Reemplazá <PROJECT_ID> por el id real (select id from sqy_projects).
-- update sqy_dataset_rows set project_id = '<PROJECT_ID>' where project_id is null;

-- 3) RLS por proyecto en los datos. El usuario solo ve/edita filas de proyectos
--    de sus organizaciones (función sqy_my_project_ids() definida en 001).
alter table sqy_dataset_rows enable row level security;

drop policy if exists rows_select on sqy_dataset_rows;
create policy rows_select on sqy_dataset_rows
  for select using (project_id in (select sqy_my_project_ids()));

drop policy if exists rows_write on sqy_dataset_rows;
create policy rows_write on sqy_dataset_rows
  for all
  using (project_id in (select sqy_my_project_ids()))
  with check (project_id in (select sqy_my_project_ids()));

-- NOTA DE ACTIVACIÓN:
-- 1. Antes de correr esto, actualizar la API (api/datasets/[key].js + _lib/db.js)
--    para recibir/guardar project_id en cada fila y filtrar lecturas por proyecto.
-- 2. Backfillear las filas existentes (paso 2) para que no queden huérfanas.
-- 3. Si el backend sigue usando la conexión directa privilegiada, la seguridad
--    multi-tenant la garantiza la API (filtrando por project_id del usuario);
--    RLS es defensa en profundidad para el acceso vía Data API.
