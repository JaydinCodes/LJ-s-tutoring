-- Correction (2026-07-24): the immediately-prior migration
-- (fix_dangling_prisma_users_fk_repoint_to_auth_users) repointed 49 FKs from
-- the dead public.users table to auth.users(id) as a uniform fix. On closer
-- cross-check against docs/supabase/schema.sql (the actual canonical source
-- of truth), 4 of those 49 columns are NOT auth-identity columns at all --
-- they're part of this schema's separate, deliberate "created_by/approved_by/
-- reviewed_by/verified_by, no _user_id suffix" convention that references
-- public.profiles(id), same as everywhere else in the live schema. Those 4
-- got wrongly pointed at auth.users(id) in the previous migration; this
-- corrects them to match schema.sql exactly. (tutor_profiles.approval_reviewed_by
-- was deliberately left on auth.users(id) -- it's on a separate, genuinely
-- dead legacy "tutor_profiles" table that doesn't exist in schema.sql at all,
-- distinct from the live public.tutors.approval_reviewed_by column.)

alter table public.sessions drop constraint sessions_approved_by_fkey;
alter table public.sessions add constraint sessions_approved_by_fkey foreign key (approved_by) references public.profiles(id);

alter table public.tutor_applications drop constraint tutor_applications_reviewed_by_fkey;
alter table public.tutor_applications add constraint tutor_applications_reviewed_by_fkey foreign key (reviewed_by) references public.profiles(id);

alter table public.tutor_documents drop constraint tutor_documents_verified_by_fkey;
alter table public.tutor_documents add constraint tutor_documents_verified_by_fkey foreign key (verified_by) references public.profiles(id);

alter table public.volunteer_logs drop constraint volunteer_logs_verified_by_fkey;
alter table public.volunteer_logs add constraint volunteer_logs_verified_by_fkey foreign key (verified_by) references public.profiles(id);;
