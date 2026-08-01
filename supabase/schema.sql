-- OUR LILY GARDEN — Phase 1 Database Schema
create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default 'My Love',
  avatar_url text,
  cat_name text default 'Mochi',
  cat_emoji text default '🐱',
  created_at timestamptz not null default now()
);

create table if not exists love_notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  style text not null default 'sticky' check (style in ('sticky', 'lily', 'cat')),
  is_pinned boolean not null default false,
  is_favorite boolean not null default false,
  is_daily_seed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists daily_note_bank (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  used boolean not null default false,
  scheduled_for date,
  created_at timestamptz not null default now()
);

create table if not exists garden_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  event_type text not null check (event_type in (
    'note', 'letter', 'memory', 'milestone', 'achievement', 'login'
  )),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists relationship_info (
  id int primary key default 1,
  anniversary_date date,
  constraint single_row check (id = 1)
);

insert into relationship_info (id, anniversary_date)
values (1, null)
on conflict (id) do nothing;

alter table profiles enable row level security;
alter table love_notes enable row level security;
alter table daily_note_bank enable row level security;
alter table garden_events enable row level security;
alter table relationship_info enable row level security;

create policy "profiles are viewable by authenticated users"
  on profiles for select to authenticated using (true);
create policy "users can update their own profile"
  on profiles for update to authenticated using (auth.uid() = id);
create policy "users can insert their own profile"
  on profiles for insert to authenticated with check (auth.uid() = id);
create policy "love notes viewable by authenticated users"
  on love_notes for select to authenticated using (true);
create policy "authenticated users can create love notes"
  on love_notes for insert to authenticated with check (auth.uid() = author_id);
create policy "authenticated users can update love notes"
  on love_notes for update to authenticated using (true);
create policy "authenticated users can delete their own notes"
  on love_notes for delete to authenticated using (auth.uid() = author_id);
create policy "daily bank viewable by authenticated users"
  on daily_note_bank for select to authenticated using (true);
create policy "garden events viewable by authenticated users"
  on garden_events for select to authenticated using (true);
create policy "authenticated users can log garden events"
  on garden_events for insert to authenticated with check (true);
create policy "relationship info viewable by authenticated users"
  on relationship_info for select to authenticated using (true);
create policy "authenticated users can update relationship info"
  on relationship_info for update to authenticated using (true);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'nickname', 'My Love'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
