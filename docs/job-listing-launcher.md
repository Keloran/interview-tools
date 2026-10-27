# Checking a job from its listing (IT-11)

## Decision

Start with a bookmarklet that opens `/check` in the existing app. Keep the job page
open and let the user review and edit the imported details before saving anything.
Ship the launcher as IT-77; validate it on live job sites in IT-78.

An automatic in-page badge is a different feature: it needs an extension that can
observe listings and obtain authenticated results. That extra distribution,
permissions and authentication work is not needed for the first lookup launcher.

| Option | Experience | Access/authentication | Decision |
| --- | --- | --- | --- |
| Bookmarklet | User invokes a saved bookmark; app opens with the listing selected | Reads the current page only when clicked; normal app sign-in | Implement first |
| Extension launcher | User clicks the toolbar action; app opens with the listing selected | `activeTab` can read URL/title on a user gesture; the same app handoff works | Fallback if real sites block bookmarklets |
| Automatic extension badge | A badge appears without a click | Needs access to supported pages plus a separate design for authenticated checks, expiry and sign-out | Defer until demand and permissions are agreed |

Chrome and Firefox document `activeTab` as temporary access granted by a user
gesture, including access to tab URL/title. It does not provide automatic scanning
of every job page: [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab),
[Firefox activeTab](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/activeTab_permission).

## Handoff and auth

1. The bookmarklet reads the current HTTP(S) URL, stripping its fragment and any
   URL credentials. It prefers a JobPosting title and hiring organization from
   JSON-LD, then the page heading/title. Company stays blank when it is unknown.
2. It opens the app's `/check` in a new tab with `noopener,noreferrer`. It sends no
   cross-origin API request and reads no application cookies or tokens.
3. Metadata is encoded in the destination fragment (`job`, `title`, `company`).
   The URL is capped at 2,048 characters; title/company at 200 each. The receiver
   validates the protocol and rejects URL credentials and oversized payloads.
4. The app uses its existing Clerk session. Signed-out visitors get a sign-in
   button with explicit sign-in and sign-up return destinations on `/check`.
   The imported fragment is preserved in that return destination. No PAT is needed.
5. Only after the authenticated history request succeeds does the app show a
   result. “Add it” pre-fills the editable form; the user must submit it to save.

Fragments are not included in the initial HTTP request, so the import does not
become a query string in the initial app request. The Clerk return URL can include
the fragment as redirect data; this is metadata transport, not a place for secrets.
Sources: [URI fragments](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment),
[Clerk redirect props](https://clerk.com/docs/guides/development/customize-redirect-urls),
[JobPosting fields](https://schema.org/JobPosting),
[window.open features](https://developer.mozilla.org/en-US/docs/Web/API/Window/open).

## Restrictions and fallback

JavaScript URLs can be blocked by a page's CSP. A browser may also restrict opening
a new tab. Source: [JavaScript URLs](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/javascript).
There is no claim that the launcher works on every LinkedIn/Indeed page or browser.
The setup instructions offer copying the bookmark URL when dragging is unavailable,
and pasting the listing's ordinary link into `/check` when script execution is blocked.
No attempt is made to bypass the site's policy.

Structured data varies by site and can be missing, invalid or stale. Imported text
is a suggestion, not trusted HTML or a confirmed application. The launcher never
infers an unnamed client, imports the full job description, or saves on the user's behalf.

## Verification

Automated tests execute the generated script against representative JobPosting
objects, arrays, `@graph`, plain headings and malformed JSON. They verify encoding,
destination, bounds, original-tab preservation and `noopener,noreferrer`, then test
receiving validation, sign-in return paths, history loading/errors and editable add
prefills in the UI. The normal suite, lint and TypeScript checks must pass.

IT-78 is the remaining real-browser check after deployment: install the bookmark,
try known/new postings on LinkedIn, Indeed and a company careers page, sign out and
back in (including sign-up), and record browser versions and any blocked scripts
or popups. This session has no interactive browser connected to those accounts;
the DOM tests do not substitute for that check. If restrictions are common, build
the extension launcher using `activeTab`, reusing this same validated app handoff.
