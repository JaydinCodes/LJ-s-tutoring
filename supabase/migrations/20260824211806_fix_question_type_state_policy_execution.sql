-- The helper is deliberately not client-executable, including from an RLS
-- expression. Repeat the established allocation predicate without touching
-- tutor-inaccessible taxonomy tables.
drop policy "adaptive_tutor_read_allocated_question_type_states" on public.learner_question_type_state;
create policy "adaptive_tutor_read_allocated_question_type_states"
  on public.learner_question_type_state for select to authenticated
  using (
    exists (
      select 1 from public.tutor_student_allocations allocation
      where allocation.student_id = learner_question_type_state.student_id
        and allocation.tutor_id = public.current_tutor_id()
        and allocation.status = 'active'
    )
  );
