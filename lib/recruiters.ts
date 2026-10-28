import {z} from "zod";
import {ApplicationSummary, CompanyHistory} from "@/lib/applications";

export const recruiterSchema = z.object({
  viaRecruiter: z.boolean().optional(),
  recruiterName: z.string().trim().max(200, "Use at most 200 characters for the recruiter name").refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Use a name without control characters").nullable().optional(),
  recruiterEmail: z.string().trim().max(254).email("Enter a valid recruiter email").or(z.literal("")).nullable().optional(),
  recruiterLinkedIn: z.string().trim().max(2048).refine((value) => {
    if (!value) return true;
    try {const url = new URL(value); return url.protocol === "https:" && ["linkedin.com", "www.linkedin.com"].includes(url.hostname) && !url.username && !url.password && !url.port && !/[\s\u0000-\u001f\u007f]/.test(value);} catch {return false;}
  }, "Use an HTTPS linkedin.com profile URL").nullable().optional(),
});
export type RecruiterContact = z.infer<typeof recruiterSchema>;
export const emptyContact = {viaRecruiter: false, recruiterName: "", recruiterEmail: "", recruiterLinkedIn: ""};
export function contactData(contact: RecruiterContact) {
  if (!contact.viaRecruiter) return {viaRecruiter: false, recruiterName: null, recruiterEmail: null, recruiterLinkedIn: null};
  return {viaRecruiter: contact.viaRecruiter ?? false, recruiterName: contact.recruiterName || null, recruiterEmail: contact.recruiterEmail || null, recruiterLinkedIn: contact.recruiterLinkedIn || null};
}
export function viaAgency(application: ApplicationSummary): boolean {return !!application.viaRecruiter || !!application.clientCompany?.trim();}
export function companyKind(applications: ApplicationSummary[]): string {
  const agencies = applications.filter(viaAgency).length;
  return agencies === 0 ? "Direct employer" : agencies === applications.length ? "Recruiter / agency" : "Employer and agency";
}
export function recruiterStats(applications: ApplicationSummary[]) {
  const responded = applications.filter((item) => item.response === "responded").length;
  const ghosted = applications.filter((item) => item.response === "ghosted").length;
  const noted = applications.filter((item) => item.feedback);
  const feedback = noted.filter((item) => item.feedback !== "NONE").length;
  const settled = responded + ghosted;
  return {roles: applications.length, responded, ghosted, waiting: applications.length - settled,
    responseRate: settled ? Math.round(responded * 100 / settled) : null,
    ghostRate: settled ? Math.round(ghosted * 100 / settled) : null,
    feedback, feedbackNoted: noted.length, feedbackRate: noted.length ? Math.round(feedback * 100 / noted.length) : null};
}
export type RecruiterRecord = {key: string; agency: string; contact: RecruiterContact | null; applications: ApplicationSummary[]};
export function recruiterRecords(history: CompanyHistory[]): RecruiterRecord[] {
  const records: RecruiterRecord[] = [];
  for (const company of history) {
    const applications = company.applications.filter(viaAgency);
    if (!applications.length) continue;
    records.push({key: `agency-${company.id}`, agency: company.name, contact: null, applications});
    const contacts = new Map<string, RecruiterRecord>();
    for (const application of applications) {
      if (!application.recruiterName && !application.recruiterEmail && !application.recruiterLinkedIn) continue;
      const identity = (application.recruiterEmail || application.recruiterLinkedIn || application.recruiterName || "").trim().toLowerCase();
      const key = `contact-${company.id}-${identity}`;
      const record = contacts.get(key) ?? {key, agency: company.name, contact: application, applications: []};
      record.applications.push(application); contacts.set(key, record);
    }
    records.push(...contacts.values());
  }
  return records.sort((a, b) => a.agency.localeCompare(b.agency, undefined, {sensitivity: "base"}) || Number(!!a.contact) - Number(!!b.contact) || (a.contact?.recruiterName ?? "").localeCompare(b.contact?.recruiterName ?? ""));
}
