import {ApplicationSummary} from "@/lib/applications";
import {recruiterStats} from "@/lib/recruiters";

export default function RecruiterRecord({applications}: {applications: ApplicationSummary[]}) {
  const stats = recruiterStats(applications);
  return <div className="text-sm space-y-1">
    <p>{stats.roles} role{stats.roles === 1 ? "" : "s"} · responded to {stats.responded} · ghosted {stats.ghosted} · waiting {stats.waiting}</p>
    <p className="text-muted-foreground">Response rate: {stats.responseRate === null ? "Not enough history" : `${stats.responseRate}%`} · Ghost rate: {stats.ghostRate === null ? "Not enough history" : `${stats.ghostRate}%`}</p>
    <p className="text-muted-foreground">Feedback: {stats.feedback} of {stats.feedbackNoted} noted rejections{stats.feedbackRate === null ? " (not recorded yet)" : ` (${stats.feedbackRate}%)`}</p>
  </div>;
}
