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
