-- FIN-01..04: Payroll periods are Monday-to-Sunday, cannot overlap, and are
-- closed from a freshly rebuilt invoice set in the same transaction.
--
-- Existing periods were checked before this migration was introduced. Refuse
-- to guess how to merge or re-date historical finance records if that ever
-- stops being true.
do $$
begin
  if exists (
    select 1
    from public.pay_periods
    where extract(isodow from period_start_date) <> 1
       or period_end_date <> period_start_date + 6
  ) then
    raise exception 'pay_period_normalization_required'
      using errcode = '23514',
            hint = 'Resolve malformed historical pay periods before enforcing Monday-to-Sunday payroll periods.';
  end if;

  if exists (
    select 1
    from public.pay_periods a
    join public.pay_periods b
      on a.id < b.id
     and daterange(a.period_start_date, a.period_end_date, '[]')
         && daterange(b.period_start_date, b.period_end_date, '[]')
  ) then
    raise exception 'overlapping_pay_periods_exist'
      using errcode = '23514',
            hint = 'Resolve overlapping historical pay periods before enforcing the exclusion constraint.';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pay_periods'::regclass
      and conname = 'pay_periods_start_monday'
  ) then
    alter table public.pay_periods
      add constraint pay_periods_start_monday
      check (extract(isodow from period_start_date) = 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pay_periods'::regclass
      and conname = 'pay_periods_exactly_seven_days'
  ) then
    alter table public.pay_periods
      add constraint pay_periods_exactly_seven_days
      check (period_end_date = period_start_date + 6);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pay_periods'::regclass
      and conname = 'pay_periods_no_overlapping_dates'
  ) then
    alter table public.pay_periods
      add constraint pay_periods_no_overlapping_dates
      exclude using gist (
        daterange(period_start_date, period_end_date, '[]') with &&
      );
  end if;
end
$$;

-- A single normalization rule is used by every payroll read/write RPC. This
-- keeps direct API callers on the same Monday week as the admin interface.
create or replace function public.payroll_week_start(p_date date)
returns date
language sql
immutable
set search_path = ''
as $$
  select date_trunc('week', p_date::timestamp)::date
$$;

revoke execute on function public.payroll_week_start(date) from public, anon, authenticated;

create or replace function public.get_or_create_pay_period(p_period_start_date date)
returns public.pay_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date := public.payroll_week_start(p_period_start_date);
  v_period public.pay_periods;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.pay_periods (period_start_date, period_end_date, status)
  values (v_week_start, v_week_start + 6, 'open')
  on conflict (period_start_date) do nothing;

  select * into v_period
  from public.pay_periods
  where period_start_date = v_week_start;

  return v_period;
end;
$$;

-- Used by the close, approval, and adjustment paths. The advisory lock
-- serializes mutations that affect one payroll week even when no period row
-- existed when an approval began.
create or replace function public.lock_payroll_week_mutation(p_week_start date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'payroll-week:' || public.payroll_week_start(p_week_start)::text,
    0
  ));
end;
$$;

revoke execute on function public.lock_payroll_week_mutation(date) from public, anon, authenticated;

create or replace function public.get_pay_period_integrity(p_week_start date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date := public.payroll_week_start(p_week_start);
  v_week_end date := v_week_start + 6;
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'normalizedWeekStart', v_week_start,
    'payPeriod', coalesce(
      (select jsonb_build_object('id', id, 'status', status)
       from public.pay_periods where period_start_date = v_week_start),
      jsonb_build_object('status', 'open')
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
      where s1.date between v_week_start and v_week_end
    ),
    'outsideAssignmentWindow', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'tutor_id', s.tutor_id, 'student_id', s.student_id,
        'date', s.date, 'start_time', s.start_time, 'end_time', s.end_time
      )), '[]'::jsonb)
      from public.sessions s
      join public.tutor_student_allocations a on a.id = s.tutor_student_allocation_id
      where s.date between v_week_start and v_week_end
        and not public.session_within_allocation_window(
          s.date, s.start_time, s.end_time,
          a.start_date, a.end_date, a.allowed_days_json, a.allowed_time_ranges_json
        )
    ),
    'missingInvoiceLines', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'tutor_id', s.tutor_id, 'date', s.date
      )), '[]'::jsonb)
      from public.sessions s
      left join public.invoice_lines l on l.session_id = s.id and l.line_type = 'session'
      where s.status = 'approved'
        and s.date between v_week_start and v_week_end
        and l.id is null
    ),
    'invoiceTotalMismatches', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'invoice_number', m.invoice_number,
        'total_amount', m.total_amount, 'line_total', m.line_total
      )), '[]'::jsonb)
      from (
        select i.id, i.invoice_number, i.total_amount, coalesce(sum(l.amount), 0) as line_total
        from public.invoices i
        left join public.invoice_lines l on l.invoice_id = i.id
        where i.period_start = v_week_start
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
          and s.date between v_week_start and v_week_end
        group by s.tutor_id, pr.full_name
      ) p
    ),
    'missingRates', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'session_id', s.id, 'tutor_id', s.tutor_id,
        'tutor_name', pr.full_name, 'date', s.date,
        'hourly_rate', t.hourly_rate, 'rate_override', alloc.rate_override
      ) order by s.date asc, pr.full_name asc), '[]'::jsonb)
      from public.sessions s
      join public.tutors t on t.id = s.tutor_id
      join public.profiles pr on pr.id = t.profile_id
      left join public.tutor_student_allocations alloc on alloc.id = s.tutor_student_allocation_id
      where s.status = 'approved'
        and s.date between v_week_start and v_week_end
        and coalesce(alloc.rate_override, t.hourly_rate) is null
    ),
    'duplicateSessions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tutor_id', d.tutor_id, 'student_id', d.student_id, 'date', d.date,
        'start_time', d.start_time, 'end_time', d.end_time, 'count', d.cnt
      ) order by d.date asc), '[]'::jsonb)
      from (
        select tutor_id, student_id, date, start_time, end_time, count(*) as cnt
        from public.sessions
        where date between v_week_start and v_week_end
        group by tutor_id, student_id, date, start_time, end_time
        having count(*) > 1
      ) d
    ),
    'canClose', not exists (
      select 1 from public.sessions s
      where s.status = 'submitted'
        and s.date between v_week_start and v_week_end
    ) and not exists (
      select 1
      from public.sessions s
      join public.tutors t on t.id = s.tutor_id
      left join public.tutor_student_allocations alloc on alloc.id = s.tutor_student_allocation_id
      where s.status = 'approved'
        and s.date between v_week_start and v_week_end
        and coalesce(alloc.rate_override, t.hourly_rate) is null
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.generate_payroll_week(p_week_start date)
returns setof public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date := public.payroll_week_start(p_week_start);
  v_week_end date := v_week_start + 6;
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

  perform public.lock_payroll_week_mutation(v_week_start);
  v_period := public.get_or_create_pay_period(v_week_start);

  select * into v_period
  from public.pay_periods
  where id = v_period.id
  for update;

  if v_period.status = 'locked' then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.sessions s
    join public.tutors t on t.id = s.tutor_id
    left join public.tutor_student_allocations alloc on alloc.id = s.tutor_student_allocation_id
    where s.status = 'approved'
      and s.date between v_week_start and v_week_end
      and coalesce(alloc.rate_override, t.hourly_rate) is null
  ) then
    raise exception 'missing_tutor_rate'
      using errcode = '23514',
            hint = 'Use get_pay_period_integrity() to identify each approved session without an effective tutor rate.';
  end if;

  -- Open-period invoices are a deterministic draft. Rebuild them so sessions
  -- and approved/voided adjustments added since the prior refresh are included.
  delete from public.invoice_lines l
  using public.invoices i
  where l.invoice_id = i.id
    and i.period_start = v_week_start;

  delete from public.invoices
  where period_start = v_week_start;

  for v_tutor in
    select distinct t.id as tutor_id, t.hourly_rate
    from public.tutors t
    where exists (
      select 1 from public.sessions s
      where s.tutor_id = t.id
        and s.status = 'approved'
        and s.date between v_week_start and v_week_end
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
    v_invoice_number := 'INV-' || replace(v_week_start::text, '-', '') || '-' || substr(v_tutor.tutor_id::text, 1, 8);

    insert into public.invoices (tutor_id, period_start, period_end, invoice_number, total_amount, status)
    values (v_tutor.tutor_id, v_week_start, v_week_end, v_invoice_number, 0, 'issued')
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
        and s.date between v_week_start and v_week_end
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
  v_week_start date := public.payroll_week_start(p_week_start);
  v_period public.pay_periods;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform public.lock_payroll_week_mutation(v_week_start);
  v_period := public.get_or_create_pay_period(v_week_start);

  select * into v_period
  from public.pay_periods
  where id = v_period.id
  for update;

  if v_period.status = 'locked' then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.sessions
    where status = 'submitted'
      and date between v_week_start and v_week_start + 6
  ) then
    raise exception 'pending_sessions' using errcode = '42501';
  end if;

  -- This rebuild is part of the same transaction as the lock. A failed rate
  -- preflight or invoice insert rolls back both the draft replacement and lock.
  perform public.generate_payroll_week(v_week_start);

  update public.pay_periods
  set status = 'locked', locked_at = now(), locked_by = public.current_profile_id()
  where id = v_period.id
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
  v_week_start date := public.payroll_week_start(p_week_start);
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

  perform public.lock_payroll_week_mutation(v_week_start);
  v_period := public.get_or_create_pay_period(v_week_start);

  select * into v_period
  from public.pay_periods
  where id = v_period.id
  for update;

  if v_period.status = 'locked' then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if p_related_session_id is not null then
    if not exists (
      select 1 from public.sessions
      where id = p_related_session_id
        and tutor_id = p_tutor_id
        and date between v_week_start and v_week_start + 6
    ) then
      raise exception 'related_session_invalid' using errcode = '23514';
    end if;
  end if;

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
  v_period public.pay_periods;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_adj from public.adjustments where id = p_adjustment_id;
  if not found then
    raise exception 'adjustment_not_found' using errcode = 'P0002';
  end if;

  select * into v_period from public.pay_periods where id = v_adj.pay_period_id;
  if not found then
    raise exception 'pay_period_not_found' using errcode = 'P0002';
  end if;

  perform public.lock_payroll_week_mutation(v_period.period_start_date);
  select * into v_period from public.pay_periods where id = v_period.id for update;

  if v_period.status = 'locked' then
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

create or replace function public.approve_session(p_session_id uuid)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.sessions%rowtype;
  v_updated public.sessions%rowtype;
  v_subject text;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_current
  from public.sessions
  where id = p_session_id;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;

  perform public.lock_payroll_week_mutation(v_current.date);

  select * into v_current
  from public.sessions
  where id = p_session_id
  for update;

  if not exists (
    select 1 from public.tutors t
    where t.id = v_current.tutor_id
      and t.status = 'active'
      and t.approval_status = 'approved'
  ) then
    raise exception 'tutor_not_active' using errcode = '42501';
  end if;

  if public.session_date_pay_period_locked(v_current.date) then
    raise exception 'pay_period_locked' using errcode = '42501';
  end if;

  if v_current.status <> 'submitted' then
    raise exception 'only_submitted_approvable';
  end if;

  if not exists (
    select 1
    from public.tutor_student_allocations alloc
    join public.tutors t on t.id = v_current.tutor_id
    where alloc.id = v_current.tutor_student_allocation_id
      and coalesce(alloc.rate_override, t.hourly_rate) is not null
  ) then
    raise exception 'effective_tutor_rate_required'
      using errcode = '23514',
            hint = 'Set the tutor hourly rate or this allocation rate override before approving the session.';
  end if;

  update public.sessions set
    status = 'approved',
    approved_at = now(),
    approved_by = public.current_profile_id()
  where id = p_session_id
  returning * into v_updated;

  select subj.name into v_subject
  from public.tutor_student_allocations alloc
  left join public.subjects subj on subj.id = alloc.subject_id
  where alloc.id = v_current.tutor_student_allocation_id;
  perform public.create_student_notification(
    v_current.student_id,
    'session_approved',
    'Session approved',
    coalesce(v_subject, 'Your session') || ' on ' || v_current.date::text || ' was approved.',
    '/dashboard/',
    'session',
    p_session_id,
    '{}'::jsonb
  );
  perform public.insert_session_history(p_session_id, 'approve', to_jsonb(v_current), to_jsonb(v_updated));
  return v_updated;
end;
$$;

revoke execute on function public.get_or_create_pay_period(date) from public, anon;
revoke execute on function public.generate_payroll_week(date) from public, anon;
revoke execute on function public.lock_pay_period(date) from public, anon;
revoke execute on function public.create_adjustment(uuid, public.adjustment_type, numeric, text, uuid, date) from public, anon;
revoke execute on function public.void_adjustment(uuid, text) from public, anon;
revoke execute on function public.get_pay_period_integrity(date) from public, anon;
revoke execute on function public.approve_session(uuid) from public, anon;

grant execute on function public.get_or_create_pay_period(date) to authenticated;
grant execute on function public.generate_payroll_week(date) to authenticated;
grant execute on function public.lock_pay_period(date) to authenticated;
grant execute on function public.create_adjustment(uuid, public.adjustment_type, numeric, text, uuid, date) to authenticated;
grant execute on function public.void_adjustment(uuid, text) to authenticated;
grant execute on function public.get_pay_period_integrity(date) to authenticated;
grant execute on function public.approve_session(uuid) to authenticated;
