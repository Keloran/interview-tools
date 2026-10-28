"use client";

import Link from "next/link";
import {useUser} from "@clerk/nextjs";
import {useQuery} from "@tanstack/react-query";
import {getCompanies} from "@/components/Company";
import {Card} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import FirstReplyDate from "@/components/FirstReplyDate";
import {insights, insightsOverview} from "@/lib/companyInsights";
import {responseRecord} from "@/lib/applications";

const rate = (value: number | null) => value === null ? "Unknown" : `${value}%`;
const days = (value: number | null) => value === null ? "Unknown" : `${value} day${value === 1 ? "" : "s"}`;
function Metrics({value}: {value: ReturnType<typeof insights>}) {
  return <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">{[
    ["Applications", `${value.roles} (${value.waiting} waiting)`],
    ["Response rate", `${rate(value.responseRate)} · ${value.responded} responded`],
    ["Ghost rate", `${rate(value.ghostRate)} · ${value.ghosted} ghosted`],
    ["Median days to first reply", `${days(value.medianReplyDays)} · ${value.replyDates} known date${value.replyDates === 1 ? "" : "s"}`],
    ["Feedback rate", `${rate(value.feedbackRate)} · ${value.feedback} of ${value.feedbackNoted} noted rejections`],
    ["Furthest stage recorded", value.furthestStage], ["Availability links ignored", String(value.ignoredLinks)],
  ].map(([label, text]) => <div key={label}><dt className="font-medium">{label}</dt><dd className="text-muted-foreground">{text}</dd></div>)}</dl>;
}
export default function CompanyInsights({companyId}: {companyId?: string}) {
  const {user} = useUser();
  const {data, error, isPending, refetch} = useQuery({queryKey: ["companies", user?.id], queryFn: getCompanies, enabled: !!user});
  if (!user) return null;
  if (error) return <div role="alert"><p>Could not load company insights.</p><Button onClick={() => refetch()}>Try again</Button></div>;
  if (isPending || !data) return <p role="status">Loading company insights…</p>;
  const company = companyId ? data.find((company) => String(company.id) === companyId) : null;
  if (companyId && !company) return <div><p role="alert">Company not found.</p><Link className="underline" href="/companies">Back to companies</Link></div>;
  const overview = insightsOverview(data);
  return <section className="space-y-5">
    <nav className="flex flex-wrap gap-4 text-sm"><Link className="underline" href="/companies">Companies</Link>{company && <Link className="underline" href="/company-insights">All company insights</Link>}</nav>
    <h2 className="text-xl font-semibold">{company ? `${company.name}: your history` : "Company insights"}</h2>
    <Link className="text-sm underline" href="/report">Your job-search report</Link>
    <p className="text-sm text-muted-foreground">Based only on your applications. Response and ghost rates use settled histories; waiting applications are excluded. Feedback uses only rejections where you recorded whether feedback was given. Response times use explicit first-reply dates; unknown historical dates are excluded, without estimates.</p>
    <Card className="p-4"><Metrics value={company ? insights(company.applications) : overview.overall} /></Card>
    {company ? <>
      <p>{responseRecord(company.applications) ?? "No settled response history yet."}</p>
      <h3 className="text-lg font-semibold">Applications</h3>
      {!company.applications.length && <p>No applications recorded.</p>}
      <ul className="space-y-3">{company.applications.map((application) => <li key={application.id}><Card className="p-4 gap-3">
        <h4 className="font-semibold">{application.jobTitle}{application.clientCompany && ` · ${application.clientCompany}`}</h4>
        <p className="text-sm">Applied {new Date(application.applicationDate).toISOString().slice(0, 10)} · {application.status}</p>
        {application.promise && <p className="text-sm">{application.promise}</p>}
        <FirstReplyDate applicationId={application.id} applied={new Date(application.applicationDate).toISOString()} value={application.firstResponseAt ? new Date(application.firstResponseAt).toISOString() : null} />
      </Card></li>)}</ul>
    </> : <>
      <h3 className="text-lg font-semibold">Ghost rate by application month</h3>
      <p className="text-sm text-muted-foreground">Current outcomes grouped by the month you applied, rather than historical monthly snapshots.</p>
      {!overview.months.length ? <p>No application history yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Applied", "Applications", "Responded", "Ghosted", "Waiting", "Ghost rate"].map((label) => <th className="p-2 border-b" key={label}>{label}</th>)}</tr></thead><tbody>{overview.months.map((month) => <tr key={month.month}><td className="p-2">{month.month}</td><td className="p-2">{month.roles}</td><td className="p-2">{month.responded}</td><td className="p-2">{month.ghosted}</td><td className="p-2">{month.waiting}</td><td className="p-2">{rate(month.ghostRate)}</td></tr>)}</tbody></table></div>}
      <div className="grid gap-4 md:grid-cols-2"><Card className="p-4 gap-3"><h3 className="font-semibold">Most ghosted applications</h3>{!overview.ghostMost.length ? <p className="text-sm">No ghosted applications recorded.</p> : <ol className="space-y-2">{overview.ghostMost.map((company) => <li className="text-sm" key={company.id}><Link className="underline" href={`/companies/${company.id}`}>{company.name}</Link> · {company.ghosted} ghosted of {company.roles} applications ({rate(company.ghostRate)} of settled histories)</li>)}</ol>}</Card>
        <Card className="p-4 gap-3"><h3 className="font-semibold">Fastest first replies</h3>{!overview.fastest.length ? <p className="text-sm">Record a first-reply date on an application to start comparing response times.</p> : <ol className="space-y-2">{overview.fastest.map((company) => <li className="text-sm" key={company.id}><Link className="underline" href={`/companies/${company.id}`}>{company.name}</Link> · median {days(company.medianReplyDays)} ({company.replyDates} known date{company.replyDates === 1 ? "" : "s"})</li>)}</ol>}</Card></div>
    </>}
  </section>;
}
