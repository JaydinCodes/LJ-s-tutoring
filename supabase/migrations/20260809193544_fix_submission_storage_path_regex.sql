-- REL-01: the prior regex carried four literal backslashes inside a normal SQL
-- string, causing valid `.../submission.pdf` paths to be rejected. Rewrite the
-- two existing RPC definitions with an unambiguous character class for the dot
-- so we preserve their full locking/verification logic and function grants.
do $$
declare
  v_function regprocedure;
  v_definition text;
begin
  foreach v_function in array array[
    'public.confirm_assignment_submission_attempt(uuid,uuid,text,text,text,text,bigint,text)'::regprocedure,
    'public.submit_assignment_submission(uuid,uuid,text,text,text,text,bigint,text)'::regprocedure
  ] loop
    select pg_get_functiondef(v_function) into v_definition;
    v_definition := replace(
      v_definition,
      'submission' || repeat(chr(92), 2) || '.[A-Za-z0-9]+$',
      'submission[.][A-Za-z0-9]+$'
    );
    if v_definition = pg_get_functiondef(v_function) then
      raise exception 'submission_storage_path_regex_not_found for %', v_function;
    end if;
    execute v_definition;
  end loop;
end
$$;

revoke execute on function public.confirm_assignment_submission_attempt(uuid, uuid, text, text, text, text, bigint, text) from public, anon;
revoke execute on function public.submit_assignment_submission(uuid, uuid, text, text, text, text, bigint, text) from public, anon;
grant execute on function public.confirm_assignment_submission_attempt(uuid, uuid, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.submit_assignment_submission(uuid, uuid, text, text, text, text, bigint, text) to authenticated;
