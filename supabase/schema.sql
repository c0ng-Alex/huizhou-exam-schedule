-- ============================================================
-- 惠州市考试工作日程系统 · Supabase 数据库初始化脚本
-- 使用方法：Supabase 控制台 → SQL Editor → 新建查询 → 粘贴整段 → Run
-- 可重复执行，不会重复建表
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- 1. 用户资料 ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  department text not null default '',
  phone text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- 2. 日程 ----------
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null default '',
  title text not null,
  exam_type text not null default 'custom',
  exam_date date not null,
  exam_end_date date,
  tasks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 3. 共享关系（协作者） ----------
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (schedule_id, user_id)
);

-- ---------- 4. 个人进度（打勾 / 备注） ----------
create table if not exists public.progress (
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  done jsonb not null default '{}'::jsonb,
  notes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (schedule_id, user_id)
);

-- ---------- 5. 模板库 ----------
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  exam_type text not null default 'custom',
  tasks jsonb not null default '[]'::jsonb,
  is_public boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- 6. 操作日志 ----------
create table if not exists public.logs (
  id bigserial primary key,
  actor_id uuid,
  actor_name text default '',
  action text not null,
  target text default '',
  detail text default '',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 授予 API 角色访问权限（数据是否可见由 RLS 策略决定）
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles  to authenticated;
grant select, insert, update, delete on public.schedules to authenticated;
grant select, insert, update, delete on public.shares    to authenticated;
grant select, insert, update, delete on public.progress  to authenticated;
grant select, insert, update, delete on public.templates to authenticated;
grant select, insert, update, delete on public.logs      to authenticated;
grant usage, select on sequence public.logs_id_seq to authenticated;

-- ============================================================
-- 权限判断函数（security definer 绕过 RLS，避免递归）
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and enabled = true
  );
$$;

create or replace function public.can_view_schedule(sid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.schedules s
    where s.id = sid
      and (
        s.owner_id = auth.uid()
        or exists (
          select 1 from public.shares sh
          where sh.schedule_id = s.id and sh.user_id = auth.uid()
        )
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin' and p.enabled = true
        )
      )
  );
$$;

-- ============================================================
-- 新用户自动建档：系统第一个注册者自动成为管理员
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count int;
begin
  select count(*) into admin_count from public.profiles where role = 'admin';

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    case when admin_count = 0 then 'admin' else 'user' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 开启行级安全（RLS）
-- ============================================================
alter table public.profiles  enable row level security;
alter table public.schedules enable row level security;
alter table public.shares    enable row level security;
alter table public.progress  enable row level security;
alter table public.templates enable row level security;
alter table public.logs      enable row level security;

-- ---------- profiles ----------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (id = auth.uid() or public.is_admin());

-- ---------- schedules ----------
drop policy if exists "schedules_select" on public.schedules;
create policy "schedules_select" on public.schedules
  for select to authenticated using (public.can_view_schedule(id));

drop policy if exists "schedules_insert" on public.schedules;
create policy "schedules_insert" on public.schedules
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "schedules_update" on public.schedules;
create policy "schedules_update" on public.schedules
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "schedules_delete" on public.schedules;
create policy "schedules_delete" on public.schedules
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- ---------- shares ----------
drop policy if exists "shares_select" on public.shares;
create policy "shares_select" on public.shares
  for select to authenticated using (public.can_view_schedule(schedule_id));

drop policy if exists "shares_write" on public.shares;
create policy "shares_write" on public.shares
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.schedules s
      where s.id = schedule_id and s.owner_id = auth.uid()
    )
  );

drop policy if exists "shares_delete" on public.shares;
create policy "shares_delete" on public.shares
  for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.schedules s
      where s.id = schedule_id and s.owner_id = auth.uid()
    )
  );

-- ---------- progress（只能读写自己的那一行） ----------
drop policy if exists "progress_select" on public.progress;
create policy "progress_select" on public.progress
  for select to authenticated using (public.can_view_schedule(schedule_id));

drop policy if exists "progress_write" on public.progress;
create policy "progress_write" on public.progress
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_schedule(schedule_id));

drop policy if exists "progress_update" on public.progress;
create policy "progress_update" on public.progress
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- templates ----------
drop policy if exists "templates_select" on public.templates;
create policy "templates_select" on public.templates
  for select to authenticated
  using (is_public or created_by = auth.uid() or public.is_admin());

drop policy if exists "templates_write" on public.templates;
create policy "templates_write" on public.templates
  for insert to authenticated with check (public.is_admin());

drop policy if exists "templates_update" on public.templates;
create policy "templates_update" on public.templates
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "templates_delete" on public.templates;
create policy "templates_delete" on public.templates
  for delete to authenticated using (public.is_admin());

-- ---------- logs ----------
drop policy if exists "logs_insert" on public.logs;
create policy "logs_insert" on public.logs
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "logs_select" on public.logs;
create policy "logs_select" on public.logs
  for select to authenticated using (public.is_admin());

-- ============================================================
-- 完成。首次注册的那个账号即为管理员。
-- 如需把某个账号设为管理员，可执行：
--   update public.profiles set role = 'admin' where email = 'xxx@xxx.com';
-- ============================================================
