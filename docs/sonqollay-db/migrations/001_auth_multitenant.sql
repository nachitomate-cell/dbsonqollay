-- Migración 001 — Auth + multi-tenant (B3 + B4)
-- ADITIVA: crea tablas nuevas; NO toca sqy_dataset_rows ni los datos existentes.
-- Correr en Supabase → SQL Editor (una vez). Idempotente (if not exists).
--
-- Modelo: organización → proyectos; usuarios (auth.users de Supabase) con rol por
-- organización (viewer/editor/approver/admin). La asignación de datos a proyecto
-- (project_id en sqy_dataset_rows) y el enforcement por API van en la migración 002.

create extension if not exists pgcrypto;

-- Organizaciones (cada cliente/minera) -----------------------------------------
create table if not exists sqy_organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Proyectos dentro de una organización -----------------------------------------
create table if not exists sqy_projects (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references sqy_organizations(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists sqy_projects_org on sqy_projects(org_id);

-- Membresías: qué usuario pertenece a qué org y con qué rol ---------------------
create table if not exists sqy_memberships (
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid not null references sqy_organizations(id) on delete cascade,
  role        text not null default 'viewer'
              check (role in ('viewer','editor','approver','admin')),
  created_at  timestamptz not null default now(),
  primary key (user_id, org_id)
);

-- Row-Level Security en las tablas nuevas --------------------------------------
-- (el backend usa una conexión privilegiada por SQY_DATABASE_URL, que saltea RLS
--  para sembrar/administrar; el acceso desde el navegador vía Data API sí queda
--  restringido por estas políticas, ligadas al JWT del usuario = auth.uid()).
alter table sqy_organizations enable row level security;
alter table sqy_projects      enable row level security;
alter table sqy_memberships   enable row level security;

-- Un usuario ve solo sus propias membresías…
drop policy if exists mem_self on sqy_memberships;
create policy mem_self on sqy_memberships
  for select using (user_id = auth.uid());

-- …las orgs donde es miembro…
drop policy if exists org_member on sqy_organizations;
create policy org_member on sqy_organizations
  for select using (
    id in (select org_id from sqy_memberships where user_id = auth.uid())
  );

-- …y los proyectos de esas orgs.
drop policy if exists proj_member on sqy_projects;
create policy proj_member on sqy_projects
  for select using (
    org_id in (select org_id from sqy_memberships where user_id = auth.uid())
  );

-- Helper para la migración 002 (RLS sobre sqy_dataset_rows): proyectos visibles.
create or replace function sqy_my_project_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select p.id
  from sqy_projects p
  join sqy_memberships m on m.org_id = p.org_id
  where m.user_id = auth.uid()
$$;
