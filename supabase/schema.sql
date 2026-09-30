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

-- Permite que el formulario público cree una reserva; no permite leer datos de clientes.
create policy "Public booking inserts"
on public.appointments for insert
with check (true);

-- Las cuentas de Supabase autenticadas pueden gestionar las reservas.
create policy "Authenticated staff manage appointments"
on public.appointments for all to authenticated
using (true)
with check (true);
