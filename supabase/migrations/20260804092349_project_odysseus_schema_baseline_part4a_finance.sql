create table if not exists public.adjustments (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id),
  pay_period_id uuid not null references public.pay_periods(id),
  type public.adjustment_type not null,
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null,
  status public.adjustment_status not null default 'approved',
  created_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  void_reason text,
  related_session_id uuid references public.sessions(id)
);

alter table public.adjustments add column if not exists approved_by uuid references public.profiles(id);
alter table public.adjustments add column if not exists voided_by uuid references public.profiles(id);
alter table public.adjustments add column if not exists created_by uuid not null references public.profiles(id);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id),
  period_start date not null,
  period_end date not null,
  invoice_number text not null unique,
  total_amount numeric(12, 2) not null,
  status public.invoice_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  session_id uuid references public.sessions(id),
  adjustment_id uuid references public.adjustments(id),
  line_type public.invoice_line_type not null default 'session',
  description text not null,
  minutes int not null,
  rate numeric(12, 2) not null,
  amount numeric(12, 2) not null
);

create index if not exists idx_adjustments_tutor_pay_period on public.adjustments(tutor_id, pay_period_id);
create index if not exists idx_adjustments_pay_period on public.adjustments(pay_period_id);
create index if not exists idx_invoices_tutor_period_start on public.invoices(tutor_id, period_start);
create index if not exists idx_invoice_lines_invoice on public.invoice_lines(invoice_id);
create index if not exists idx_invoice_lines_session on public.invoice_lines(session_id);
create index if not exists idx_invoice_lines_adjustment on public.invoice_lines(adjustment_id);

alter table public.pay_periods enable row level security;
alter table public.adjustments enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;

drop policy if exists "admin_select_pay_periods" on public.pay_periods;
create policy "admin_select_pay_periods"
on public.pay_periods for select
using (public.is_platform_admin());

drop policy if exists "pay_periods_no_direct_insert" on public.pay_periods;
create policy "pay_periods_no_direct_insert"
on public.pay_periods for insert
with check (false);

drop policy if exists "pay_periods_no_direct_update" on public.pay_periods;
create policy "pay_periods_no_direct_update"
on public.pay_periods for update
using (false)
with check (false);

drop policy if exists "pay_periods_no_direct_delete" on public.pay_periods;
create policy "pay_periods_no_direct_delete"
on public.pay_periods for delete
using (false);

drop policy if exists "admin_select_all_adjustments" on public.adjustments;
create policy "admin_select_all_adjustments"
on public.adjustments for select
using (public.is_platform_admin());

drop policy if exists "tutors_select_own_adjustments" on public.adjustments;
create policy "tutors_select_own_adjustments"
on public.adjustments for select
using (tutor_id = public.current_tutor_id());

drop policy if exists "adjustments_no_direct_insert" on public.adjustments;
create policy "adjustments_no_direct_insert"
on public.adjustments for insert
with check (false);

drop policy if exists "adjustments_no_direct_update" on public.adjustments;
create policy "adjustments_no_direct_update"
on public.adjustments for update
using (false)
with check (false);

drop policy if exists "adjustments_no_direct_delete" on public.adjustments;
create policy "adjustments_no_direct_delete"
on public.adjustments for delete
using (false);

drop policy if exists "admin_select_all_invoices" on public.invoices;
create policy "admin_select_all_invoices"
on public.invoices for select
using (public.is_platform_admin());

drop policy if exists "tutors_select_own_invoices" on public.invoices;
create policy "tutors_select_own_invoices"
on public.invoices for select
using (tutor_id = public.current_tutor_id());

drop policy if exists "invoices_no_direct_insert" on public.invoices;
create policy "invoices_no_direct_insert"
on public.invoices for insert
with check (false);

drop policy if exists "invoices_no_direct_update" on public.invoices;
create policy "invoices_no_direct_update"
on public.invoices for update
using (false)
with check (false);

drop policy if exists "invoices_no_direct_delete" on public.invoices;
create policy "invoices_no_direct_delete"
on public.invoices for delete
using (false);

drop policy if exists "admin_select_all_invoice_lines" on public.invoice_lines;
create policy "admin_select_all_invoice_lines"
on public.invoice_lines for select
using (public.is_platform_admin());

drop policy if exists "tutors_select_own_invoice_lines" on public.invoice_lines;
create policy "tutors_select_own_invoice_lines"
on public.invoice_lines for select
using (exists (
  select 1 from public.invoices i
  where i.id = invoice_lines.invoice_id
    and i.tutor_id = public.current_tutor_id()
));

drop policy if exists "invoice_lines_no_direct_insert" on public.invoice_lines;
create policy "invoice_lines_no_direct_insert"
on public.invoice_lines for insert
with check (false);

drop policy if exists "invoice_lines_no_direct_update" on public.invoice_lines;
create policy "invoice_lines_no_direct_update"
on public.invoice_lines for update
using (false)
with check (false);

drop policy if exists "invoice_lines_no_direct_delete" on public.invoice_lines;
create policy "invoice_lines_no_direct_delete"
on public.invoice_lines for delete
using (false);

create or replace function public.get_or_create_pay_period(p_period_start_date date)
returns public.pay_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.pay_periods;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.pay_periods (period_start_date, period_end_date, status)
  values (p_period_start_date, p_period_start_date + 6, 'open')
  on conflict (period_start_date) do nothing;

  select * into v_period
  from public.pay_periods
  where period_start_date = p_period_start_date;

  return v_period;
end;
$$;

create or replace function public.generate_payroll_week(p_week_start date)
returns setof public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_end date := p_week_start + 6;
  v_period public.pay_periods;
  v_tutor record;
  v_line record;
  v_adj record;
  v_invoice public.invoices;
  v_invoice_number text;
  v_total numeric(12, 2);
  v_amount numeric(12, 2);
  v_signed numeric(12, 2);
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if exists (select 1 from public.invoices where period_start = p_week_start) then
    raise exception 'invoices_already_generated' using errcode = '23505';
  end if;

  v_period := public.get_or_create_pay_period(p_week_start);
  if v_period.status = 'locked' then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  for v_tutor in
    select distinct t.id as tutor_id, t.hourly_rate
    from public.tutors t
    where exists (
      select 1 from public.sessions s
      where s.tutor_id = t.id
        and s.status = 'approved'
        and s.date between p_week_start and v_week_end
    )
    or exists (
      select 1 from public.adjustments a
      where a.tutor_id = t.id
        and a.pay_period_id = v_period.id
        and a.status = 'approved'
        and a.voided_at is null
    )
  loop
    v_total := 0;
    v_invoice_number := 'INV-' || replace(p_week_start::text, '-', '') || '-' || substr(v_tutor.tutor_id::text, 1, 8);

    insert into public.invoices (tutor_id, period_start, period_end, invoice_number, total_amount, status)
    values (v_tutor.tutor_id, p_week_start, v_week_end, v_invoice_number, 0, 'issued')
    returning * into v_invoice;

    for v_line in
      select s.id as session_id,
             s.duration_minutes,
             s.date,
             s.start_time,
             s.end_time,
             coalesce(alloc.rate_override, v_tutor.hourly_rate) as rate,
             pr.full_name as student_name,
             subj.name as subject_name
      from public.sessions s
      join public.tutor_student_allocations alloc on alloc.id = s.tutor_student_allocation_id
      join public.students st on st.id = s.student_id
      join public.profiles pr on pr.id = st.profile_id
      left join public.subjects subj on subj.id = alloc.subject_id
      where s.tutor_id = v_tutor.tutor_id
        and s.status = 'approved'
        and s.date between p_week_start and v_week_end
      order by s.date asc, s.start_time asc
    loop
      v_amount := (v_line.duration_minutes / 60.0) * v_line.rate;
      v_total := v_total + v_amount;
      insert into public.invoice_lines
        (invoice_id, session_id, adjustment_id, line_type, description, minutes, rate, amount)
      values (
        v_invoice.id, v_line.session_id, null, 'session',
        coalesce(v_line.subject_name, 'Session') || ' - ' || coalesce(v_line.student_name, 'Student')
          || ' (' || v_line.date::text || ' ' || v_line.start_time::text || '-' || v_line.end_time::text || ')',
        v_line.duration_minutes, v_line.rate, v_amount
      );
    end loop;

    for v_adj in
      select a.id, a.type, a.amount, a.reason
      from public.adjustments a
      where a.tutor_id = v_tutor.tutor_id
        and a.pay_period_id = v_period.id
        and a.status = 'approved'
        and a.voided_at is null
      order by a.created_at asc
    loop
      v_signed := case when v_adj.type = 'penalty' then -abs(v_adj.amount) else abs(v_adj.amount) end;
      v_total := v_total + v_signed;
      insert into public.invoice_lines
        (invoice_id, session_id, adjustment_id, line_type, description, minutes, rate, amount)
      values (
        v_invoice.id, null, v_adj.id, 'adjustment',
        'Adjustment (' || v_adj.type::text || '): ' || v_adj.reason,
        0, 0, v_signed
      );
    end loop;

    update public.invoices set total_amount = v_total where id = v_invoice.id;
    v_invoice.total_amount := v_total;
    return next v_invoice;
  end loop;

  return;
end;
$$;

create or replace function public.lock_pay_period(p_week_start date)
returns public.pay_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.pay_periods;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_period := public.get_or_create_pay_period(p_week_start);

  if v_period.status = 'locked' then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.sessions
    where status = 'submitted'
      and date between p_week_start and p_week_start + 6
  ) then
    raise exception 'pending_sessions' using errcode = '42501';
  end if;

  if not exists (select 1 from public.invoices where period_start = p_week_start) then
    perform public.generate_payroll_week(p_week_start);
  end if;

  update public.pay_periods
  set status = 'locked', locked_at = now(), locked_by = public.current_profile_id()
  where period_start_date = p_week_start
  returning * into v_period;

  return v_period;
end;
$$;

create or replace function public.create_adjustment(
  p_tutor_id uuid,
  p_type public.adjustment_type,
  p_amount numeric,
  p_reason text,
  p_related_session_id uuid,
  p_week_start date
)
returns public.adjustments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.pay_periods;
  v_adj public.adjustments;
  v_profile uuid := public.current_profile_id();
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.tutors where id = p_tutor_id) then
    raise exception 'tutor_not_found' using errcode = 'P0002';
  end if;

  if p_related_session_id is not null then
    if not exists (
      select 1 from public.sessions
      where id = p_related_session_id
        and tutor_id = p_tutor_id
        and date between p_week_start and p_week_start + 6
    ) then
      raise exception 'related_session_invalid' using errcode = '23514';
    end if;
  end if;

  v_period := public.get_or_create_pay_period(p_week_start);

  insert into public.adjustments
    (tutor_id, pay_period_id, type, amount, reason, status, created_by, approved_by, approved_at, related_session_id)
  values
    (p_tutor_id, v_period.id, p_type, p_amount, p_reason, 'approved', v_profile, v_profile, now(), p_related_session_id)
  returning * into v_adj;

  return v_adj;
end;
$$;

create or replace function public.void_adjustment(p_adjustment_id uuid, p_reason text)
returns public.adjustments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adj public.adjustments;
  v_period_status public.pay_period_status;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_adj from public.adjustments where id = p_adjustment_id;
  if not found then
    raise exception 'adjustment_not_found' using errcode = 'P0002';
  end if;

  select status into v_period_status from public.pay_periods where id = v_adj.pay_period_id;
  if v_period_status = 'locked' then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if v_adj.voided_at is not null then
    raise exception 'adjustment_already_voided' using errcode = '42501';
  end if;

  update public.adjustments
  set voided_at = now(),
      voided_by = public.current_profile_id(),
      void_reason = coalesce(p_reason, 'deleted_by_admin')
  where id = p_adjustment_id
  returning * into v_adj;

  return v_adj;
end;
$$;

create or replace function public.get_pay_period_integrity(p_week_start date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_end date := p_week_start + 6;
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'payPeriod', (
      select coalesce(
        (select jsonb_build_object('id', id, 'status', status) from public.pay_periods where period_start_date = p_week_start),
        jsonb_build_object('status', 'open')
      )
    ),
    'overlaps', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'session_id', s1.id, 'tutor_id', s1.tutor_id, 'student_id', s1.student_id,
        'date', s1.date, 'start_time', s1.start_time, 'end_time', s1.end_time,
        'overlap_id', s2.id
      )), '[]'::jsonb)
      from public.sessions s1
      join public.sessions s2
        on s1.tutor_id = s2.tutor_id
       and s1.id < s2.id
       and s1.date = s2.date
       and not (s1.end_time <= s2.start_time or s1.start_time >= s2.end_time)
      where s1.date between p_week_start and v_week_end
    ),
    'outsideAssignmentWindow', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'tutor_id', s.tutor_id, 'student_id', s.student_id,
        'date', s.date, 'start_time', s.start_time, 'end_time', s.end_time
      )), '[]'::jsonb)
      from public.sessions s
      join public.tutor_student_allocations a on a.id = s.tutor_student_allocation_id
      where s.date between p_week_start and v_week_end
        and not public.session_within_allocation_window(
          s.date, s.start_time, s.end_time,
          a.start_date, a.end_date, a.allowed_days_json, a.allowed_time_ranges_json
        )
    ),
    'missingInvoiceLines', (
      select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'tutor_id', s.tutor_id, 'date', s.date)), '[]'::jsonb)
      from public.sessions s
      left join public.invoice_lines l on l.session_id = s.id and l.line_type = 'session'
      where s.status = 'approved'
        and s.date between p_week_start and v_week_end
        and l.id is null
    ),
    'invoiceTotalMismatches', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'invoice_number', m.invoice_number, 'total_amount', m.total_amount, 'line_total', m.line_total
      )), '[]'::jsonb)
      from (
        select i.id, i.invoice_number, i.total_amount, coalesce(sum(l.amount), 0) as line_total
        from public.invoices i
        left join public.invoice_lines l on l.invoice_id = i.id
        where i.period_start = p_week_start
        group by i.id
        having i.total_amount <> coalesce(sum(l.amount), 0)
      ) m
    ),
    'pendingSubmissions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tutor_id', p.tutor_id, 'tutor_name', p.tutor_name, 'pending', p.pending
      ) order by p.tutor_name asc), '[]'::jsonb)
      from (
        select s.tutor_id, pr.full_name as tutor_name, count(*) as pending
        from public.sessions s
        join public.tutors t on t.id = s.tutor_id
        join public.profiles pr on pr.id = t.profile_id
        where s.status = 'submitted'
          and s.date between p_week_start and v_week_end
        group by s.tutor_id, pr.full_name
      ) p
    ),
    'duplicateSessions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tutor_id', d.tutor_id, 'student_id', d.student_id, 'date', d.date,
        'start_time', d.start_time, 'end_time', d.end_time, 'count', d.cnt
      ) order by d.date asc), '[]'::jsonb)
      from (
        select tutor_id, student_id, date, start_time, end_time, count(*) as cnt
        from public.sessions
        where date between p_week_start and v_week_end
        group by tutor_id, student_id, date, start_time, end_time
        having count(*) > 1
      ) d
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_or_create_pay_period(date) to authenticated;
grant execute on function public.generate_payroll_week(date) to authenticated;
grant execute on function public.lock_pay_period(date) to authenticated;
grant execute on function public.create_adjustment(uuid, public.adjustment_type, numeric, text, uuid, date) to authenticated;
grant execute on function public.void_adjustment(uuid, text) to authenticated;
grant execute on function public.get_pay_period_integrity(date) to authenticated;;
