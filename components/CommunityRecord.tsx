"use client";
import {Button} from "@/components/ui/button";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import type {ApplicationSummary} from "@/lib/applications";
import {communitySummarySchema, CommunitySummary} from "@/lib/communityAggregation";

export function CommunityRecord({employerId, name, compact = false}: {employerId: string; name?: string | null; compact?: boolean}) {
  const {data, isPending, error} = useQuery<CommunitySummary | null>({queryKey: ["community-summary", employerId], staleTime: 0, refetchInterval: 30000, refetchOnMount: "always", queryFn: async () => {
    const response = await fetch(`/api/community/employers/${employerId}/summary`, {cache: "no-store"});
    if (!response.ok) throw new Error("Community summary unavailable");
    const result = await response.json();
    if (result.summary === null) return null;
    const parsed = communitySummarySchema.safeParse(result.summary); if (!parsed.success) throw new Error("Community summary unavailable"); return parsed.data;
  }});
  const current = data?.month === new Date().toISOString().slice(0, 7) ? data : null;
  const record = current ? [current.responseRate !== null ? `Replied at least once: about ${current.responseRate}%` : null,
    current.ghostingRate !== null ? `Closed as No response: about ${current.ghostingRate}%` : null,
    current.feedbackRate !== null ? `Recorded feedback: about ${current.feedbackRate}%` : null,
    current.replyTimeBand ? `Median first reply: ${current.replyTimeBand}` : null].filter(Boolean).join(" · ") : null;
  return <div className="space-y-1 text-xs text-muted-foreground" aria-label={`Community record${name ? ` for ${name}` : ""}`}>
    <p className="font-medium">Community{name ? ` · ${name}` : ""}</p>
    {error ? <p>Community summary unavailable.</p> : isPending ? <p>Checking community summary…</p> : !current ? <p>Insufficient community data to show a summary.</p> : <><p>{record}</p><p>Snapshot {current.month} · smallest metric sample {current.sampleBand} accounts. Voluntary reports; small groups and unknown history are omitted.</p></>}
    {!compact && <div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link href="/community">Manage community sharing</Link></Button><Button asChild variant="outline" size="sm"><Link href="/privacy/community">Privacy notice</Link></Button></div>}
  </div>;
}
export function CommunityRecords({applications, compact = false}: {applications: Pick<ApplicationSummary, "communityEmployerId" | "communityEmployerName">[]; compact?: boolean}) {
  const employers = new Map<string, string | null>();
  for (const application of applications) if (application.communityEmployerId) employers.set(application.communityEmployerId, application.communityEmployerName ?? null);
  return employers.size ? <div className="space-y-2">{[...employers].map(([id, name]) => <CommunityRecord key={id} employerId={id} name={name} compact={compact} />)}</div> : <p className="text-xs text-muted-foreground">Community: insufficient data to show a summary.</p>;
}
