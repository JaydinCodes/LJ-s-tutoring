# Tutor & Volunteer Model

**Status:** Living document. Covers how we recruit, vet, engage, and manage the people who teach — paid tutors and volunteers alike.
**Companions:** [ROADMAP.md](ROADMAP.md) · [../architecture/MULTI_ORG_MODEL_PLAN.md](../architecture/MULTI_ORG_MODEL_PLAN.md) (ADR-0002)
**⚠️ Legal note:** the safeguarding requirements below (§3) must be reviewed by a South African legal professional before go-live. Treat this as the product/operational design, not legal advice.

---

## 1. Why this matters

We put adults in contact with minors — in homes (private), schools, NGO cohorts, and volunteer classes at churches, mosques, and community venues in under-privileged areas. **The single highest risk in this whole business is a safeguarding failure with a child.** It outranks every technical concern in `AUDIT.md`. This model exists to make it structurally impossible to assign an un-vetted adult to a learner.

**Non-negotiable rule (enforced in data, not just policy):** a tutor or volunteer **cannot be allocated to any learner or class until their vetting status is recorded as `passed`.**

### Current state vs. future (be honest about where we are)

- **Now (5-person team, 2026):** tutors are **family and friends** — a known, trusted network. Vetting is informal (we personally know them). Current safeguarding practice already in place: **we ask the parent/guardian for permission before contacting a learner**, and **private tutoring happens at the learner's home** (parent present/aware) for the learner's safety. At schools, one adult per class is fine.
- **Future (hiring beyond the known network + community outreach):** the formal **vetting gate (§3) switches on**. The moment a tutor is *not* someone we personally vouch for — a hired stranger or a community-outreach volunteer — background checks become mandatory before any learner contact. The data model is built for this now so the gate is ready when we need it.

---

## 2. People types

| Type | Paid? | Typical strand | Notes |
|---|---|---|---|
| **Paid tutor** | Yes | Private, school, NGO-funded | Employed/contracted; qualification-verified. |
| **Volunteer tutor** | No | Community outreach | Same vetting standard as paid — no exceptions for being unpaid. |
| **Lead / senior tutor** | Yes | Any | Mentors others, may review content (teacher-review gate, see strategy doc). |

A person can be **both** over time (e.g. a paid private tutor who also volunteers at a community site). Engagement is tracked **per organisation** via `organization_members.org_role = 'tutor'`, plus an engagement attribute (§5).

---

## 3. Safeguarding & vetting (the gate)

Everyone who will have contact with minors passes vetting **before** any learner allocation. Proposed components (confirm exact legal requirements with counsel):

1. **Identity verification** — SA ID / passport.
2. **Police clearance** — SAPS criminal record check.
3. **National Child Protection Register (Part B)** check — Children's Act 38 of 2005 screening (persons unsuitable to work with children).
4. **National Register for Sex Offenders** check — Sexual Offences Act screening.
5. **Reference checks** — at least two, contactable.
6. **Qualification verification** — degree/subject competence (already partially modelled: the legacy `TutorProfile` carries qualification band + documents).
7. **Signed Code of Conduct** — child-protection code, behavioural expectations, reporting duties.
8. **Safeguarding induction** — short mandatory training + acknowledgement.

**Re-vetting:** **every 2 years**, and immediately on any disclosure/incident.

**Operating practices (current + designed-in):**
- **Parental/guardian permission is obtained before contacting a learner** — already our practice.
- **Private sessions happen at the learner's home** (parent present/aware) — already our practice.
- **One adult per session/class is acceptable** (team confirmed). Note for later: if community-outreach venues ever involve non-family volunteers in less-observable settings, revisit whether an observability practice is warranted — but not required now.
- Clear **incident reporting** path — needs a named safeguarding lead (deferred, §7).
- Session records/audit trail already exist — extend to support safeguarding review.

---

## 4. Recruitment funnel

```
Applied → Screening → Interview → Vetting (§3) → Induction → Active
                                        │
                                        └── any check fails → Rejected / On-hold (never allocated)
```

- **Applied** — public "Tutor with us" form (exists on the site).
- **Screening** — basic eligibility (subject, location, availability).
- **Interview** — competence + values (patience, confidence-building style — matches the brand promise).
- **Vetting** — the §3 gate; status must reach `passed`.
- **Induction** — safeguarding training + platform onboarding.
- **Active** — eligible for allocation to learners/classes.

The legacy Fastify API already has a tutor **application + approval workflow** and qualification/documents on `TutorProfile` — we extend it with the vetting states rather than building from scratch.

---

## 5. Data model mapping

Builds on [ADR-0002](../architecture/MULTI_ORG_MODEL_PLAN.md); keep the canonical schema in `docs/supabase/schema.sql`.

- **Membership & role:** `organization_members (organization_id, profile_id, org_role='tutor', status)`.
- **Engagement type per membership:** add `engagement_type enum ('paid','volunteer')` to `organization_members` (a person can be paid in one org, volunteer in another).
- **Vetting status (gates allocation):** a `tutor_vetting` record per person —
  ```sql
  create table public.tutor_vetting (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id) on delete cascade,
    status public.record_status not null default 'pending',   -- pending → passed / suspended
    police_clearance_at date,
    child_protection_check_at date,
    sex_offender_check_at date,
    references_checked boolean not null default false,
    code_of_conduct_signed_at date,
    induction_completed_at date,
    reviewed_by uuid references public.profiles(id),           -- platform admin
    expires_at date,                                            -- drives re-vetting
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  ```
- **The hard gate:** allocation (`tutor_student_allocations`) and class assignment RPCs must check `tutor_vetting.status = 'passed'` and `expires_at > now()` for the tutor **before** creating the link. Enforce in the SECURITY DEFINER RPC, not just the UI.
- **Volunteer hours:** the community strand needs hour logging for reporting/impact **and** to track the mandatory 6–10 hrs/month commitment. Volunteer-log capability already exists in the legacy API; carry it into the Supabase model as `volunteer_sessions (profile_id, organization_id, class_id, hours, occurred_on, notes)`, with a monthly rollup view for the commitment check.

**RLS:** `tutor_vetting` is **platform-admin-only** (it contains sensitive check data) — not visible to coordinators, tutors, or the tutor themselves beyond a boolean "cleared" status surfaced via a safe view/RPC.

---

## 6. Volunteer / community-outreach specifics

- Learners are typically **free**; the org is `type='community'` with the host venue in `organizations.location`.
- Volunteers meet the **same vetting bar** as paid tutors — being unpaid changes nothing about child safety.
- **Volunteering is mandatory when available: 6–10 hours per month.** Track hours against this commitment; "when available" means genuine capacity (exams, illness, etc. excepted).
- Track **volunteer hours** and cohort outcomes for impact reporting to funders/partners (aggregate, de-identified — same rules as NGO reporting).
- Design for **shared/low-end devices and offline** — community sites are exactly the constrained-connectivity case the platform is built for.

---

## 7. Decisions & remaining questions

**Decided (2026-07-08):**
- **Re-vetting cadence** — ✅ every 2 years (plus immediately on incident).
- **Volunteer commitment** — ✅ mandatory 6–10 hrs/month when genuinely available.
- **Observability rule** — ✅ one adult per session/class is fine.
- **Current safeguarding practice** — ✅ parental permission before contact; private sessions at the learner's home.

**Still open:**
1. **Vetting provider** — in-house vs. a background-screening service (decide when we start hiring beyond family/friends). A service is usually faster and more defensible.
2. **Safeguarding lead** — named responsible person for incident reports. **Deferred** — 5-person team today, to be decided before the first community-outreach class with non-family volunteers.

> These feed the dedicated **Safeguarding & Child-Protection Policy** doc (in the documentation backlog — see [ROADMAP.md](ROADMAP.md) §7).
