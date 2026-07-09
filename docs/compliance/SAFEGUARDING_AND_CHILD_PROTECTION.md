# Safeguarding & Child-Protection Policy

**Status:** Living policy — v0.1 draft.
**⚠️ Legal review required before go-live.** This is our operational policy design. The statutory references (§10) must be confirmed with a South African legal professional before we rely on them, especially before onboarding non-family tutors or running community-outreach classes.
**Related:** [../product/TUTOR_AND_VOLUNTEER_MODEL.md](../product/TUTOR_AND_VOLUNTEER_MODEL.md) (vetting gate) · [../product/ROADMAP.md](../product/ROADMAP.md) · [POPIA_DATA_CLASSIFICATION.md](POPIA_DATA_CLASSIFICATION.md)

---

## 1. Why this policy exists

Project Odysseus works with **minors**. Most learners are children. The single greatest risk in this organisation is not a technical bug — it is **harm to a child**, whether through abuse, neglect, an unsafe adult, or a data breach that exposes a child. This policy sets the minimum standard that protects learners and protects the organisation and its tutors.

**Guiding principle:** the safety and well-being of the child comes before everything else — before convenience, before cost, before growth.

---

## 2. Scope

Applies to **everyone** who, through Project Odysseus, may come into contact with a learner or their data:
- founders and staff,
- paid tutors,
- volunteer tutors (community outreach),
- coordinators (school/NGO/community),
- anyone with access to learner records.

It applies across all delivery strands: private (`direct`), schools, NGO cohorts, and community outreach.

---

## 3. Where we are today (honest current state)

We are a small team (5 people, all under 23) and current tutors are **family and friends** — a known, trusted network. That informal trust is acceptable *at this stage and this scale*, and we already practise real safeguards:

- **Parental/guardian permission is obtained before we contact or tutor a learner.**
- **Private tutoring happens at the learner's home**, with the parent/guardian present or aware, for the learner's safety.
- **One adult per session/class** is our current norm and is acceptable at this stage.
- At schools, sessions run in the school's own environment under its supervision.

**The line we must not cross without upgrading safeguards:** the first time an adult who is *not* part of our known, personally-vouched-for network is placed with a child — a hired stranger, or a community-outreach volunteer — the **formal vetting gate (§4) becomes mandatory**. We do not wait for an incident to formalise this.

---

## 4. Vetting standard (the gate)

No one may be allocated to a learner or class until their vetting status is recorded as **`passed`** in the system (enforced in the allocation RPC — see [TUTOR_AND_VOLUNTEER_MODEL.md](../product/TUTOR_AND_VOLUNTEER_MODEL.md) §5). Volunteers meet the **same** standard as paid tutors — unpaid changes nothing.

Vetting components (confirm exact statutory requirements with counsel — §10):
1. Identity verification (SA ID / passport).
2. **SAPS police clearance** (criminal record check).
3. **National Child Protection Register — Part B** check (Children's Act).
4. **National Register for Sex Offenders** check (Sexual Offences Act).
5. Two contactable references.
6. Qualification verification.
7. Signed **Code of Conduct** (§5) and safeguarding induction.

**Re-vetting: every 2 years**, and **immediately** on any disclosure, allegation, or incident.

---

## 5. Code of Conduct (every tutor/volunteer signs)

- Always put the learner's safety and dignity first.
- **Obtain parental/guardian consent** before contacting a learner; keep a parent/guardian informed and involved.
- Keep interactions **appropriate, professional, and observable** wherever possible; conduct sessions in agreed settings (the learner's home with a guardian aware, a school, or a community venue) — not in private, unaccountable locations.
- **No private off-platform contact** with a learner (no personal social media, no private messaging outside agreed channels). Communication with minors goes through approved, parent-aware channels.
- Never share, request, or hold a learner's personal data beyond what tutoring requires.
- **No physical discipline, no humiliation, no discrimination.** Build confidence; never shame.
- Report any concern immediately (§6) — safeguarding is everyone's duty, and reporting is never "overreacting."
- Disclose anything that affects your suitability to work with children (e.g. a relevant charge).

---

## 6. Reporting & incident handling

**If a child is in immediate danger, contact emergency services (10111 / SAPS) first.**

Otherwise, anyone with a safeguarding concern must report it **without delay** to the **Safeguarding Lead** (§7). Steps:
1. **Record** — what was seen/heard/disclosed, when, who was involved (facts, not assumptions).
2. **Report** — to the Safeguarding Lead the same day.
3. **Preserve** — do not investigate or confront alone; preserve any evidence; maintain confidentiality (share only with those who need to know).
4. **Escalate** — the Safeguarding Lead assesses and, where required, refers to SAPS and/or the Department of Social Development, consistent with **mandatory-reporting duties** for child abuse/neglect under South African law (confirm scope with counsel).
5. **Support** — prioritise the child's safety and support throughout.

Retaliation against anyone who reports a genuine concern in good faith is prohibited.

The platform's **audit trail and session records** support safeguarding review (who tutored whom, when).

---

## 7. Roles & responsibilities

- **Safeguarding Lead** — the single named person responsible for receiving reports, assessing them, and escalating to authorities. **Currently unassigned (deferred).** ⚠️ **Must be appointed before the first community-outreach class involving non-family volunteers.** Until then, safeguarding concerns route to the founders directly.
- **Founders / platform admins** — own this policy, ensure vetting is enforced in the system, and hold the responsibility as data operator under POPIA.
- **Tutors / volunteers / coordinators** — follow the Code of Conduct and the duty to report.

---

## 8. Communication & consent with minors

- **Parental/guardian consent** is obtained before contacting a learner and before processing their data (aligns with POPIA's treatment of minors' data — a parent/guardian acts for the child).
- Communication with a learner uses **approved, parent-aware channels only** — never private personal accounts.
- Learners and guardians can raise concerns, ask questions, or request their data (see [POPIA_DATA_CLASSIFICATION.md](POPIA_DATA_CLASSIFICATION.md) and the platform privacy request flow).

---

## 9. Platform & data safety (safeguarding is also a data matter)

Exposing a child's data *is* a safeguarding failure. Therefore:
- Learner data is **access-scoped** (RLS) so no learner, tutor, or organisation sees another's records; NGO/funders get **aggregate, de-identified** reporting only.
- Minors' personal data is **minimised** — we collect only what tutoring needs.
- Production data must be **backed up** (Supabase Pro) before real cohorts are onboarded — losing children's records is a safeguarding and POPIA failure, not just an ops one.
- A **POPIA data-map & retention/erasure** process is required (documentation backlog) so a child's data can be removed on request.

---

## 10. Legal references (South Africa) — confirm with counsel

- **Children's Act 38 of 2005** — child protection; National Child Protection Register (Part B: persons unsuitable to work with children); mandatory reporting of abuse/neglect.
- **Criminal Law (Sexual Offences and Related Matters) Amendment Act 32 of 2007** — National Register for Sex Offenders.
- **Protection of Personal Information Act (POPIA)** — processing of minors' personal information requires competent-person (parent/guardian) consent.

> ⚠️ These are cited to scope our vetting/reporting design. A South African legal professional must confirm the exact obligations, registers to check, and reporting duties that apply to us before we operate beyond the current family/friends stage.

---

## 11. Review

- This policy is reviewed **at least annually**, and immediately after any incident or relevant legal change.
- Version history is tracked in git.

## 12. Open items

1. **Appoint a Safeguarding Lead** — before the first non-family/community class. (Deferred by the team for now; flagged as the top pre-outreach action.)
2. **Legal review** of §4 and §10 with an SA professional.
3. **Vetting provider** — in-house vs. background-screening service (decide when hiring beyond family/friends).
4. **Consent artefacts** — a written parental-consent form/record (currently verbal/informal); formalise before scaling.
