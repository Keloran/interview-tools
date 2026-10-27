// One job, many links: LinkedIn, Indeed, the company's own board, each with its own tracking junk.
// jobKey turns a posting link into something that's the same for the same job.

const TRACKING = /^(utm_.*|ref|refid|trackingid|trk|trkinfo|src|source|gclid|fbclid|mc_[a-z]+|lipi|origin|from|position|pagenum|eboardid)$/i;

const boards: { name: string; host: RegExp; key: (u: URL) => string | null | undefined }[] = [
  // linkedin.com/jobs/view/123 or /jobs/view/some-title-123, or ?currentJobId=123 on search pages
  {name: "linkedin", host: /(^|\.)linkedin\.com$/, key: (u) => u.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)/)?.[1] ?? u.searchParams.get("currentJobId")},
  // indeed.com/viewjob?jk=abc, or vjk= on search pages
  {name: "indeed", host: /(^|\.)indeed\.[a-z.]+$/, key: (u) => u.searchParams.get("jk") ?? u.searchParams.get("vjk")},
  // boards.greenhouse.io/acme/jobs/123
  {name: "greenhouse", host: /(^|\.)greenhouse\.io$/, key: (u) => u.pathname.match(/\/jobs\/(\d+)/)?.[1]},
  // jobs.lever.co/acme/<uuid>
  {name: "lever", host: /(^|\.)lever\.co$/, key: (u) => u.pathname.match(/\/([0-9a-f-]{36})/i)?.[1]?.toLowerCase()},
  // apply.workable.com/acme/j/ABC123
  {name: "workable", host: /(^|\.)workable\.com$/, key: (u) => u.pathname.match(/\/j\/([A-Z0-9]+)/i)?.[1]?.toUpperCase()},
];

export function jobKey(link: string | null | undefined): string | null {
  const raw = link?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!host.includes(".")) return null;

  for (const board of boards) {
    if (!board.host.test(host)) continue;
    const id = board.key(url);
    if (id) return `${board.name}:${id}`;
  }
  // Greenhouse embedded on a company's own site: ?gh_jid=123
  const gh = url.searchParams.get("gh_jid");
  if (gh) return `greenhouse:${gh}`;

  // Anything else: the same page without tracking params, case and trailing slashes
  const params = [...url.searchParams].filter(([k]) => !TRACKING.test(k)).sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? `?${new URLSearchParams(params)}` : "";
  return `${host}${url.pathname.replace(/\/+$/, "").toLowerCase()}${query}`;
}

export const isLink = (s: string) => /^(https?:\/\/|www\.)\S+$|^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i.test(s.trim());
