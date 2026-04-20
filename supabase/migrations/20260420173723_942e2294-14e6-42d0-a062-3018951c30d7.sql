-- Enums
create type public.app_role as enum ('admin', 'salon_owner');
create type public.booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.booking_source as enum ('online', 'offline', 'whatsapp');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- User roles (separate table — security best practice)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- Security definer for role check (avoids RLS recursion)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Salons
create table public.salons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  address text,
  city text,
  phone text,
  whatsapp_number text,
  image_url text,
  opening_time time not null default '09:00',
  closing_time time not null default '20:00',
  regular_threshold int not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.salons enable row level security;
create index salons_owner_idx on public.salons(owner_id);
create index salons_city_idx on public.salons(city);

-- Services
create table public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes int not null default 30,
  price numeric(10,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.services enable row level security;
create index services_salon_idx on public.services(salon_id);

-- Barbers
create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null,
  avatar_url text,
  bio text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.barbers enable row level security;
create index barbers_salon_idx on public.barbers(salon_id);

-- Barber-service join
create table public.barber_services (
  barber_id uuid not null references public.barbers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (barber_id, service_id)
);
alter table public.barber_services enable row level security;

-- Customers (per-salon)
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  phone text not null,
  name text,
  email text,
  visit_count int not null default 0,
  is_regular_override boolean,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, phone)
);
alter table public.customers enable row level security;
create index customers_salon_idx on public.customers(salon_id);

-- Bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  barber_id uuid not null references public.barbers(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  customer_name text not null,
  customer_phone text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status booking_status not null default 'confirmed',
  source booking_source not null default 'online',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bookings enable row level security;
create index bookings_salon_start_idx on public.bookings(salon_id, start_time);
create index bookings_barber_start_idx on public.bookings(barber_id, start_time);

-- updated_at trigger fn
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();
create trigger salons_updated_at before update on public.salons
  for each row execute function public.tg_set_updated_at();
create trigger customers_updated_at before update on public.customers
  for each row execute function public.tg_set_updated_at();
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.tg_set_updated_at();

-- Auto-create profile + assign salon_owner role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
  insert into public.user_roles (user_id, role)
  values (new.id, 'salon_owner');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ RLS POLICIES ============

-- Profiles
create policy "profiles select own" on public.profiles for select using (auth.uid() = id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);

-- User roles: read own
create policy "user_roles select own" on public.user_roles for select using (auth.uid() = user_id);
create policy "user_roles admin manages" on public.user_roles for all using (public.has_role(auth.uid(), 'admin'));

-- Salons: public read, owner write
create policy "salons public read" on public.salons for select using (true);
create policy "salons owner insert" on public.salons for insert with check (auth.uid() = owner_id);
create policy "salons owner update" on public.salons for update using (auth.uid() = owner_id);
create policy "salons owner delete" on public.salons for delete using (auth.uid() = owner_id);

-- Services: public read, owner write
create policy "services public read" on public.services for select using (true);
create policy "services owner write" on public.services for all
  using (exists (select 1 from public.salons s where s.id = services.salon_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.salons s where s.id = services.salon_id and s.owner_id = auth.uid()));

-- Barbers: public read, owner write
create policy "barbers public read" on public.barbers for select using (true);
create policy "barbers owner write" on public.barbers for all
  using (exists (select 1 from public.salons s where s.id = barbers.salon_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.salons s where s.id = barbers.salon_id and s.owner_id = auth.uid()));

-- Barber-services: public read, owner write
create policy "barber_services public read" on public.barber_services for select using (true);
create policy "barber_services owner write" on public.barber_services for all
  using (exists (select 1 from public.barbers b join public.salons s on s.id = b.salon_id where b.id = barber_services.barber_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.barbers b join public.salons s on s.id = b.salon_id where b.id = barber_services.barber_id and s.owner_id = auth.uid()));

-- Customers: only salon owner
create policy "customers owner all" on public.customers for all
  using (exists (select 1 from public.salons s where s.id = customers.salon_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.salons s where s.id = customers.salon_id and s.owner_id = auth.uid()));

-- Bookings: salon owner sees all; anyone can insert (public booking + bot); only owner can update/delete
create policy "bookings owner read" on public.bookings for select
  using (exists (select 1 from public.salons s where s.id = bookings.salon_id and s.owner_id = auth.uid()));
create policy "bookings public insert" on public.bookings for insert with check (true);
create policy "bookings owner update" on public.bookings for update
  using (exists (select 1 from public.salons s where s.id = bookings.salon_id and s.owner_id = auth.uid()));
create policy "bookings owner delete" on public.bookings for delete
  using (exists (select 1 from public.salons s where s.id = bookings.salon_id and s.owner_id = auth.uid()));