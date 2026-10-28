"use client";

import Link from "next/link";
import {useState} from "react";
import {useUser} from "@clerk/nextjs";
import {useQuery} from "@tanstack/react-query";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Button} from "@/components/ui/button";
import {defaultPeriod, reportPeriod, searchReport} from "@/lib/searchReport";
import type {ReportHistory} from "@/lib/companyHistory";

const rate = (value: number | null) => value === null ? "Unknown" : `${value}%`;
const days = (value: number | null) => value === null ? "Unknown" : `${value} day${value === 1 ? "" : "s"}`;
export default function SearchReport() {
  const {user} = useUser();
  const [range, setRange] = useState(() => defaultPeriod());
  const {data, isPending, error, refetch} = useQuery<ReportHistory>({queryKey: ["search-report", user?.id], enabled: !!user,
    queryFn: async () => {const response = await fetch("/api/report"); if (!response.ok) throw new Error("Could not load your report"); return response.json();}});
  if (!user) return null;
  const period = reportPeriod(range.from, range.through);
  const report = data && period ? searchReport(data, period) : null;
  return <section className="space-y-5">
    <h2 className="text-xl font-semibold">Your job-search report</h2>
    <Link className="text-sm underline" href="/company-insights">Company insights</Link>
    <div className="flex flex-wrap gap-4"><div><Label htmlFor="report-from">From</Label><Input id="report-from" type="date" value={range.from} onChange={(event) => setRange({...range, from: event.target.value})} /></div><div><Label htmlFor="report-through">Through</Label><Input id="report-through" type="date" value={range.through} onChange={(event) => setRange({...range, through: event.target.value})} /></div></div>
    <p className="text-sm text-muted-foreground">Dates and weeks use your browser&apos;s local time. Funnel, response and source figures cover applications made in this period, using their current outcomes. Weekly activity counts applications and dated interviews within the period, including interviews for earlier applications.</p>
    {!period && <p role="alert">Choose valid start and end dates, in order, covering at most ten years.</p>}
    {error ? <div role="alert"><p>Could not load your report.</p><Button onClick={() => refetch()}>Try again</Button></div> : isPending ? <p role="status">Loading your report…</p> : report && <>
      <Card className="p-4 gap-3"><h3 className="font-semibold">Application funnel</h3><p className="text-sm text-muted-foreground">Cumulative milestones reached, including scheduled stages: a later stage includes earlier steps. Screens and assessments include phone screens and technical tests; other non-Applied stages count as interview stages. Offer and Final stages use their recorded names or offer outcomes.</p>
        <ol className="space-y-3">{report.funnel.map((step) => <li key={step.label} className="space-y-1"><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{step.label}: {step.count}</span><span className="text-muted-foreground">{step.conversion === null ? "—" : `${step.conversion}% from previous step`}</span></div><div className="h-2 rounded bg-muted"><div className="h-full rounded bg-primary" style={{width: `${report.response.roles ? step.count * 100 / report.response.roles : 0}%`}} /></div></li>)}</ol>
      </Card>
      <Card className="p-4 gap-3"><h3 className="font-semibold">Response</h3><dl className="grid gap-4 sm:grid-cols-3 text-sm">{[["Responded", `${rate(report.response.responseRate)} (${report.response.responded})`], ["Ghosted", `${rate(report.response.ghostRate)} (${report.response.ghosted})`], ["Median days to first reply", `${days(report.response.medianReplyDays)} · ${report.response.replyDates} known date${report.response.replyDates === 1 ? "" : "s"}`]].map(([label, value]) => <div key={label}><dt className="font-medium">{label}</dt><dd>{value}</dd></div>)}</dl><p className="text-sm text-muted-foreground">Rates exclude {report.response.waiting} waiting applications. Reply times use only explicit dates, in UTC calendar days, matching company records.</p></Card>
      <Card className="p-4 gap-3"><h3 className="font-semibold">Weekly activity</h3><p className="text-sm text-muted-foreground">Weeks start on Monday. Undated stages, offers and technical-test deadlines do not count as dated interviews.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Week starting", "Applications", "Interviews"].map((label) => <th className="p-2 border-b" key={label}>{label}</th>)}</tr></thead><tbody>{report.weekly.map((week) => <tr key={week.week}><td className="p-2">{week.week}</td><td className="p-2">{week.applications}</td><td className="p-2">{week.interviews}</td></tr>)}</tbody></table></div></Card>
      <Card className="p-4 gap-3"><h3 className="font-semibold">By source</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Source", "Applications", "Response rate", "Ghost rate", "Median first reply", "Known reply dates"].map((label) => <th className="p-2 border-b" key={label}>{label}</th>)}</tr></thead><tbody>{report.sources.map((source) => <tr key={source.source}><td className="p-2">{source.source}</td><td className="p-2">{source.roles}</td><td className="p-2">{rate(source.responseRate)}</td><td className="p-2">{rate(source.ghostRate)}</td><td className="p-2">{days(source.medianReplyDays)}</td><td className="p-2">{source.replyDates}</td></tr>)}</tbody></table></div></Card>
      {!report.response.roles && <p>No applications were made in this period.</p>}
    </>}
  </section>;
}
