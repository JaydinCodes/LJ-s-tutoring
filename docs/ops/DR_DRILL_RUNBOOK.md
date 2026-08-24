# Disaster-Recovery Drill Runbook

Frequency: quarterly, and after a material Supabase, Storage, Auth, or
deployment-topology change. This runbook is for an isolated restore drill; it
must not be exercised against the production project.

## Before the drill

1. Appoint a recovery lead, independent verifier, and incident recorder.
2. Open the drill record and capture the production SHA, release-gate artifact,
   current Supabase migration history, target recovery point, and expected
   Storage inventories.
3. Confirm the target is isolated and has no production integrations or real
   recipient email/SMS/payment configuration.
4. Confirm the actual Supabase plan capability and support path for the
   selected recovery point. If PITR cannot meet the stated RPO, record the gap
   and stop the drill rather than substituting an untested method.

## Execute

1. Follow the database and Storage procedures in
   [`PITR_STRATEGY_AND_RESTORE_VERIFICATION.md`](../db/PITR_STRATEGY_AND_RESTORE_VERIFICATION.md).
2. Verify migration history before any schema action. Do not run forward
   migrations merely to make a restored target look current.
3. Run the protected role checks: AAL2 admin, tutor, student, parent, and an
   unrelated organisation user. Check database rows, released-result masking,
   and private Storage access.
4. Verify the tutor safeguarding boundary by attempting an active allocation
   for a pending/unvetted tutor, then for an approved unexpired tutor.
5. Verify that cron jobs, Edge Functions, webhooks, and notification workers
   are disabled or target only drill-safe endpoints.
6. Record measured recovery time, data gap, object comparison, and all errors.

## Pass criteria

- Recovery meets the approved RPO/RTO, or the gap is accepted by the service
  owner with a dated remediation.
- No production credential, user, provider, or public Storage exposure is used.
- Role and cross-organisation checks pass, including released-data and tutor
  vetting gates.
- Database and Storage inventories are reconciled for the selected recovery
  point.
- The verifier signs the evidence and a recovery lead approves target teardown.

## After the drill

1. Attach the evidence items named in the PITR procedure to the drill record.
2. Log failures in the production-readiness register with an owner and due
   date. A failed or undocumented drill blocks a production release.
3. Destroy the isolated target, revoke temporary secrets, and verify that no
   test scheduler or webhook remains enabled.
4. Update this runbook if the actual restore flow, target services, or recovery
   objectives changed.
