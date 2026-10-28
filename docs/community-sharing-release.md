# Community sharing: release and operations

IT-73's design was approved by the owner on 28 October 2026 (PR #320).
The approved operator is Keloran LTD; the privacy contact is
compliance@chewedfeed.com. The public feature notice is `/privacy/community`,
version `2026-10-28-v1`. IT-80 adds consent controls and storage foundations;
it does not create contributions, publish snapshots or enable either release gate.

## Publication sequence

1. Deploy the migration and notice/settings routes with `CommunityControl`'s
   `collectionEnabled` and `publicationEnabled` both false. The repeatable
   migration creates a default-off singleton without overwriting existing controls.
2. Review the deployed notice, including identity/contact details, actual service
   processing infrastructure/locations and retention arrangements. This feature
   notice supplements the service's wider privacy information; confirm those
   disclosures are complete before publishing it. Changes to contributed fields,
   retention or recipients need a new notice version and fresh agreement.
3. Once the owner has reviewed the notice, set `noticeVersion` to the code's exact
   `COMMUNITY_NOTICE_VERSION` and `noticePublishedAt` to the actual publication time
   on the singleton `CommunityControl` row (`id='global'`). Keep both gates false.
   Verify the public notice displays its operator, contact and version without
   the awaiting-publication banner.
4. Enable collection only once IT-81's protected aggregation is ready and the
   notice is published. Existing users stay opted out; an explicit authenticated
   action with a verified account and the current notice version is required.
5. Enable publication only after IT-82's release checks and owner acceptance of
   the motivated-intruder/differencing assessment. No arbitrary date filters or
   raw contribution access may be added to public routes.

These steps change externally visible behavior and must be performed deliberately;
no migration, build or deployment hook enables the gates. This document records
how to perform release, not evidence that publication or collection has occurred.

## Withdrawal, deletion and failures

Every community writer takes the singleton row lock before user/consent rows.
IT-81 must use `lockCommunity` too, re-read current consent and gates inside that
transaction, and store the consent revision on each contribution.

Withdrawal first commits the withdrawn timestamp, a new consent revision, the
`purgePending` marker and an incremented global `revocationEpoch`. This immediately
invalidates **all** existing snapshots, a conservative first-release trade-off.
The next transaction physically removes that user's contributions. Success is
reported only after cleanup; on failure the durable withdrawn state stays in
place, and the settings page offers retry. Re-enrolment is blocked until cleanup
finishes. Stale cleanup checks the consent revision so it cannot erase a later
agreement's contributions. An already completed withdrawal is idempotent.

Aggregation must exclude withdrawn, expired-version or purge-pending consent, and
retry pending purges before publication. Every public snapshot read must check
`snapshotCurrent` against freshly loaded controls; an epoch or notice-version
mismatch, missing controls or a database failure must suppress the response. Do
not serve an unchecked cached snapshot. A monthly rebuild can create fresh
snapshots from current eligible contributors; it must never reuse withdrawn rows.

Account deletion increments the epoch when contributions exist, and cascades private data, consent and
contributions in one transaction, before deleting the Clerk login. Both the account
endpoint and the verified Clerk webhook use the same function. If database deletion
fails, private records roll back and durable withdrawal is attempted before the
error is returned. No deletion success is reported on failure. Repeated deletion
of an already removed user does not invalidate the index again.

The latest consent choice is kept while the account exists and cascades on account
deletion. Public snapshots contain no user identifiers. Downloaded external copies
of past aggregate summaries cannot be recalled; the notice states that limit.

## Validation

`node --import tsx scripts/check-community-consent.ts` runs only when `CI=true`
against a disposable local PostgreSQL database named `interview_test`. It tests
default-off gates, idempotent grant, a forced database purge failure after durable
withdrawal, snapshot invalidation, scoped cleanup/retry, retained private tracking
and account cascades. It restores controls and removes its synthetic fixtures.

## Reviewed employer registry (IT-81)

There are no seeded real employers and no automatic legal-entity merging. A
privileged operator maintains the independent registry with
`node --import tsx scripts/community-review.ts --reviewed-file /path/to/review.json`.
A new employer file contains `name`, `domain`, `jurisdiction`, an `aliases` array,
`confirmReviewed: true` and `reviewCohort: false`. An optional existing UUID `id`
updates that reviewed entity; aliases only help search, and may overlap between
entities. A shared website domain does not combine subsidiaries. Check legal
identity and small-employer/sole-trader disclosure risks before reviewing a record.
Use `suppressed: true` to suppress an employer and `suppressed: false` only after
a deliberate release review.

Users explicitly confirm the reviewed employer UUID per application. Recruitment
applications without an end client cannot be confirmed. Confirmation changes are
limited to once per day; removal is always available. Clearing a link does not
bypass that cooldown. A changed source employer name invalidates its confirmation
for future collection. Confirmation creates no contribution and does not opt in.

A contributor review file contains `type: "contributor"`, `clerkId`,
`quarantined: true` and `confirmReviewed: true`; it pauses contribution eligibility,
removes contributions and invalidates snapshots without restricting private use.
Only privileged operators may run this tool. Do not paste contributor identifiers
into issue comments or logs. Lifting quarantine does not override withdrawal or an
outdated notice version.

The initial consent-spike heuristic suppresses an employer when a 72-hour window
contains at least ten and at least half of its eligible accounts, unless an
operator has reviewed that cohort afterwards. It is a conservative review flag,
not proof of fraud or of one account per real person. To acknowledge an examined
cohort, update its employer with `reviewCohort: true`. The timestamp must follow
the cohort's agreements. Do not approve a cohort solely to make scores appear.

## Monthly collection and publication (IT-81)

The protected `POST /api/community/rebuild` endpoint is unavailable without a
server-side `COMMUNITY_REBUILD_TOKEN` of at least 32 characters. Configure the same
secret in GitHub and `COMMUNITY_REBUILD_URL` as the full HTTPS endpoint only when
the deployment is ready. The monthly workflow runs at 06:00 UTC on the first of
each month; workflow dispatch permits a deliberate initial run. The endpoint
accepts a Bearer token and no user/period/filter inputs. Do not log the token.

Collection rechecks the notice, gates, current consent and reviewed employers
under the singleton lock. It selects the newest eligible application per account
and employer, with 30 days of actual record age and the 24-month applied-date
window. Withdrawals with no reply evidence, unresolved applications, unknown reply
dates, unconfirmed/changed identities and quarantined accounts are excluded as
appropriate. Date calculations use explicit calendar dates; historical stage
timestamps never estimate a first reply. Only minimal contribution fields are
materialized, without role, notes, salary or source application IDs.

Publication requires its separate gate. Every publication month is sealed on
`CommunityControl.lastPublicationMonth`, even if all results are suppressed.
Reruns may clean/recollect, but cannot replace that month's publication after a
withdrawal or a threshold crossing. Revocation therefore leaves scores hidden
until the next monthly publication. This is deliberately conservative; a monthly
rerun must not reveal a before/after contributor difference. No historical-period
query API is provided. Read paths require fresh controls, the current month,
matching notice/epoch, a reviewed unsuppressed employer and an allowlisted DTO.
Database failures and unknown/suppressed results fail closed.

`node --import tsx scripts/check-community-aggregation.ts` uses only the disposable
CI PostgreSQL database and synthetic fixtures. It checks reviewed entity isolation
(including shared aliases/domains), duplicate applications, 19/20 thresholds,
monthly sealing, a concurrent withdrawal/rerun and contributor quarantine.
