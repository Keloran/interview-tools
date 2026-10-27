import {z} from "zod";
import {ApplicationSummary, CompanyHistory, findPreviousApplications} from "@/lib/applications";
import {CSVTable, EXPORT_FORMAT, restoreExportText} from "@/lib/csv";

export const IMPORT_FIELDS = ["company", "jobTitle", "applicationDate", "jobPostingLink", "outcome", "clientCompany"] as const;
export type ImportField = typeof IMPORT_FIELDS[number];
const column = z.number().int().min(0).max(99).nullable();
export const mappingSchema = z.object({company: column, jobTitle: column, applicationDate: column, jobPostingLink: column, outcome: column, clientCompany: column});
export type ColumnMapping = z.infer<typeof mappingSchema>;
export const FIELD_LABELS: Record<ImportField, string> = {company: "Company", jobTitle: "Job title", applicationDate: "Date applied", jobPostingLink: "Job link (optional)", outcome: "Status (optional)", clientCompany: "Client company (optional)"};
const required: ImportField[] = ["company", "jobTitle", "applicationDate"];
const key = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
const HEADERS: Record<ImportField, string[]> = {
  company: ["company", "companyname", "employer"], jobTitle: ["jobtitle", "title", "role"], applicationDate: ["applicationdate", "dateapplied", "applieddate", "date"],
  jobPostingLink: ["jobpostinglink", "joblink", "link", "url"], outcome: ["outcome", "status"], clientCompany: ["clientcompany", "endclient", "client"],
};
export function guessMapping(headers: string[]): ColumnMapping {
  return Object.fromEntries(IMPORT_FIELDS.map((field) => {
    const index = headers.findIndex((header) => HEADERS[field].includes(key(header)));
    return [field, index < 0 ? null : index];
  })) as ColumnMapping;
}
export function validateMapping(mapping: ColumnMapping, headers: string[]): void {
  const used = new Set<number>();
  for (const field of IMPORT_FIELDS) {
    const index = mapping[field];
    if (index === null) {if (required.includes(field)) throw new Error(`Map the ${FIELD_LABELS[field]} column.`); continue;}
    if (!Number.isInteger(index) || index < 0 || index >= headers.length) throw new Error(`The ${FIELD_LABELS[field]} column does not exist.`);
    if (used.has(index)) throw new Error("Map each CSV column to only one field.");
    used.add(index);
  }
}

export function importDate(text: string): string | null {
  let year: number, month: number, day: number;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/);
  const uk = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (iso) [year, month, day] = iso.slice(1, 4).map(Number);
  else if (uk) [day, month, year] = uk.slice(1).map(Number);
  else return null;
  const check = new Date(0); check.setUTCFullYear(year, month - 1, day); check.setUTCHours(0, 0, 0, 0);
  if (year < 1 || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  if (text.includes("T")) return Number.isNaN(Date.parse(text)) ? null : new Date(text).toISOString();
  return check.toISOString();
}

export const OUTCOMES = ["SCHEDULED", "PASSED", "REJECTED", "AWAITING_RESPONSE", "OFFER_RECEIVED", "OFFER_ACCEPTED", "OFFER_DECLINED", "WITHDREW"] as const;
export type ImportOutcome = typeof OUTCOMES[number];
function outcome(text: string): ImportOutcome | null {
  const normalized = text.trim().toUpperCase().replace(/[ -]+/g, "_");
  if (["", "APPLIED", "PENDING", "WAITING", "AWAITING_RESPONSE"].includes(normalized)) return "AWAITING_RESPONSE";
  if (normalized === "WITHDRAWN") return "WITHDREW";
  return OUTCOMES.includes(normalized as ImportOutcome) ? normalized as ImportOutcome : null;
}

export type ImportedApplication = {company: string; jobTitle: string; applicationDate: string; jobPostingLink: string; clientCompany: string; outcome: ImportOutcome};
export type ImportRow = {line: number; company: string; jobTitle: string; applicationDate: string; status: "ready" | "duplicate" | "error" | "imported"; reason: string; data?: ImportedApplication};
export type ImportPlan = {rows: ImportRow[]; ready: number; duplicates: number; errors: number; imported: number};
export type ImportHistoryRow = {id: number; jobTitle: string; clientCompany: string | null; applicationDate: Date; jobPostingLink: string | null; company: {id: number; name: string}};
export function importHistory(rows: ImportHistoryRow[]): CompanyHistory[] {
  const companies = new Map<number, CompanyHistory>();
  for (const {company, ...application} of rows) {
    if (!companies.has(company.id)) companies.set(company.id, {...company, applications: []});
    companies.get(company.id)!.applications.push({...application, status: "", response: "waiting"});
  }
  return [...companies.values()];
}
export function planImport(table: CSVTable, mapping: ColumnMapping, history: CompanyHistory[] = []): ImportPlan {
  validateMapping(mapping, table.headers);
  const tracked = history.map((company) => ({...company, applications: [...company.applications]}));
  const formatIndex = table.headers.findIndex((header) => header === "exportFormat");
  const rows: ImportRow[] = table.records.map(({line, cells}) => {
    const ownExport = formatIndex >= 0 && cells[formatIndex] === EXPORT_FORMAT;
    const read = (field: ImportField) => {
      const index = mapping[field];
      const raw = index === null ? "" : cells[index] ?? "";
      return (ownExport ? restoreExportText(raw) : raw).trim();
    };
    const company = read("company"), jobTitle = read("jobTitle"), rawDate = read("applicationDate");
    const row: ImportRow = {line, company, jobTitle, applicationDate: rawDate, status: "error", reason: ""};
    const errors: string[] = [];
    if (IMPORT_FIELDS.some((field) => read(field).includes("\0"))) errors.push("Text fields cannot contain null characters");
    if (cells.length !== table.headers.length) errors.push(`Expected ${table.headers.length} columns, found ${cells.length}`);
    if (!company || company.length > 200) errors.push("Company is required and must be at most 200 characters");
    if (!jobTitle || jobTitle.length > 200) errors.push("Job title is required and must be at most 200 characters");
    const applicationDate = importDate(rawDate);
    if (!applicationDate) errors.push("Use a valid YYYY-MM-DD or DD/MM/YYYY date applied");
    const link = read("jobPostingLink");
    if (link) {try {const url = new URL(link); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || /[\u0000-\u0020\u007f]/.test(link) || link.length > 2048) throw new Error();} catch {errors.push("Job link must be an HTTP(S) URL without credentials, at most 2,048 characters");}}
    const clientCompany = read("clientCompany");
    if (clientCompany.length > 200) errors.push("Client company must be at most 200 characters");
    const status = outcome(read("outcome"));
    if (!status) errors.push("Unknown status: use Applied, Pending, Scheduled, Passed, Rejected, Awaiting response, Offer received/accepted/declined, or Withdrew");
    if (errors.length) return {...row, reason: errors.join("; ")};
    const duplicate = findPreviousApplications(tracked, company, clientCompany, jobTitle, link).find((previous) => previous.samePosting || previous.sameTitle);
    if (duplicate) return {...row, status: "duplicate", reason: duplicate.id < 0 ? `Matches an earlier row at line ${-duplicate.id}` : `Already tracked: ${duplicate.jobTitle} at ${duplicate.companyName}`};
    const data: ImportedApplication = {company, jobTitle, applicationDate: applicationDate!, jobPostingLink: link, clientCompany, outcome: status!};
    const entry: ApplicationSummary = {id: -line, jobTitle, clientCompany: clientCompany || null, applicationDate: applicationDate!, jobPostingLink: link || null, status: "", response: "waiting"};
    const existing = tracked.find((item) => item.name.trim().toLowerCase() === company.toLowerCase());
    if (existing) existing.applications.push(entry); else tracked.push({id: -line, name: company, applications: [entry]});
    return {...row, status: "ready", reason: "New application", applicationDate: applicationDate!, data};
  });
  return summarizeImport(rows);
}
export function summarizeImport(rows: ImportRow[]): ImportPlan {
  const count = (status: ImportRow["status"]) => rows.filter((row) => row.status === status).length;
  return {rows, ready: count("ready"), duplicates: count("duplicate"), errors: count("error"), imported: count("imported")};
}
