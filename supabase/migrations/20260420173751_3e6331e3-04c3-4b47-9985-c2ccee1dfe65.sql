-- Pin search_path on trigger function
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin new.updated_at = now(); return new; end $$;

-- Tighten bookings insert policy
drop policy if exists "bookings public insert" on public.bookings;

create policy "bookings public insert validated"
on public.bookings
for insert
with check (
  length(coalesce(customer_name, '')) between 1 and 200
  and length(coalesce(customer_phone, '')) between 5 and 30
  and end_time > start_time
  and exists (
    select 1 from public.salons s where s.id = bookings.salon_id
  )
  and exists (
    select 1 from public.barbers b
    where b.id = bookings.barber_id
      and b.salon_id = bookings.salon_id
      and b.is_active = true
  )
  and exists (
    select 1 from public.services sv
    where sv.id = bookings.service_id
      and sv.salon_id = bookings.salon_id
      and sv.is_active = true
  )
);