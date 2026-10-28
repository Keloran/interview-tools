# Community index release assessment — IT-82

Status: **prepared for owner review; publication not approved or enabled**.
The owner approved the threshold design in PR #320 and supplied the operator
Keloran LTD and privacy contact compliance@chewedfeed.com. This assessment records
what the implementation enforces and which residual risks need acceptance before
release. It does not claim guaranteed anonymity or legal compliance.

## Intended release

Employer-level voluntary reports only. Each contributor explicitly opts in under
a versioned published notice and confirms an independently reviewed employer for
each eligible application. An operator-curated catalog avoids automatic legal
entity merges; shared aliases/domains do not resolve identities. Recruiter roles
without a known end client, unresolved applications and unconfirmed or changed
source identities do not contribute. Private tracking works without sharing.

Only rounded rates, a median reply-time band, a broad contributor sample band and
the snapshot month are public. The sample band describes the smallest eligible denominator among displayed
metrics; unknown history can give different metrics different denominators.
Source roles, dates, notes, salary, people, contact
details, application IDs and contributor IDs are excluded from the aggregate DTO.
Existing personal company records remain private and separately labeled.

## Adversary scenarios and controls

| Scenario | Implemented control | Residual risk / release decision |
| --- | --- | --- |
| Employer recognizes its only applicant | At least 20 distinct contributors per displayed metric; no source details or role/location filters | An employer may have outside knowledge of a larger cohort. Exclude employers/cohorts where that makes disclosure unsafe, including sole-trader concerns. |
| A rare outcome identifies one person | Both cells of a binary metric need at least five contributors; otherwise the whole metric is withheld | Similar outcomes, a known cohort or reply-time bands can still support inference. Thresholds are not proof of anonymity. |
| Exact counts or percentages narrow membership | Rates round to 10 percentage points; sample bands are 20–49 / 50–99 / 100+; no exact count fields | Band boundaries still reveal information about cohort size. No arbitrary cohort/date filters may be added. |
| Old history is mistaken for measured response time | Only explicit known first-reply dates count; at least 20 known dates before a median band is shown | Dates are self-reported and may be wrong. No claim of representative employer performance. |
| One applicant creates many roles | At most the newest eligible application per account/employer; unique materialized key | One verified account is not one verified person; coordinated accounts remain possible. |
| Coordinated signups manipulate scores | Verified opt-in, actual 30-day record age, daily employer-confirmation changes, consent-spike review and contributor quarantine | These are conservative heuristics, not a complete Sybil defense. Hold suspicious cohorts for operator review. |
| Similar company names combine unrelated entities | Explicit reviewed UUID selection, with domain/jurisdiction shown; no automatic name/alias merge | User or curator mistakes remain possible. Employer review changes and confirmation removals invalidate snapshots. |
| Someone compares immediately before/after withdrawal | Durable withdrawal, revision checks and global epoch invalidation; all stale service-held snapshots fail closed | Previously downloaded copies remain outside our control. The notice states that they cannot be recalled. |
| A rerun reveals the one-person difference | Every publication month is sealed, even when suppressed; reruns cannot republish that month | Comparing different monthly releases can still support inference; reassess cohort entry/exit and band crossings. |
| Withdrawal races a job or cleanup races a new agreement | Singleton writer lock; fresh consent re-read; versioned cleanup; no enrolment while purge is pending | Lock contention or database failures can delay cleanup. Failures never report completed removal; suppressed state and retry remain. |
| A cached or malformed response exposes details | Every server read checks current controls, epoch, notice, month and employer state; strict DTO; no-store responses | A previously rendered/downloaded browser copy cannot be recalled. The current tab resets on withdrawal and active views refresh. |
| A private company name reveals that someone applied | Public lookup uses only the independently reviewed registry, not private employer discovery | Registry review must not add a private employer merely because a single user entered it. |

## Verification evidence

- Unit/API/UI tests cover 19/20 contributors, 4/5 cells and complements, independent
  reply-date samples, exact DTO keys, unknown/invalid/suppressed records, stale
  notice/epoch/month, identity ambiguity and explicit confirmation.
- CI PostgreSQL tests exercise a forced purge failure after durable withdrawal,
  scoped retry (including collection paused), retained private history, account cascades, duplicate roles,
  distinct entities sharing aliases/domains, concurrent withdrawal/rebuild,
  suppressed-month sealing and contributor quarantine.
- The UI separates community summaries from personal history, shows the snapshot
  month/sample band and voluntary-sample caveat, omits suppressed metrics and
  links to consent and the public notice. Looking up a record neither opts in nor
  links an application. No date/cohort controls are exposed by the public endpoint.
- Tests use synthetic fixtures only. No assessment of any real employer cohort
  has been performed, no real registry entries are seeded and no production gates
  or scheduler secrets have been configured by this work.

## Owner release review

Before enabling collection, review the deployed feature notice and the service's
wider privacy information, including actual infrastructure/processing locations,
retention and contact arrangements. Publish the exact notice version before
opening the collection gate. Before enabling public summaries, accept the residual
risks above and review each initial employer/cohort; defer unsafe or ambiguous
ones. Configure the protected monthly job only for the reviewed deployment.

Approval to merge code is not an instruction to switch production collection or
publication on. Follow `docs/community-sharing-release.md` for those separate gates.
Record the owner's release decision here and on IT-82. Until then, both gates stay
off and no public summaries are produced by default.

This engineering assessment uses the contextual singling-out/linkability approach
in the [ICO anonymisation guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/anonymisation/how-do-we-ensure-anonymisation-is-effective/).
The numeric thresholds and heuristics are our approved design choices; they are
not regulatory guarantees or a substitute for review of the actual release.
