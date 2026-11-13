-- Todoer schema, rebuilt from src/types/database.ts and the app's queries after the
-- original project was deleted. Only the tables the app uses are created.
--
-- Access model: every row belongs to its creator. A project owner can share a
-- project with an accepted connection; the connection can then see and edit that
-- project's tasks and sections, but not the owner's other data.

create extension if not exists pgcrypto;

-- ---------- tables ----------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  settings jsonb not null default '{}'::jsonb,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  description text,
  color text,
  icon text,
  parent_id uuid references public.projects on delete cascade,
  position integer not null default 0,
  is_favorite boolean not null default false,
  is_archived boolean not null default false,
  view_type text not null default 'list',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  name text not null,
  position integer not null default 0,
  is_collapsed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references public.projects on delete cascade,
  section_id uuid references public.sections on delete set null,
  parent_id uuid references public.tasks on delete cascade,
  title text not null,
  description text,
  priority integer not null default 0,
  due_date date,
  due_time time,
  start_date date,
  start_time time,
  duration_minutes integer,
  is_completed boolean not null default false,
  completed_at timestamptz,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  recurrence_rule text,
  recurrence_type text,
  reminder_enabled boolean not null default false,
  nag_enabled boolean not null default false,
  nag_interval integer,
  last_nag_at timestamptz,
  snooze_until timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.task_labels (
  task_id uuid not null references public.tasks on delete cascade,
  label_id uuid not null references public.labels on delete cascade,
  primary key (task_id, label_id)
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  description text,
  color text,
  icon text,
  frequency_type text not null default 'daily',
  frequency_days integer[],
  target_count integer not null default 1,
  reminder_time time,
  nag_enabled boolean not null default false,
  nag_interval integer,
  position integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits on delete cascade,
  date date not null default current_date,
  count integer not null default 1,
  completed_at timestamptz not null default now()
);

create table public.shared_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  shared_with_id uuid references auth.users on delete cascade,
  shared_with_email text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index shared_accounts_owner_email_key on public.shared_accounts (owner_id, lower(shared_with_email));

create table public.shared_projects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  shared_with_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, shared_with_id)
);

-- Indexes for the columns that policies and queries filter on.
create index projects_user_id_idx on public.projects (user_id);
create index projects_parent_id_idx on public.projects (parent_id);
create index sections_project_id_idx on public.sections (project_id);
create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_section_id_idx on public.tasks (section_id);
create index tasks_parent_id_idx on public.tasks (parent_id);
create index tasks_open_due_idx on public.tasks (user_id, due_date) where not is_completed and not is_deleted;
create index labels_user_id_idx on public.labels (user_id);
create index task_labels_label_id_idx on public.task_labels (label_id);
create index habits_user_id_idx on public.habits (user_id);
create index habit_completions_habit_date_idx on public.habit_completions (habit_id, date);
create index shared_accounts_shared_with_id_idx on public.shared_accounts (shared_with_id);
create index shared_projects_owner_id_idx on public.shared_projects (owner_id);
create index shared_projects_shared_with_id_idx on public.shared_projects (shared_with_id);

-- ---------- triggers ----------

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();

-- Settings reads a single profile row, so every account gets one at sign-up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Removing a connection must also end the project access it granted, in both directions.
create function public.end_connection_shares() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.shared_with_id is not null then
    delete from public.shared_projects
    where (owner_id = old.owner_id and shared_with_id = old.shared_with_id)
       or (owner_id = old.shared_with_id and shared_with_id = old.owner_id);
  end if;
  return old;
end;
$$;
revoke execute on function public.end_connection_shares() from public, anon, authenticated;

create trigger shared_accounts_end_shares after delete on public.shared_accounts for each row execute function public.end_connection_shares();

-- ---------- access helpers ----------
-- Security definer so policies on projects and shared_projects can consult each
-- other without recursive policy evaluation. Kept out of the exposed API schema.

create schema if not exists private;
grant usage on schema private to authenticated;

create function private.owns_project(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects p where p.id = p_project_id and p.user_id = (select auth.uid()));
$$;

create function private.can_access_project(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects p where p.id = p_project_id and p.user_id = (select auth.uid()))
      or exists (select 1 from public.shared_projects sp where sp.project_id = p_project_id and sp.shared_with_id = (select auth.uid()));
$$;

create function private.can_access_task(p_task_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and (t.user_id = (select auth.uid()) or (t.project_id is not null and private.can_access_project(t.project_id)))
  );
$$;

create function private.is_accepted_connection(p_other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shared_accounts sa
    where sa.status = 'accepted'
      and ((sa.owner_id = (select auth.uid()) and sa.shared_with_id = p_other)
        or (sa.shared_with_id = (select auth.uid()) and sa.owner_id = p_other))
  );
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- ---------- row level security ----------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.sections enable row level security;
alter table public.tasks enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.shared_accounts enable row level security;
alter table public.shared_projects enable row level security;

-- profiles: your own row only; created by the sign-up trigger.
create policy "profiles: read own" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- projects: owners manage; people it is shared with can read.
create policy "projects: read own or shared" on public.projects for select to authenticated
  using (user_id = (select auth.uid()) or private.can_access_project(id));
create policy "projects: create own" on public.projects for insert to authenticated with check (user_id = (select auth.uid()));
create policy "projects: update own" on public.projects for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "projects: delete own" on public.projects for delete to authenticated using (user_id = (select auth.uid()));

-- sections: anyone with project access can read, add and rename; only the owner deletes.
create policy "sections: read" on public.sections for select to authenticated using (private.can_access_project(project_id));
create policy "sections: create" on public.sections for insert to authenticated with check (private.can_access_project(project_id));
create policy "sections: update" on public.sections for update to authenticated
  using (private.can_access_project(project_id)) with check (private.can_access_project(project_id));
create policy "sections: delete" on public.sections for delete to authenticated using (private.owns_project(project_id));

-- tasks: your own tasks, plus tasks in projects shared with you.
create policy "tasks: read" on public.tasks for select to authenticated
  using (user_id = (select auth.uid()) or (project_id is not null and private.can_access_project(project_id)));
create policy "tasks: create" on public.tasks for insert to authenticated
  with check (user_id = (select auth.uid()) and (project_id is null or private.can_access_project(project_id)));
create policy "tasks: update" on public.tasks for update to authenticated
  using (user_id = (select auth.uid()) or (project_id is not null and private.can_access_project(project_id)))
  -- After the change it must still be your Inbox task, or sit in a project you can access.
  with check (
    (project_id is null and user_id = (select auth.uid()))
    or (project_id is not null and private.can_access_project(project_id))
  );
create policy "tasks: delete" on public.tasks for delete to authenticated
  using (user_id = (select auth.uid()) or (project_id is not null and private.can_access_project(project_id)));

-- labels are personal.
create policy "labels: own" on public.labels for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- task_labels: read on any task you can see; attach only your own labels.
create policy "task_labels: read" on public.task_labels for select to authenticated using (private.can_access_task(task_id));
create policy "task_labels: attach own label" on public.task_labels for insert to authenticated
  with check (private.can_access_task(task_id) and exists (select 1 from public.labels l where l.id = label_id and l.user_id = (select auth.uid())));
create policy "task_labels: detach" on public.task_labels for delete to authenticated
  using (private.can_access_task(task_id) and exists (select 1 from public.labels l where l.id = label_id and l.user_id = (select auth.uid())));

-- habits are personal.
create policy "habits: own" on public.habits for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "habit_completions: own habit" on public.habit_completions for all to authenticated
  using (exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid())))
  with check (exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid())));

-- shared_accounts: invitations are matched by the invitee's signed-in email address.
create policy "shared_accounts: read involved" on public.shared_accounts for select to authenticated
  using (
    owner_id = (select auth.uid())
    or shared_with_id = (select auth.uid())
    or lower(shared_with_email) = lower((select auth.jwt() ->> 'email'))
  );
create policy "shared_accounts: invite" on public.shared_accounts for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and status = 'pending'
    and shared_with_id is null
    and accepted_at is null
    and lower(shared_with_email) <> lower((select auth.jwt() ->> 'email'))
  );
create policy "shared_accounts: invitee responds" on public.shared_accounts for update to authenticated
  using (status = 'pending' and lower(shared_with_email) = lower((select auth.jwt() ->> 'email')))
  with check (
    lower(shared_with_email) = lower((select auth.jwt() ->> 'email'))
    and ((status = 'accepted' and shared_with_id = (select auth.uid()))
      or (status = 'declined' and shared_with_id is null))
  );
create policy "shared_accounts: either side removes" on public.shared_accounts for delete to authenticated
  using (owner_id = (select auth.uid()) or shared_with_id = (select auth.uid()));
-- Responding may only fill in these columns, never change who sent the invitation or to whom.
revoke update on public.shared_accounts from authenticated;
grant update (shared_with_id, status, accepted_at) on public.shared_accounts to authenticated;

-- shared_projects: an owner shares their own project with an accepted connection.
create policy "shared_projects: read involved" on public.shared_projects for select to authenticated
  using (owner_id = (select auth.uid()) or shared_with_id = (select auth.uid()));
create policy "shared_projects: owner shares" on public.shared_projects for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and private.owns_project(project_id)
    and private.is_accepted_connection(shared_with_id)
  );
create policy "shared_projects: either side removes" on public.shared_projects for delete to authenticated
  using (owner_id = (select auth.uid()) or shared_with_id = (select auth.uid()));
