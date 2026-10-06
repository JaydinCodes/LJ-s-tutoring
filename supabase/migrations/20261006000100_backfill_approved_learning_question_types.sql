-- Backfill learner-facing question types without changing answer keys or other
-- answer configuration. Ambiguous content remains untouched for human review.

with candidates as (
  select
    version.id,
    version.answer_config,
    case
      when version.answer_config ? 'options'
        and nullif(btrim(coalesce(version.answer_config ->> 'correct_option', '')), '') is not null
        then 'multiple_choice'
      when answer.value ~ '^[+-]?[0-9]+\s*/\s*[+-]?[0-9]+$'
        then 'fraction'
      when answer.value ~ '^\(\s*[+-]?[0-9]+(?:\.[0-9]+)?\s*[,;]\s*[+-]?[0-9]+(?:\.[0-9]+)?\s*\)$'
        then 'coordinate'
      when version.prompt ~* '^\s*solve\M'
        and answer.value ~ '^[[:alpha:]]\s*=\s*[+-]?[0-9]+(?:\.[0-9]+)?$'
        then 'linear_equation_solution'
      when version.prompt ~* '\Mfactoris'
        or answer.value ~ '^\([^()]+\)\s*\([^()]+\)$'
        then 'factorised_expression'
      when answer.value ~ '^[+-]?[0-9]+(?:\.[0-9]+)?$'
        then 'numeric'
      when answer.value ~ '[[:alpha:]]'
        and answer.value ~ '(\^[0-9]+|[0-9][[:alpha:]]|[[:alpha:]][0-9])'
        then 'algebraic_expression'
      else null
    end as question_type
  from public.question_versions version
  left join lateral (
    select value
    from jsonb_array_elements_text(coalesce(version.answer_config -> 'accepted_answers', version.answer_config -> 'accepted', '[]'::jsonb))
    limit 1
  ) answer on true
  where version.review_status = 'approved'
    and nullif(btrim(coalesce(version.answer_config ->> 'type', '')), '') is null
)
update public.question_versions version
set answer_config = version.answer_config || jsonb_build_object('type', candidates.question_type)
from candidates
where version.id = candidates.id
  and candidates.question_type is not null;

do $$
declare
  v_backfilled integer;
  v_manual_review integer;
begin
  select count(*) into v_backfilled
  from public.question_versions
  where review_status = 'approved'
    and answer_config ? 'type';

  select count(*) into v_manual_review
  from public.question_versions
  where review_status = 'approved'
    and nullif(btrim(coalesce(answer_config ->> 'type', '')), '') is null;

  raise notice 'Approved learning questions with an explicit type: %; manual review required: %.', v_backfilled, v_manual_review;
end;
$$;

-- Manual-review audit (intentionally no guessing):
-- select version.id, item.item_code, version.prompt, version.answer_config
-- from public.question_versions version
-- join public.question_items item on item.id = version.question_item_id
-- where version.review_status = 'approved'
--   and nullif(btrim(coalesce(version.answer_config ->> 'type', '')), '') is null
-- order by item.item_code, version.version_number;
