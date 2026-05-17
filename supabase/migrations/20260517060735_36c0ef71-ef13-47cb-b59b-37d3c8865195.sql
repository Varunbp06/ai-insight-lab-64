
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text default 'Student',
  institution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile + seed students on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Students
create table public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_code text not null,
  name text not null,
  study_hours numeric not null default 0,
  attendance numeric not null default 0,
  sleep_hours numeric not null default 0,
  previous_marks numeric not null default 0,
  assignment_pct numeric not null default 0,
  mock_test numeric not null default 0,
  actual_marks numeric,
  predicted_marks numeric,
  grade text,
  created_at timestamptz not null default now()
);
create index students_owner_idx on public.students(owner_id);
alter table public.students enable row level security;
create policy "students_select_own" on public.students for select using (auth.uid() = owner_id);
create policy "students_insert_own" on public.students for insert with check (auth.uid() = owner_id);
create policy "students_update_own" on public.students for update using (auth.uid() = owner_id);
create policy "students_delete_own" on public.students for delete using (auth.uid() = owner_id);

-- Predictions
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  inputs jsonb not null,
  predicted_marks numeric not null,
  confidence numeric not null default 0,
  grade text,
  created_at timestamptz not null default now()
);
create index predictions_owner_idx on public.predictions(owner_id);
alter table public.predictions enable row level security;
create policy "predictions_select_own" on public.predictions for select using (auth.uid() = owner_id);
create policy "predictions_insert_own" on public.predictions for insert with check (auth.uid() = owner_id);
create policy "predictions_delete_own" on public.predictions for delete using (auth.uid() = owner_id);

-- Trained models
create table public.trained_models (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  algorithm text not null,
  params jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.trained_models enable row level security;
create policy "models_select_own" on public.trained_models for select using (auth.uid() = owner_id);
create policy "models_insert_own" on public.trained_models for insert with check (auth.uid() = owner_id);
create policy "models_update_own" on public.trained_models for update using (auth.uid() = owner_id);
create policy "models_delete_own" on public.trained_models for delete using (auth.uid() = owner_id);

-- Reports
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "reports_select_own" on public.reports for select using (auth.uid() = owner_id);
create policy "reports_insert_own" on public.reports for insert with check (auth.uid() = owner_id);
create policy "reports_delete_own" on public.reports for delete using (auth.uid() = owner_id);
