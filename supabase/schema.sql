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

drop index if exists public.appointments_active_slot_key;
create unique index appointments_active_slot_key
on public.appointments (appointment_date, barber, appointment_time)
where status <> 'cancelada' and appointment_time <> 'Por orden de llegada';

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

create table if not exists public.booking_settings (
  id integer primary key check (id = 1),
  limit_months boolean not null default false,
  max_months integer not null default 2 check (max_months between 1 and 12)
);

insert into public.booking_settings (id, limit_months, max_months)
values (1, false, 2)
on conflict (id) do nothing;

alter table public.booking_settings enable row level security;
drop policy if exists "Public reads booking settings" on public.booking_settings;
drop policy if exists "Staff manage booking settings" on public.booking_settings;
create policy "Public reads booking settings" on public.booking_settings for select using (true);
create policy "Staff manage booking settings" on public.booking_settings for all to authenticated using (true) with check (true);

create table if not exists public.closed_dates (
  date date primary key
);

alter table public.closed_dates enable row level security;
drop policy if exists "Public reads closed dates" on public.closed_dates;
drop policy if exists "Staff manage closed dates" on public.closed_dates;
create policy "Public reads closed dates" on public.closed_dates for select using (true);
create policy "Staff manage closed dates" on public.closed_dates for all to authenticated using (true) with check (true);

create or replace function public.validate_appointment_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  settings public.booking_settings%rowtype;
  booking_month_limit integer;
  business_today date := timezone('America/Mexico_City', now())::date;
begin
  if new.status = 'cancelada' then
    return new;
  end if;

  if exists (select 1 from public.closed_dates where date = new.appointment_date) then
    raise exception 'La fecha seleccionada no está disponible.' using errcode = '23514';
  end if;

  select * into settings from public.booking_settings where id = 1;
  booking_month_limit := case when coalesce(settings.limit_months, false) then coalesce(settings.max_months, 2) else 12 end;
  if new.appointment_date < business_today or new.appointment_date > (business_today + make_interval(months => booking_month_limit))::date then
    raise exception 'La fecha está fuera del periodo permitido para reservar.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_appointment_date on public.appointments;
create trigger validate_appointment_date
before insert or update of appointment_date on public.appointments
for each row execute function public.validate_appointment_date();

create or replace function public.validate_appointment_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing record;
  new_start integer;
  existing_start integer;
  new_duration integer;
begin
  if new.status = 'cancelada' or new.appointment_time = 'Por orden de llegada' then
    return new;
  end if;

  if new.appointment_time !~ '^(1[0-2]|[1-9]):(00|30)$' then
    raise exception 'La hora seleccionada no es válida.' using errcode = '23514';
  end if;

  new_start := (case
    when split_part(new.appointment_time, ':', 1)::integer between 1 and 7
      then split_part(new.appointment_time, ':', 1)::integer + 12
    else split_part(new.appointment_time, ':', 1)::integer
  end) * 60 + split_part(new.appointment_time, ':', 2)::integer;
  select coalesce((select duration from public.services where name = new.service limit 1), 30)
  into new_duration;

  perform pg_advisory_xact_lock(hashtextextended(new.appointment_date::text || ':' || new.barber, 0));

  for existing in
    select a.id, a.appointment_time, coalesce(s.duration, 30) as duration
    from public.appointments a
    left join public.services s on s.name = a.service
    where a.appointment_date = new.appointment_date
      and a.barber = new.barber
      and a.status <> 'cancelada'
      and a.appointment_time <> 'Por orden de llegada'
      and a.id is distinct from new.id
  loop
    if existing.appointment_time !~ '^(1[0-2]|[1-9]):(00|30)$' then
      continue;
    end if;

    existing_start := (case
      when split_part(existing.appointment_time, ':', 1)::integer between 1 and 7
        then split_part(existing.appointment_time, ':', 1)::integer + 12
      else split_part(existing.appointment_time, ':', 1)::integer
    end) * 60 + split_part(existing.appointment_time, ':', 2)::integer;
    if new_start < existing_start + existing.duration and existing_start < new_start + new_duration then
      raise exception 'El horario se acaba de reservar para este barbero.' using errcode = '23P01';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists validate_appointment_slot on public.appointments;
create trigger validate_appointment_slot
before insert or update of appointment_date, appointment_time, barber, service on public.appointments
for each row execute function public.validate_appointment_slot();

-- El formulario público solo recibe horas reservadas, nunca datos de clientes.
drop function if exists public.booked_appointment_times(date);
drop function if exists public.booked_appointment_times(date, text);
create or replace function public.booked_appointment_times(selected_date date, selected_barber text)
returns table(appointment_time text, duration integer)
language sql
security definer
set search_path = public
as $$
  select a.appointment_time, coalesce(s.duration, 30)
  from public.appointments a
  left join public.services s on s.name = a.service
  where a.appointment_date = selected_date
    and a.barber = selected_barber
    and a.status <> 'cancelada'
    and a.appointment_time <> 'Por orden de llegada';
$$;

grant execute on function public.booked_appointment_times(date, text) to anon, authenticated;

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
