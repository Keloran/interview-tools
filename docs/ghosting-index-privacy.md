# Community ghosting index — IT-73 proposal

Status: **awaiting owner agreement**. This design enables no collection or public
sharing. IT-74 and its implementation tickets stay blocked until the thresholds
and release scope below are agreed.

## Proposed first release

An optional company-level view of voluntary, self-reported experiences. Existing
private tracking continues independently. Publish only a curated employer name,
coarse response/ghosting/feedback rates, a reply-time band, a broad sample band
and the snapshot month. Exclude application IDs, people, roles, salaries, notes,
contact details, individual dates, locations and raw source records from public
responses and telemetry. No per-role, office, recruiter, user or date filters.

| Control | Proposed value |
| --- | --- |
| Minimum sample for each displayed metric | 20 distinct opted-in verified accounts |
| Maximum influence | One eligible application per account per canonical employer |
| Binary metric release | Both the yes and no cells must contain at least 5 contributors |
| Rates | Round to nearest 10 percentage points; never return exact counts |
| Sample display | 20–49, 50–99, 100+; no counts below the threshold |
| Reply time | Median band: 0–7, 8–14, 15–30, 31–60, over 60 days |
| Reply-time eligibility | At least 20 known explicit first-reply dates; unknown history excluded |
| Source window | Last 24 months, application recorded at least 30 days earlier |
| Publication | Fixed monthly snapshots; no arbitrary historical queries or live recalculation |

Use the newest eligible application per account/employer, ordered by applied date
then ID; apply that choice before computing metrics so repeated applications
cannot add weight. Exclude open awaiting applications and withdrawals with unknown
outcomes. “Responded” means evidence of at least one reply, using the same evidence
rules as private company history; it does not mean every stage received a reply.
“Ghosted” means the owner explicitly closed the current application as No response;
that may follow an earlier reply, so the two rates need not sum to 100%. Feedback
rates use explicitly recorded feedback types; missing feedback history is unknown.
Each metric has its own eligible denominator and suppression check. If either
binary cell is below five, hide that entire metric, including any complementary
value. Do not publish sample bands when all metrics are suppressed.

Unknown companies and suppressed companies get the same generic insufficient-data
response. No list of employers inferred solely from private applications. Expect
no scores for many companies initially; insufficient sample is an intended result.

## Identity and abuse

Maintain an internal, reviewed registry of canonical employers and approved
aliases. Whitespace/case/punctuation normalization suggests matches; it does not
merge “Acme”, “Acme Ltd” and “ACME Inc” automatically. Require confirmed identity
before a private employer is eligible. Ambiguous names, sole traders/small-employer
identification concerns and unconfirmed end clients stay excluded. First release
covers employers only; recruiter scores require a separate cohort and design.

Restrict contribution eligibility to verified accounts; cap contribution weight,
rate-limit edits and flag coordinated account creation or suspicious spikes for
review. Account verification does not prove one real person. Quarantine suspect
cohorts rather than silently changing scores. Store no public contributor IDs.
Outlier reply times stay in broad bands, with impossible/negative values excluded;
never estimate missing dates or silently winsorize values.

## Consent, removal and release

Default off. Offer a separate explicit opt-in explaining the included historical
window and permitted fields, referencing a versioned published privacy notice.
Record the notice version and choice timestamp. No contributions are materialized
before opt-in and publication of the reviewed notice; material scope changes need
fresh agreement. Withdrawing takes one action and does not penalize private use.

Opt-out or account deletion removes internal contributions and invalidates affected
public snapshots before success is returned. If removal/rebuild fails, suppress
those companies immediately and retry; every public read checks the revocation
version so cached stale snapshots fail closed. Rebuild from currently consenting
accounts, never from retained revoked rows. Retain only the minimal choice audit
record under a documented retention rule. Explain that copies already downloaded
by outsiders cannot be recalled; internal removal is not a promise to erase those.

These thresholds are a product proposal, **not an anonymity guarantee**. Monthly
snapshots, rounding and suppression reduce some disclosure opportunities but do
not prevent inference from external knowledge, coordinated accounts or successive
releases. Before enabling publication, document a motivated-intruder assessment
covering small employers, all-same outcomes, cohort entry/exit, revocation and
snapshot differencing. If risk remains unacceptable, raise limits, further suppress
outputs or defer public scores. Obtain owner acceptance of that assessment and
publish the reviewed privacy notice before enabling collection. Do not advertise
legal compliance or guaranteed anonymity on the basis of a sample threshold.

The [ICO anonymisation guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/anonymisation/how-do-we-ensure-anonymisation-is-effective/)
emphasizes assessing singling-out and linkability in context. Its
[consent management guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/how-should-we-obtain-record-and-manage-consent/)
describes accessible withdrawal. The numeric limits and release rules above are
our proposed engineering choices, not prescribed limits from those sources.

## Follow-up work and acceptance

- **IT-80:** versioned opt-in, reviewed privacy notice, withdrawal/deletion and
  immediate snapshot invalidation. Blocked by IT-73.
- **IT-81:** canonical employers and protected aggregation. Blocked by IT-73 and
  IT-80. Test 19/20 contributors, 4/5 cells and complements, duplicate roles,
  unknown dates, name collisions, revocation races and differencing scenarios.
- **IT-82:** aggregate display and release checks. Blocked by IT-73 and IT-81.
  Use installed shadcn components, an allowlisted public DTO, generic suppression,
  snapshot labels and voluntary-sample context. Release only after the assessment
  and notice gates pass.

Owner decision needed: approve the proposed 20-contributor/5-per-cell threshold
and employers-only, coarse monthly release, or specify a different scope. Record
that agreement here and on IT-73 before considering the spike complete.
