do $$
begin
  if not exists (select 1 from pg_type where typname = 'pay_period_status') then
    create type public.pay_period_status as enum ('open', 'locked');
  end if;
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type public.invoice_status as enum ('draft', 'issued', 'paid');
  end if;
  if not exists (select 1 from pg_type where typname = 'adjustment_type') then
    create type public.adjustment_type as enum ('bonus', 'correction', 'penalty');
  end if;
  if not exists (select 1 from pg_type where typname = 'adjustment_status') then
    create type public.adjustment_status as enum ('draft', 'approved');
  end if;
  if not exists (select 1 from pg_type where typname = 'invoice_line_type') then
    create type public.invoice_line_type as enum ('session', 'adjustment');
  end if;
end
$$;

create table if not exists public.pay_periods (
  id uuid primary key default gen_random_uuid(),
  period_start_date date not null unique,
  period_end_date date not null,
  status public.pay_period_status not null default 'open',
  locked_at timestamptz,
  locked_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.pay_periods add column if not exists locked_by uuid references public.profiles(id);
alter table public.pay_periods add column if not exists created_at timestamptz not null default now();;
