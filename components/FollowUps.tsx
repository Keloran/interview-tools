"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import SendMessage from "@/components/SendMessage";
import {timeAgo} from "@/lib/applications";
import {times} from "@/lib/followUps";
import {reportClientError} from "@/lib/reportClientError";

export type DueFollowUp = {
  id: number;
  jobTitle: string;
  company: string;
  clientCompany: string | null;
  applicationDate: string;
  stage: string;
  interviewer: string | null;
  date: string | null;
  nextStep: string | null;
  replyBy: string | null;
  followUps: number;
  lastFollowUp: string | null;
  dueAt: string;
};

const dayFmt = new Intl.DateTimeFormat(undefined, {day: "numeric", month: "short"});

// Why it's due, e.g. "Said they'd reply by 12 Oct" or "Technical 6 days ago"
function reason(a: DueFollowUp): string {
  if (a.lastFollowUp) return `Followed up ${times(a.followUps)}, last ${timeAgo(a.lastFollowUp)}`;
  if (a.replyBy) return `Said they'd reply by ${dayFmt.format(new Date(a.replyBy))}`;
  if (a.stage === "Applied") return `Applied ${timeAgo(a.applicationDate)}`;
  return `${a.stage} ${timeAgo(a.date ?? a.applicationDate)}`;
}

export function useDueFollowUps() {
  return useQuery<DueFollowUp[]>({
    queryKey: ["follow-ups"],
    queryFn: async () => {
      const res = await fetch("/api/follow-ups");
      if (!res.ok) throw new Error("Failed to load follow-ups");
      return res.json();
    },
  });
}

export default function FollowUps() {
  const queryClient = useQueryClient();
  const {data} = useDueFollowUps();
  const [selected, setSelected] = useState<DueFollowUp | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markSent = async (a: DueFollowUp) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({applicationId: a.id}),
      });
      if (!res.ok) throw new Error(`Logging follow-up failed: ${res.status}`);
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ["follow-ups"]}),
        queryClient.invalidateQueries({queryKey: ["companies"]}),
      ]);
      setSelected(null);
    } catch (e) {
      reportClientError("Failed to log follow-up", e);
      setError("Couldn't save that, try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Due a follow-up{data?.length ? ` (${data.length})` : ""}</CardTitle>
        <CardDescription>
          Waiting on a reply: 10 days after applying, 5 after an interview, or the day after they said they&apos;d get back to you.
          Anything quiet for a month, or chased twice already, counts as ghosted and drops off.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <p className="text-muted-foreground text-center py-8">Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nothing to chase right now.</p>
        ) : (
          <div className="space-y-3">
            {data.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-4">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{a.clientCompany || a.company}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground text-sm">{a.jobTitle}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{reason(a)}</span>
                </div>
                <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setSelected(a)}>
                  Follow up
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Follow up - {selected?.jobTitle}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="flex flex-col gap-3">
              <SendMessage
                key={selected.id}
                templates={["follow-up"]}
                context={{
                  jobTitle: selected.jobTitle,
                  company: selected.company,
                  clientCompany: selected.clientCompany,
                  stage: selected.stage,
                  interviewer: selected.interviewer,
                  date: selected.date ? new Date(selected.date) : null,
                }}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="cursor-pointer" disabled={saving} onClick={() => markSent(selected)}>
                {saving ? "Saving…" : "I've sent it"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
