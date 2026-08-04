-- Production-drift fix: sessions, invoices, adjustments, tutor_applications,
-- tutor_documents, tutor_availability_slots, and volunteer_logs all had their
-- tutor_id foreign key pointing at the dead leftover table tutor_profiles(id)
-- instead of the current public.tutors(id). Nothing in this codebase writes
-- to tutor_profiles anymore (tutors are created via onboard_current_user()
-- into public.tutors), so once a real tutor exists, every one of these seven
-- tables would reject any insert/update referencing that tutor with a foreign
-- key violation -- a landmine that stayed invisible only because both tables
-- are currently empty. ON DELETE behavior is preserved exactly per table
-- (NO ACTION for sessions/invoices/adjustments, CASCADE for the tutor-owned
-- application/document/availability/volunteer-log tables), matching what
-- docs/supabase/schema.sql already declares for a fresh install -- this
-- migration only repoints the referenced table on an existing installation
-- where `create table if not exists` could never have touched it.

alter table public.sessions drop constraint if exists sessions_tutor_id_fkey;
alter table public.sessions
  add constraint sessions_tutor_id_fkey
  foreign key (tutor_id) references public.tutors(id);

alter table public.invoices drop constraint if exists invoices_tutor_id_fkey;
alter table public.invoices
  add constraint invoices_tutor_id_fkey
  foreign key (tutor_id) references public.tutors(id);

alter table public.adjustments drop constraint if exists adjustments_tutor_id_fkey;
alter table public.adjustments
  add constraint adjustments_tutor_id_fkey
  foreign key (tutor_id) references public.tutors(id);

alter table public.tutor_applications drop constraint if exists tutor_applications_tutor_id_fkey;
alter table public.tutor_applications
  add constraint tutor_applications_tutor_id_fkey
  foreign key (tutor_id) references public.tutors(id) on delete cascade;

alter table public.tutor_documents drop constraint if exists tutor_documents_tutor_id_fkey;
alter table public.tutor_documents
  add constraint tutor_documents_tutor_id_fkey
  foreign key (tutor_id) references public.tutors(id) on delete cascade;

alter table public.tutor_availability_slots drop constraint if exists tutor_availability_slots_tutor_id_fkey;
alter table public.tutor_availability_slots
  add constraint tutor_availability_slots_tutor_id_fkey
  foreign key (tutor_id) references public.tutors(id) on delete cascade;

alter table public.volunteer_logs drop constraint if exists volunteer_logs_tutor_id_fkey;
alter table public.volunteer_logs
  add constraint volunteer_logs_tutor_id_fkey
  foreign key (tutor_id) references public.tutors(id) on delete cascade;
