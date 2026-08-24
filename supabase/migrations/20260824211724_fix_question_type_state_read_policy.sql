-- Do not depend on the tutor-inaccessible taxonomy table inside this policy.
-- The security-definer allocation helper is the authoritative access boundary.
drop policy "adaptive_tutor_read_allocated_question_type_states" on public.learner_question_type_state;
create policy "adaptive_tutor_read_allocated_question_type_states"
  on public.learner_question_type_state for select to authenticated
  using (public.can_manage_learning_for_student(student_id));
