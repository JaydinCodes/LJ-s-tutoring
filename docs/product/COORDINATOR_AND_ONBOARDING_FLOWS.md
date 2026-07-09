# Coordinator & Onboarding Flows

**Status:** Living design doc. How a new organisation (school / NGO / community / direct) is **set up** in the system, who does it, and how learners and staff join it.
**Builds on:** [../architecture/MULTI_ORG_MODEL_PLAN.md](../architecture/MULTI_ORG_MODEL_PLAN.md) (ADR-0002) · [TUTOR_AND_VOLUNTEER_MODEL.md](TUTOR_AND_VOLUNTEER_MODEL.md) · [../compliance/SAFEGUARDING_AND_CHILD_PROTECTION.md](../compliance/SAFEGUARDING_AND_CHILD_PROTECTION.md) · [../compliance/POPIA_DATA_MAP.md](../compliance/POPIA_DATA_MAP.md)

---

## 1. What "setting up an organisation" means (plain language)

"Setting up" (a.k.a. onboarding) an organisation = the steps to bring a new school, NGO, community programme, or private-client group into the platform so its learners can be tutored while its data stays isolated from every other org. Concretely:

1. **Create the organisation** record (name, type, contact).
2. **Add its coordinator** (the person who runs it day-to-day).
3. **Add its tutors/volunteers** (each vetted per the safeguarding gate before touching a learner).
4. **Create its classes/cohorts.**
5. **Enrol its learners** (with parental/guardian consent for minors).

After that, the org runs itself within its own isolated boundary (RLS scopes everything to it).

---

## 2. Who can do what

| Action | Who |
|---|---|
| Create an organisation | **Platform admin only** (Odysseus staff) — trusted provisioning, per ADR-0002 §11. No self-service org creation. |
| Add/assign a coordinator to an org | Platform admin |
| Add tutors/volunteers to an org | Platform admin or the org's coordinator (subject to vetting gate) |
| Create classes, enrol learners | Coordinator (or platform admin) |
| See the org's data | Coordinator (their org only); platform admin (all orgs) |
| See **aggregate, de-identified** cohort reports | `partner_viewer` (NGO/funder) — no PII |

**Platform admin has full control across every organisation** (operator/responsible party, MFA-gated). Everyone else is hard-scoped to their org by RLS.

---

## 3. Onboarding flow by org type

### 3.1 Direct (private tutoring) — today's default
- Already the seeded `direct` org. New private learners are enrolled here directly.
- Parental consent obtained; sessions at the learner's home (safeguarding §3).

### 3.2 School (`school`)
1. Platform admin creates the org (`type='school'`, name, location, contact).
2. Assign a **coordinator** (a school staff member or our liaison) as `organization_members.org_role='coordinator'`.
3. Coordinator (or admin) adds the school's tutors — **each must pass vetting** before allocation.
4. Coordinator creates classes (by grade/subject) and enrols learners.
5. Learner accounts created; **parental/guardian consent** recorded per learner (minors).

### 3.3 NGO (`ngo`)
- Same as school, plus: the NGO's funder/manager is added as **`partner_viewer`** — they get **per-cohort aggregate reports only** (no learner names, marks, or contacts), with small-cohort suppression (N<5). No direct PII access.

### 3.4 Community outreach (`community`)
- Org `type='community'`; host venue (church/mosque/community centre) in `organizations.location`.
- Tutors are usually **volunteers** — same vetting gate; **mandatory 6–10 hrs/month** logged.
- Learners typically free; **parental/guardian consent still required** (minors) before contact.
- Designed for shared/low-end devices and (later) offline — the constrained-connectivity case.

---

## 4. Coordinator role — what they can and can't do

**Can (within their org only):**
- Add/manage tutors and volunteers (subject to the vetting gate).
- Create and manage classes/cohorts.
- Enrol and manage learners; record parental consent.
- View their org's operational data and reports.

**Cannot:**
- See any other organisation's data (RLS hard-scopes them).
- Create organisations or assign platform-admin rights.
- Access sensitive vetting-check details (platform-admin-only; they see only a "cleared" flag).
- Bypass the vetting gate — the allocation RPC refuses an un-vetted tutor regardless of role.

---

## 5. Learner onboarding (within any org)

1. Coordinator/admin creates the learner's `profile` + `students` row in the org.
2. **Parental/guardian consent recorded** before the learner is contacted or their data processed (POPIA competent-person rule; safeguarding §8). *Consent artefact to be formalised — currently informal (safeguarding §12).*
3. Guardian(s) linked via `guardians` / `student_guardians`; report-access permission set.
4. Learner enrolled in class(es) and/or allocated a (vetted) tutor.
5. All of the above writes to `audit_log`.

---

## 6. Data-isolation guarantees (why this is safe)

- Every learner/class/assignment carries an `organization_id`; RLS requires **org membership AND role** to read/write (ADR-0002 §5).
- A coordinator or tutor of Org A can read **zero rows** from Org B — verified by the cross-org isolation test suite (the gate before any real onboarding).
- NGO/funder viewers never touch PII — aggregate RPC only.
- No tutor/volunteer is allocated to a learner until `tutor_vetting.status = 'passed'` (enforced in the RPC).

---

## 7. Sequence dependency (don't onboard before this is true)

Onboarding a real external org requires, first:
1. **Multi-org model live** (ADR-0002) with the cross-org isolation tests green.
2. **Supabase on Pro** (backups) — ADR-0003 hosting note.
3. **Vetting gate live** for any non-family tutor/volunteer.
4. **Safeguarding Lead appointed** before the first community class with non-family volunteers.
5. **Parental-consent artefact** in place.

Until those hold, onboarding stays limited to the trusted `direct` (family/friends) context.

---

## 8. Open items

1. **Coordinator invite flow** — platform-admin-created only for now; a self-service invite can come later.
2. **Consent artefact** — design the written parental-consent record (form + stored proof).
3. **Bulk learner import** — schools may need CSV enrolment; defer until a real school is onboarding.
