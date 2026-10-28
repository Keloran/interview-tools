"use client";

import Link from "next/link";
import {useState} from "react";
import {useUser} from "@clerk/nextjs";
import {useQuery} from "@tanstack/react-query";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {FEEDBACK_LABEL} from "@/lib/feedback";
import {dayLabel, daysBetween, OUTCOME_LABELS, stageDate, TimelineApplication, TimelineStage, timelineActivity, timelineSummary} from "@/lib/timeline";

function DateLabel({date}: {date: string}) {
  return <time dateTime={date}>{new Date(date).toLocaleString(undefined, {year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"})}</time>;
}

export default function ApplicationTimeline({applicationId}: {applicationId: string}) {
  const {user} = useUser();
  const [now] = useState(() => Date.now());
  const {data, isPending, error, refetch} = useQuery<TimelineApplication>({
    queryKey: ["application-timeline", user?.id, applicationId], enabled: !!user,
    queryFn: async () => {
      const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/timeline`);
      if (!response.ok) throw new Error(response.status === 404 ? "Application not found." : "Could not load this application. Please try again.");
      return response.json();
    },
  });
  if (!user) return null;
  if (error) return <div role="alert" className="space-y-3"><p>{error.message}</p><Button onClick={() => refetch()}>Try again</Button><p><Link className="underline" href="/companies">Back to companies</Link></p></div>;
  if (isPending || !data) return <p role="status">Loading application timeline…</p>;
  const summary = timelineSummary(data, now);
  const activity = timelineActivity(data);
  return <section className="space-y-6">
    <nav className="flex flex-wrap gap-4 text-sm"><Link className="underline" href="/">Interview list</Link><Link className="underline" href={`/companies?q=${encodeURIComponent(data.company.name)}`}>Back to company</Link></nav>
    <Card className="p-4 gap-2">
      <h2 className="text-xl font-semibold">{data.jobTitle} · {data.clientCompany || data.company.name}</h2>
      {data.clientCompany && <p>Via {data.company.name}</p>}
      <p>Applied <DateLabel date={data.applicationDate} /></p>
      <p className="font-medium">{summary.closed ? "Final outcome" : "Current outcome"}: {summary.outcome}</p>
      {summary.days !== null && <p>{dayLabel(summary.days)} {summary.closed ? "in process through the latest recorded outcome update" : "in process so far"}</p>}
      {summary.closed && <p className="text-sm text-muted-foreground">Last updated <DateLabel date={summary.through} />. Updates may include later edits.</p>}
    </Card>
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Application timeline</h3>
      <p className="text-sm text-muted-foreground">Stages follow their recorded progression. Gaps compare stage dates, deadlines or recording dates; they do not measure an exact reply time.</p>
      <ol aria-label="Application stages" className="ml-2 border-l-2 pl-5 space-y-5">
        {!summary.stages.some((stage) => stage.stage.stage === "Applied") && <li><h4 className="font-semibold">Applied</h4><DateLabel date={data.applicationDate} /></li>}
        {summary.stages.map((stage, index) => {
          const parent = summary.stages.find((item) => item.id === stage.parentId) ?? summary.stages[index - 1];
          const previousDate = parent ? stageDate(parent, data.applicationDate).date : data.applicationDate;
          const date = stageDate(stage, data.applicationDate);
          const gap = daysBetween(previousDate, date.date);
          return <li key={stage.id} className="space-y-2 break-words">
            <h4 className="font-semibold">{stage.stage.stage}</h4>
            <p className="text-sm">{date.label} <DateLabel date={date.date} /></p>
            {stage.date && stage.deadline && <p className="text-sm">Deadline <DateLabel date={stage.deadline} /></p>}
            {stage.stage.stage !== "Applied" && gap !== null && <p className="text-sm text-muted-foreground">{dayLabel(gap)} after {parent?.stage.stage ?? "applying"}</p>}
            {stage.stage.stage !== "Applied" && gap === null && <p className="text-sm text-muted-foreground">Dates overlap or precede the previous step; shown in progression order.</p>}
            <p>{stage.stageMethod.method}{stage.interviewer && ` · ${stage.interviewer}`}</p>
            <p>Outcome: {OUTCOME_LABELS[stage.outcome ?? ""] ?? "Not recorded"}</p>
            <p className="text-xs text-muted-foreground">Last updated <DateLabel date={stage.updated_at} /></p>
            <StageDetails stage={stage} />
          </li>;
        })}
      </ol>
    </div>
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Follow-ups and availability</h3>
      {!activity.length ? <p className="text-muted-foreground">No follow-ups or availability links recorded.</p> : <ol aria-label="Application activity" className="ml-2 border-l-2 pl-5 space-y-4">{activity.map((event) => <li key={event.id}><h4 className="font-medium">{event.title}</h4><p className="text-sm"><DateLabel date={event.date} /></p><p className="text-sm text-muted-foreground">{event.detail}</p></li>)}</ol>}
    </div>
  </section>;
}

function StageDetails({stage}: {stage: TimelineStage}) {
  const rows: [string, string | number | null][] = [
    ["Notes", stage.notes], ["How it went (1–5)", stage.rating], ["Debrief", stage.debriefNotes],
    ["Who you met", stage.peopleMet], ["Questions they asked", stage.questionsAsked], ["Preparation", stage.prepNotes], ["What happens next", stage.nextStep],
  ];
  return <>
    {stage.feedbackType && <div><p className="text-sm font-medium">Feedback: {FEEDBACK_LABEL[stage.feedbackType]}</p>{stage.feedbackText && <p className="whitespace-pre-wrap text-sm">{stage.feedbackText}</p>}</div>}
    {!stage.feedbackType && stage.feedbackText && <p className="whitespace-pre-wrap text-sm">Feedback: {stage.feedbackText}</p>}
    {stage.replyBy && <p className="text-sm">Expected reply by <DateLabel date={stage.replyBy} /></p>}
    {rows.some(([, value]) => value !== null && value !== "") && <details><summary className="cursor-pointer text-sm underline">Notes and debrief</summary><dl className="mt-2 space-y-2">{rows.filter(([, value]) => value !== null && value !== "").map(([label, value]) => <div key={label}><dt className="text-sm font-medium">{label}</dt><dd className="text-sm whitespace-pre-wrap">{value}</dd></div>)}</dl></details>}
  </>;
}
