# Data Retention And Deletion

This is the current Supabase control summary. The former Fastify retention job,
`RETENTION_*` API variables, and Prisma backup scripts are retired and must not
be used. See [POPIA_DATA_MAP.md](POPIA_DATA_MAP.md) for the complete inventory,
processors, and open compliance actions.

## Implemented retention RPC

`public.run_retention_cleanup(p_apply boolean default false)` is an
admin-only `SECURITY DEFINER` RPC protected by the authoritative platform-admin
check and defaults to a non-destructive dry run. The current platform-admin
helper does not require AAL2; this remains a separate security decision. Scheduled
apply runs use `public.run_retention_cleanup_scheduled()`, which is executable
only by `service_role` and also validates the signed JWT role claim. The shared
destructive worker lives in the non-exposed `private` schema and has no API-role
`EXECUTE` grants. The cleanup currently covers:

- assignment submissions and associated private files after 3 years;
- student progress after 3 years;
- formal assessment sessions, answers/events/results, extensions, reassessment
  authorisations, topic mastery/evidence, practice attempts, skill mastery,
  misconceptions, interventions, activity progress and delayed-review records
  after 3 years without activity anywhere in the learner's learning-evidence graph;
- audit events after 5 years; and
- settled student/tutor payments after 7 years.

Pending payments are not purged. A Storage permission failure returns a follow-up
signal rather than pretending the corresponding object was removed.
An assignment submission referenced by live qualifying mastery evidence is held
until that learning graph expires. Published questions, policies and immutable
assessment forms are shared reference content and are not learner erasure targets.
Dry-run results include per-table `eligible.learning_records` counts. Learning
records use the shared ordered `private.student_learning_privacy_manifest` for
export, erasure and retention; extend it and its regression tests for new tables.

There is no committed production scheduler evidence for this RPC. Sessions,
history, reports, notifications, invoices/pay periods, onboarding documents,
volunteer records, and other domains still need reviewed retention decisions.
Before enabling a production apply run, obtain privacy/finance approval, review
the dry-run counts, confirm backup/restore evidence, assign an operator and
rollback/incident owner, and retain the execution evidence.

## Privacy requests

- `export_student_data` includes `learning_records`, with subject-scoped formal
  answers, results, mastery evidence and practice history in addition to the
  legacy learner dataset. Its authorization remains platform-admin-only.
- `process-privacy-deletion` is the trusted resumable Auth/Storage/database saga.
  The service-only `erase_student_privacy_data` removes learning evidence before
  source submissions, clears session text and identity, and preserves required
  financial/audit history. `anonymize_student` remains revoked from all API roles.
- `process_privacy_request` handles access/correction but refuses browser deletion.
- The immutable completion receipt records `PRIV-02-learning-v1` and per-table
  deletion counts only after Auth hard deletion completes.
- Corrections use reviewed admin updates and must be recorded in the request.

The trusted worker uses the Storage and Auth APIs, preserves its lease across
retries, and does not report completion before the external stages finish.
Every new learner-linked table must be added deliberately to export, erasure, and
retention tests; the functions do not discover schema additions automatically.

## Tutor account deletion

`request_tutor_deletion(tutor_id, reason)` is an AAL2 platform-admin entry
point. It invokes `process-tutor-deletion`, a resumable trusted worker that
locks the tutor, bans Auth access, deletes their private `tutor-documents`,
erases onboarding/availability/volunteer/community data, removes their Auth
account, and writes an immutable completion receipt. Tutor payments, historical
classes, allocations, sessions, and audit events remain as inactive,
de-identified records so finance and operational retention is not broken by a
foreign-key cascade.

## Minimum evidence per request

- requester identity and guardian authority where the learner is a minor;
- request scope, decision, legal/financial hold, and approver;
- dry-run or export result stored in a protected location;
- SQL, Storage, and Auth completion status;
- audit reference, completion date, and exception/incident notes; and
- secure deletion of temporary export files after delivery.

Legal review is required before these technical controls are treated as a full
POPIA retention and data-subject-rights programme.
