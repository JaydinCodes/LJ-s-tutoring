# Supabase Backup, PITR, And Restore Verification

This is the production recovery procedure for Project Odysseus' Supabase
Postgres database and Supabase Storage. It replaces the retired Fastify/Prisma
backup scripts. Do not describe a restore as verified until the evidence listed
below has been recorded from an isolated exercise.

## Objectives and ownership

- **RPO:** at most 15 minutes for database records, subject to the backup/PITR
  entitlement of the production Supabase plan.
- **RTO:** 60 minutes for a usable, security-verified restore target.
- **Recovery lead:** the production release lead. A separate verifier performs
  the post-restore access checks.
- **Authoritative sources:** Supabase dashboard backup/PITR controls and the
  `assignment-files`, `assignment-submissions`, and `tutor-documents` Storage
  buckets. Database PITR does not replace Storage-object recovery.

Before accepting these objectives, the release lead must record the production
project's actual backup/PITR entitlement, recovery window, region, and support
path in the drill evidence. Do not infer those details from this repository.

## Preconditions

1. Freeze production writes or put the application into the approved read-only
   incident mode. Preserve the incident timestamp in UTC.
2. Open a recovery incident, name the recovery lead and independent verifier,
   and capture the desired recovery point in UTC.
3. Confirm that the restore target is an isolated project/environment with its
   own URL, Auth configuration, secrets, and no production webhooks, cron jobs,
   email, or payment integrations enabled.
4. Record the current production release SHA, the last successful release-gate
   artifact, and the current Supabase migration history.
5. List the Storage prefixes required for the drill. Never copy a production
   bucket into a public bucket or use production client keys in the target.

## Database recovery

1. In Supabase, create an isolated restore target using the managed backup or
   point-in-time-recovery flow for the selected UTC point. Use Supabase Support
   if the plan/dashboard does not expose self-service recovery.
2. Restrict target project access to the recovery team. Rotate or remove any
   inherited service keys before application access begins.
3. Compare the restored target's migration history with the recorded source
   history. Do not run `supabase db push` blindly against a restored target;
   first account for every migration that occurred after the chosen recovery
   point.
4. Link the local CLI only to the isolated project and run the non-destructive
   checks that apply to that target: `npm run supabase:types:check`, the
   migration-history comparison, and the protected RLS test plan. Never point
   a drill command at production by copying a target URL into an environment
   file.
5. Verify critical objects: `profiles`, `students`, `tutors`, active
   allocations, `audit_log`, released submission records, and the recovery
   scheduler assertions used by the deployment workflow.

## Storage recovery

1. Inventory the expected objects and checksums/prefix counts before recovery.
2. Restore only to the isolated target's private buckets using the approved
   Storage backup/export mechanism. Preserve bucket privacy; do not use public
   URLs as a verification shortcut.
3. Sample each protected bucket using a service credential in the isolated
   target and confirm that a student, tutor, and parent session cannot read an
   object outside its policy scope.
4. Compare counts and selected object hashes/prefixes with the source
   inventory. Record every expected omission caused by the chosen point in
   time.

## Acceptance checks

- The target accepts only its own Auth credentials and secrets.
- An AAL2 admin can read the expected operational records; cross-organisation
  users receive zero unauthorised rows.
- A learner sees only released marks and feedback; a parent sees only linked
  learner reports.
- Tutor allocation is blocked unless the tutor has an approved, unexpired
  vetting record.
- Private Storage buckets remain private and their RLS policies work on the
  restored target.
- No target scheduler, Edge Function, webhook, or integration can contact a
  real learner or production provider.

## Evidence required for a successful drill

Record the following in the incident/change system, not in the repository:

- source project and isolated target identifiers (redact secrets), UTC recovery
  point, start/end times, and measured RPO/RTO;
- operators, independent verifier, and approval to destroy the target;
- Supabase backup/PITR screenshots or support ticket, migration-history
  comparison, and Storage inventory comparison;
- output from the access/security acceptance checks and any deviations;
- a signed pass/fail decision, follow-up owner, and due date.

Destroy the isolated target and revoke drill credentials after evidence is
accepted. A drill with missing evidence is **not verified**.
