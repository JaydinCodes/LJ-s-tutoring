# Data Retention And Deletion

This is the current Supabase control summary. The former Fastify retention job,
`RETENTION_*` API variables, and Prisma backup scripts are retired and must not
be used. See [POPIA_DATA_MAP.md](POPIA_DATA_MAP.md) for the complete inventory,
processors, and open compliance actions.

## Implemented retention RPC

`public.run_retention_cleanup(p_apply boolean default false)` is
`SECURITY DEFINER`, admin/trusted-context gated, and defaults to a non-destructive
dry run. It currently covers:

- assignment submissions and associated private files after 3 years;
- student progress after 3 years;
- audit events after 5 years; and
- settled student/tutor payments after 7 years.

Pending payments are not purged. A Storage permission failure returns a follow-up
signal rather than pretending the corresponding object was removed.

There is no committed production scheduler evidence for this RPC. Sessions,
history, reports, notifications, invoices/pay periods, onboarding documents,
volunteer records, and other domains still need reviewed retention decisions.
Before enabling a production apply run, obtain privacy/finance approval, review
the dry-run counts, confirm backup/restore evidence, assign an operator and
rollback/incident owner, and retain the execution evidence.

## Privacy requests

- `export_student_data` provides the implemented access-export dataset.
- `anonymize_student` removes major academic/reporting data, clears session free
  text, detaches guardian links, and anonymizes profile/student identity while
  preserving required financial/audit history.
- `process_privacy_request` tracks and dispatches approved access/deletion work.
- Corrections use reviewed admin updates and must be recorded in the request.

The service-role completion procedure must handle any Storage object the SQL role
could not delete and disable/delete the corresponding Supabase Auth identity.
Every new learner-linked table must be added deliberately to export, erasure, and
retention tests; the functions do not discover schema additions automatically.

## Minimum evidence per request

- requester identity and guardian authority where the learner is a minor;
- request scope, decision, legal/financial hold, and approver;
- dry-run or export result stored in a protected location;
- SQL, Storage, and Auth completion status;
- audit reference, completion date, and exception/incident notes; and
- secure deletion of temporary export files after delivery.

Legal review is required before these technical controls are treated as a full
POPIA retention and data-subject-rights programme.
