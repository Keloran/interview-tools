import {isOpenOffer} from "@/lib/offers";

export type CalendarInterview = {id: number; date: Date | null; deadline: Date | null; durationMinutes: number; jobTitle: string; clientCompany: string | null; interviewer: string | null; notes: string | null; link: string | null; outcome: string | null; company: {name: string}; stage: {stage: string}};
const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
const escapeText = (text: string) => text.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
// RFC 5545: lines fold at 75 UTF-8 octets; DATE-valued DTEND is exclusive.
// https://www.rfc-editor.org/rfc/rfc5545.html
export function foldCalendarLine(line: string): string {
  const encoder = new TextEncoder(), lines: string[] = [];
  let current = "", bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) {lines.push(current); current = " "; bytes = 1;}
    current += char; bytes += size;
  }
  lines.push(current); return lines.join("\r\n");
}
export function calendarEvent(interview: CalendarInterview, now = new Date()): string {
  const offer = interview.stage.stage.trim().toLowerCase() === "offer";
  if (offer ? !isOpenOffer(interview.stage.stage, interview.outcome) || !interview.deadline : interview.outcome !== "SCHEDULED") return "";
  if (!interview.deadline && !interview.date) return "";
  const lines = ["BEGIN:VEVENT", `UID:interview-${interview.id}@interviews.app`, `DTSTAMP:${stamp(now)}`];
  if (interview.deadline) {
    const start = new Date(interview.deadline), end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${start.toISOString().slice(0, 10).replace(/-/g, "")}`, `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, "")}`, "TRANSP:TRANSPARENT");
  } else {
    lines.push(`DTSTART:${stamp(interview.date!)}`, `DTEND:${stamp(new Date(interview.date!.getTime() + interview.durationMinutes * 60000))}`);
  }
  const company = interview.clientCompany || interview.company.name;
  const title = offer ? "Offer response deadline" : interview.deadline ? `${interview.stage.stage} deadline` : "Interview";
  lines.push(`SUMMARY:${escapeText(`${title}: ${interview.jobTitle} - ${company}`)}`);
  const description = [`Stage: ${interview.stage.stage}`, interview.interviewer ? `Interviewer: ${interview.interviewer}` : null, interview.notes ? `Notes: ${interview.notes}` : null].filter(Boolean).join("\n");
  lines.push(`DESCRIPTION:${escapeText(description)}`, "STATUS:CONFIRMED");
  if (interview.link) lines.push(`LOCATION:${escapeText(interview.link)}`);
  if (offer || !interview.deadline) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", offer ? "DESCRIPTION:Offer response due tomorrow" : "DESCRIPTION:Interview in 30 minutes", offer ? "TRIGGER:-P1D" : "TRIGGER:-PT30M", "END:VALARM");
  lines.push("END:VEVENT"); return lines.map(foldCalendarLine).join("\r\n") + "\r\n";
}
export function calendarFeed(interviews: CalendarInterview[], now = new Date()): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Interview Tracker//Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Interview Schedule", "X-WR-TIMEZONE:UTC", ""].join("\r\n") + interviews.map((interview) => calendarEvent(interview, now)).join("") + "END:VCALENDAR\r\n";
}
