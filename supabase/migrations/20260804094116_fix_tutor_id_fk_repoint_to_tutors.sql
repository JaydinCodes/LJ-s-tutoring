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
  foreign key (tutor_id) references public.tutors(id) on delete cascade;;
