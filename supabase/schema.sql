-- Kitchen Cupid: shared family households.
-- Paste this whole file into the Supabase SQL Editor and press Run. It is safe to run again.
--
-- How it fits together:
--   households         one row per family, with its join code and match rule
--   household_devices  which signed-in devices (anonymous users) belong to which family
--   members            the people in the family (Mom, Grandpa, Jake...)
--   recipes            this week's deck of dinners
--   votes              each person's yum / nope on each recipe
--   plan_meals         breakfast, lunch and dinner for Monday to Sunday
--   grocery_checks     grocery items someone has checked off
--   grocery_extras     things added to the shopping list by hand (milk, paper towels...)
-- A device can only read or change the family it joined (row level security).

create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our family',
  invite_code text not null unique,
  match_rule text not null default 'parentsPlusKid'
    check (match_rule in ('everyone', 'majority', 'parentsPlusKid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_devices (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_devices_user_idx on public.household_devices (user_id);

create table if not exists public.members (
  household_id uuid not null references public.households on delete cascade,
  id text not null,
  name text not null check (length(name) between 1 and 40),
  avatar text not null default '🦊',
  is_kid boolean not null default false,
  no_foods text[] not null default '{}',
  -- Food preferences: { "cuisines": [...], "kinds": [...], "skips": [...] }
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (household_id, id)
);
-- For families set up before food preferences existed.
alter table public.members add column if not exists prefs jsonb not null default '{}'::jsonb;

create table if not exists public.recipes (
  household_id uuid not null references public.households on delete cascade,
  id text not null,
  data jsonb not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.votes (
  household_id uuid not null,
  member_id text not null,
  recipe_id text not null,
  vote text not null check (vote in ('yum', 'nope')),
  updated_at timestamptz not null default now(),
  primary key (household_id, member_id, recipe_id),
  foreign key (household_id, member_id) references public.members (household_id, id) on delete cascade
);

create table if not exists public.plan_days (
  household_id uuid not null references public.households on delete cascade,
  day text not null check (day in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')),
  recipe_id text,
  primary key (household_id, day)
);

-- Which meals the family plans each day. Added after the first version, so it's added separately.
alter table public.households add column if not exists plan_slots text[] not null default '{dinner}';
alter table public.households drop constraint if exists households_plan_slots_check;
alter table public.households add constraint households_plan_slots_check
  check (plan_slots <@ array['breakfast', 'lunch', 'dinner']);

create table if not exists public.plan_meals (
  household_id uuid not null references public.households on delete cascade,
  day text not null check (day in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')),
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner')),
  recipe_id text,
  primary key (household_id, day, slot)
);

-- The first version planned one dinner a day in plan_days. Move those dinners over (only once).
insert into public.plan_meals (household_id, day, slot, recipe_id)
  select household_id, day, 'dinner', recipe_id from public.plan_days
  on conflict do nothing;
delete from public.plan_days;

create table if not exists public.grocery_extras (
  household_id uuid not null references public.households on delete cascade,
  id text not null,
  name text not null check (length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.grocery_checks (
  household_id uuid not null references public.households on delete cascade,
  key text not null,
  checked boolean not null default true,
  primary key (household_id, key)
);

-- Is the signed-in device part of this family?
create or replace function public.is_household_device(hid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.household_devices d where d.household_id = hid and d.user_id = auth.uid()
  );
$$;

alter table public.households enable row level security;
alter table public.household_devices enable row level security;
alter table public.members enable row level security;
alter table public.recipes enable row level security;
alter table public.votes enable row level security;
alter table public.plan_days enable row level security;
alter table public.plan_meals enable row level security;
alter table public.grocery_extras enable row level security;
alter table public.grocery_checks enable row level security;

drop policy if exists "family can read" on public.households;
create policy "family can read" on public.households
  for select to authenticated using (public.is_household_device(id));
drop policy if exists "family can update" on public.households;
create policy "family can update" on public.households
  for update to authenticated using (public.is_household_device(id)) with check (public.is_household_device(id));

drop policy if exists "see own devices" on public.household_devices;
create policy "see own devices" on public.household_devices
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "leave family" on public.household_devices;
create policy "leave family" on public.household_devices
  for delete to authenticated using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['members', 'recipes', 'votes', 'plan_days', 'plan_meals', 'grocery_checks', 'grocery_extras'] loop
    execute format('drop policy if exists "family only" on public.%I', t);
    execute format(
      'create policy "family only" on public.%I for all to authenticated
         using (public.is_household_device(household_id))
         with check (public.is_household_device(household_id))', t);
  end loop;
end $$;

-- Only allow changing the name, match rule and planned meals from the app; the join code stays fixed.
revoke update on public.households from anon, authenticated;
grant update (name, match_rule, plan_slots) on public.households to authenticated;

-- When anything except a vote changes, bump the family's updated_at so other devices reload.
-- (Votes are sent to other devices one by one instead, because they happen constantly.)
create or replace function public.touch_household()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.households set updated_at = now()
  where id = coalesce(new.household_id, old.household_id);
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['members', 'recipes', 'plan_days', 'plan_meals', 'grocery_checks', 'grocery_extras'] loop
    execute format('drop trigger if exists touch_household on public.%I', t);
    execute format(
      'create trigger touch_household after insert or update or delete on public.%I
         for each row execute function public.touch_household()', t);
  end loop;
end $$;

-- An undone vote: reload the family too.
create or replace function public.touch_household_from_deleted()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.households set updated_at = now()
  where id in (select distinct household_id from deleted_rows);
  return null;
end;
$$;

drop trigger if exists touch_household_on_vote_delete on public.votes;
create trigger touch_household_on_vote_delete after delete on public.votes
  referencing old table as deleted_rows
  for each statement execute function public.touch_household_from_deleted();

-- Start a new family. Returns the family with its join code.
create or replace function public.create_household(p_name text default 'Our family')
returns public.households
language plpgsql security definer set search_path = public
as $$
declare
  h public.households;
  code text;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O, 1/I/L
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  insert into public.households (name, invite_code)
    values (coalesce(nullif(trim(p_name), ''), 'Our family'), code)
    returning * into h;
  insert into public.household_devices (household_id, user_id) values (h.id, auth.uid());
  return h;
end;
$$;

-- Join a family with its code. Spaces, dashes and lower case are fine.
create or replace function public.join_household(p_code text)
returns public.households
language plpgsql security definer set search_path = public
as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select * into h from public.households
    where invite_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if h.id is null then
    raise exception 'No family with that code' using errcode = 'P0002';
  end if;
  insert into public.household_devices (household_id, user_id)
    values (h.id, auth.uid()) on conflict do nothing;
  return h;
end;
$$;

-- Clear swipes, the deck, the plan and the shopping list. The family stays.
create or replace function public.new_week(p_household uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_household_device(p_household) then
    raise exception 'Not in this family';
  end if;
  delete from public.votes where household_id = p_household;
  delete from public.recipes where household_id = p_household;
  delete from public.plan_days where household_id = p_household;
  delete from public.plan_meals where household_id = p_household;
  delete from public.grocery_checks where household_id = p_household;
  delete from public.grocery_extras where household_id = p_household;
end;
$$;

revoke execute on function public.create_household(text) from public, anon;
revoke execute on function public.join_household(text) from public, anon;
revoke execute on function public.new_week(uuid) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.new_week(uuid) to authenticated;

-- Live updates: devices listen for family changes and for new votes.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'households') then
    alter publication supabase_realtime add table public.households;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'votes') then
    alter publication supabase_realtime add table public.votes;
  end if;
end $$;
