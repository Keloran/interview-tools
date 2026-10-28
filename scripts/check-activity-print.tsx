import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {execFileSync} from "node:child_process";
import {mkdtempSync, readFileSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import assert from "node:assert/strict";
import ActivityPrint from "../components/ActivityPrint";
import type {ActivityRow} from "../lib/activityLog";

const directory = mkdtempSync(join(tmpdir(), "interview-tools-activity-print-"));
const html = join(directory, "activity-log.html");
const pdf = join(directory, "activity-log.pdf");
const rows: ActivityRow[] = Array.from({length: 80}, (_, index) => ({
  id: `sample-${index}`, date: "2026-10-27", timestamp: index, kind: "other", activity: `Sample activity ${index + 1}`,
  employer: "Société Example", role: "Senior Software Engineer", how: "Careers fair / recruiter", outcome: "Follow-up arranged", notes: `Discussed the role and next steps.\nDetails for activity ${index + 1}.`,
}));
const css = readFileSync("app/activity-log/activity-log.css", "utf8");
const content = renderToStaticMarkup(<main><div><header>HIDDEN SITE HEADER</header><section className="activity-log-page"><div className="no-print">HIDDEN EXPORT CONTROLS</div><ActivityPrint rows={rows} from="2026-10-01" through="2026-10-28" /></section></div></main>);
writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><title>Activity log print check</title><style>body{background:#111;color:white;font-family:Arial,sans-serif}${css}</style></head><body>${content}</body></html>`);
// Bound the page-load wait as well as process startup/exit on shared CI runners.
// https://developer.chrome.com/docs/automation-and-testing/headless-cli
execFileSync(process.env.CHROME_BIN ?? "google-chrome", ["--headless", "--timeout=15000", "--disable-gpu", "--no-sandbox", "--disable-background-networking", "--disable-extensions", "--no-first-run", `--user-data-dir=${join(directory, "browser")}`, "--no-pdf-header-footer", `--print-to-pdf=${pdf}`, `file://${html}`], {timeout: 60000, stdio: "pipe"});
assert.equal(readFileSync(pdf).subarray(0, 5).toString(), "%PDF-");
const env = {...process.env, LC_ALL: "C"};
const info = execFileSync("pdfinfo", [pdf], {encoding: "utf8", env});
const pages = Number(info.match(/Pages:\s+(\d+)/)?.[1]);
assert.ok(pages >= 2, `Expected multiple pages, found ${pages}`);
const rawText = execFileSync("pdftotext", [pdf, "-"], {encoding: "utf8", env});
const text = rawText.replace(/\s+/g, " ");
for (const expected of ["Job search activity log", "80 activities", "Sample activity 80", "Details for activity 80.", "Société Example", "2026-10-01 to 2026-10-28"]) assert.ok(text.includes(expected), `PDF missing ${expected}`);
assert.ok(!text.includes("HIDDEN SITE HEADER") && !text.includes("HIDDEN EXPORT CONTROLS"), "Navigation or export controls leaked into the printout");
assert.ok((rawText.match(/\bDate\b/g) ?? []).length >= pages, "Table headers did not repeat across pages");
console.log(`Activity PDF passed: ${pages} pages, 80 rows, repeated headers, accented text and final notes. Artifact: ${pdf}`);
