-- Ejecuta este script en Supabase: SQL Editor > New query > Run.

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (char_length(client_name) between 2 and 120),
  phone text not null check (phone ~ '^[0-9]{10}$'),
  service text not null,
  barber text not null,
  appointment_date date not null,
  appointment_time text not null,
  status text not null default 'confirmada'
    check (status in ('pendiente', 'confirmada', 'completada', 'cancelada')),
  price numeric(10, 2) not null check (price >= 0),
  created_at timestamptz not null default now()
);

alter table public.appointments enable row level security;

create unique index if not exists appointments_active_slot_key
on public.appointments (appointment_date, appointment_time)
where status <> 'cancelada';

-- Permite que el formulario público cree una reserva; no permite leer datos de clientes.
drop policy if exists "Public booking inserts" on public.appointments;
create policy "Public booking inserts"
on public.appointments for insert
with check (true);

-- Las cuentas de Supabase autenticadas pueden gestionar las reservas.
drop policy if exists "Authenticated staff manage appointments" on public.appointments;
create policy "Authenticated staff manage appointments"
on public.appointments for all to authenticated
using (true)
with check (true);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  duration integer not null check (duration > 0),
  active boolean not null default true
);

create table if not exists public.barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text not null,
  initials text not null,
  color text not null default 'bg-amber-700',
  is_apprentice boolean not null default false
);

alter table public.barbers add column if not exists is_apprentice boolean not null default false;

alter table public.services enable row level security;
alter table public.barbers enable row level security;

drop policy if exists "Public reads services" on public.services;
drop policy if exists "Staff manage services" on public.services;
drop policy if exists "Public reads barbers" on public.barbers;
drop policy if exists "Staff manage barbers" on public.barbers;
create policy "Public reads services" on public.services for select using (true);
create policy "Staff manage services" on public.services for all to authenticated using (true) with check (true);
create policy "Public reads barbers" on public.barbers for select using (true);
create policy "Staff manage barbers" on public.barbers for all to authenticated using (true) with check (true);

-- El formulario público solo recibe horas reservadas, nunca datos de clientes.
drop function if exists public.booked_appointment_times(date);
create or replace function public.booked_appointment_times(selected_date date)
returns table(appointment_time text, duration integer)
language sql
security definer
set search_path = public
as $$
  select a.appointment_time, coalesce(s.duration, 30)
  from public.appointments a
  left join public.services s on s.name = a.service
  where a.appointment_date = selected_date and a.status <> 'cancelada';
$$;

grant execute on function public.booked_appointment_times(date) to anon, authenticated;

insert into public.services (name, price, duration, active)
select 'Corte Natural', 120, 30, true
where not exists (select 1 from public.services);

insert into public.services (name, price, duration, active)
select 'Corte y Barba', 180, 45, true
where not exists (select 1 from public.services where name = 'Corte y Barba');

insert into public.services (name, price, duration, active)
select 'Corte, Barba y Ceja', 200, 60, true
where not exists (select 1 from public.services where name = 'Corte, Barba y Ceja');

insert into public.services (name, price, duration, active)
select 'Arreglo de Barba', 90, 30, true
where not exists (select 1 from public.services where name = 'Arreglo de Barba');

update public.barbers
set name = 'Jackie Ramos', specialty = 'Estilista', initials = 'JR', color = 'bg-amber-700'
where name = 'Mateo Cruz';

insert into public.barbers (name, specialty, initials, color)
select 'Jackie Ramos', 'Estilista', 'JR', 'bg-amber-700'
where not exists (select 1 from public.barbers);
