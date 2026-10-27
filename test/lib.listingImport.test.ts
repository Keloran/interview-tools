import {afterEach, describe, expect, it, vi} from "vitest";
import {buildJobBookmarklet, listingCheckPath, readListingImport} from "@/lib/listingImport";

afterEach(() => { document.body.replaceChildren(); });
const listing = {url: "https://www.linkedin.com/jobs/view/123?trackingId=one", title: "Senior Engineer", company: "Acme"};

describe("listing import", () => {
  it("round-trips quotes, unicode and query characters as data", () => {
    const input = {...listing, title: `Engineer & designer "高级" <script>`, company: "Acme & Co"};
    const path = listingCheckPath(input);
    expect(path.startsWith("/check#job=")).toBe(true);
    expect(readListingImport(path.slice(path.indexOf("#")))).toEqual(input);
  });
  it("strips the source fragment and bounds text fields", () => {
    const path = listingCheckPath({...listing, url: `${listing.url}#private`, title: `\u0000${"a".repeat(500)}`, company: " Acme\nCo "});
    const result = readListingImport(path.slice(path.indexOf("#")));
    expect(result).toEqual({...listing, title: "a".repeat(200), company: "Acme Co"});
  });
  it.each(["javascript:alert(1)", "data:text/html,hello", "file:///etc/passwd", "//evil.test/jobs", "https://name:secret@example.com/jobs", "not a URL", `https://example.com/${"x".repeat(2048)}`])("rejects unsafe or invalid URLs: %s", (url) => {
    expect(listingCheckPath({...listing, url})).toBe("/check");
    expect(readListingImport(`#job=${encodeURIComponent(url)}`)).toBeNull();
  });
  it("ignores other fragments, oversized imports and external return targets", () => {
    expect(readListingImport("#section")).toBeNull();
    expect(readListingImport(`#job=${"a".repeat(16000)}`)).toBeNull();
    const data = readListingImport(`#job=${encodeURIComponent(listing.url)}&returnTo=https://evil.test`);
    expect(listingCheckPath(data)).not.toContain("evil.test");
    expect(listingCheckPath(null)).toBe("/check");
  });
});

function execute(html: string, url = `${listing.url}#panel`, title = "Fallback title") {
  document.body.innerHTML = html;
  document.title = title;
  const opened = vi.fn();
  const alert = vi.fn();
  const code = decodeURIComponent(buildJobBookmarklet("https://interviews.tools").slice("javascript:".length));
  new Function("document", "location", "window", "URL", "URLSearchParams", code)(document, new URL(url), {open: opened, alert}, URL, URLSearchParams);
  const destination = opened.mock.calls[0]?.[0] as string | undefined;
  return {opened, alert, destination: destination ? new URL(destination) : null};
}

describe("generated bookmarklet", () => {
  it("opens the app without changing the source page and captures an ordinary heading", () => {
    const {opened, destination} = execute("<h1>Senior Engineer &amp; Architect</h1>");
    expect(destination?.origin).toBe("https://interviews.tools");
    expect(destination?.pathname).toBe("/check");
    expect(destination?.search).toBe("");
    expect(readListingImport(destination!.hash)).toEqual({...listing, title: "Senior Engineer & Architect", company: ""});
    expect(opened).toHaveBeenCalledWith(destination!.href, "_blank", "noopener,noreferrer");
    expect(document.querySelector("h1")).toHaveTextContent("Senior Engineer");
  });
  it.each([
    {"@type": "JobPosting", title: "Backend Engineer", hiringOrganization: {name: "BigBank"}},
    [{"@type": "JobPosting", title: "Backend Engineer", hiringOrganization: "BigBank"}],
    {"@graph": [{"@type": "Organization"}, {"@type": ["Thing", "JobPosting"], title: "Backend Engineer", hiringOrganization: {name: "BigBank"}}]},
  ])("reads supported JobPosting structured data", (data) => {
    const {destination} = execute(`<h1>Generic jobs page</h1><script type="application/ld+json">${JSON.stringify(data)}</script>`);
    expect(readListingImport(destination!.hash)).toEqual({...listing, title: "Backend Engineer", company: "BigBank"});
  });
  it("survives malformed JSON and uses the page title without guessing a company", () => {
    const {destination} = execute('<script type="application/ld+json">{bad json}</script>');
    expect(readListingImport(destination!.hash)).toEqual({...listing, title: "Fallback title", company: ""});
  });
  it("does not choose an arbitrary company when several jobs are present", () => {
    const data: Record<string, unknown>[] = [
      {"@type": "JobPosting", title: "Wrong role", hiringOrganization: {name: "Wrong company"}},
      {"@type": "JobPosting", title: "Another role", hiringOrganization: {name: "Another company"}},
    ];
    const {destination} = execute(`<h1>Selected role</h1><script type="application/ld+json">${JSON.stringify(data)}</script>`);
    expect(readListingImport(destination!.hash)).toMatchObject({title: "Selected role", company: ""});
    data[1] = {...data[1], url: listing.url};
    const selected = execute(`<script type="application/ld+json">${JSON.stringify(data)}</script>`);
    expect(readListingImport(selected.destination!.hash)).toMatchObject({title: "Another role", company: "Another company"});
  });
  it("does not execute hostile metadata", () => {
    const title = `');window.hacked=true;// <img src=x onerror=alert(1)>`;
    const {destination} = execute(`<script type="application/ld+json">${JSON.stringify({"@type": "JobPosting", title})}</script>`);
    expect(readListingImport(destination!.hash)?.title).toBe(title);
    expect((window as any).hacked).toBeUndefined();
  });
  it("ignores unsupported pages and offers a fallback for overlong links", () => {
    expect(execute("", "file:///tmp/job.html").opened).not.toHaveBeenCalled();
    const result = execute("", `https://example.com/${"x".repeat(2048)}`);
    expect(result.opened).not.toHaveBeenCalled();
    expect(result.alert).toHaveBeenCalledWith(expect.stringContaining("paste"));
  });
  it("rejects unsafe app destinations while supporting local development", () => {
    expect(() => buildJobBookmarklet("javascript:alert(1)")).toThrow();
    expect(() => buildJobBookmarklet("http://evil.test")).toThrow();
    expect(buildJobBookmarklet("http://localhost:3000")).toMatch(/^javascript:/);
  });
});
