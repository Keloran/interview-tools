"use client";

import Link from "next/link";
import {useState} from "react";
import {useUser} from "@clerk/nextjs";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import type {StaleCandidate} from "@/lib/staleApplications";

type Preview = {days: number; total: number; candidates: StaleCandidate[]};
const applicationCount = (count: number) => `${count} application${count === 1 ? "" : "s"}`;
export default function StaleApplications() {
  const {user} = useUser();
  return user ? <StaleForm key={user.id} userId={user.id} /> : null;
}
function StaleForm({userId}: {userId: string}) {
  const queryClient = useQueryClient(), router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const {data, isPending, error: loadError, refetch} = useQuery<Preview>({queryKey: ["stale-applications", userId], queryFn: async () => {
    const response = await fetch("/api/stale-applications"); if (!response.ok) throw new Error(); return response.json();
  }});
  const chosen = data?.candidates.filter((candidate) => selected.includes(candidate.id)) ?? [];
  async function close() {
    if (!data || !chosen.length) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/stale-applications", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ids: chosen.map((candidate) => candidate.id), days: data.days, confirm: true})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Could not close applications.");
      setMessage(`Closed ${applicationCount(result.closed.length)} as No response; skipped ${result.skipped.length} that changed, were already closed or were no longer eligible.`);
      setSelected([]); setReview(false);
      await Promise.all(["stale-applications", "interviews", "companies", "search-report", "activity-log", "follow-ups", "application-timeline"].map((key) => queryClient.invalidateQueries({queryKey: [key]})));
      router.refresh();
    } catch (err) {setError(err instanceof Error ? err.message : "Could not close applications. Please refresh before trying again.");}
    finally {setBusy(false);}
  }
  return <Card className="p-4 gap-3">
    <h2 className="text-xl font-semibold">Close stale applications</h2>
    <p className="text-sm text-muted-foreground">Review applications with no change for your chosen number of days. Future interviews, deadlines and promised reply dates keep an application out of this list. Nothing closes until you select it and confirm. Your records stay available, and you can reopen a No response stage from the interview list.</p>
    {loadError ? <div role="alert">Could not load stale applications. <Button onClick={() => refetch()}>Try again</Button></div> : isPending ? <p role="status">Checking stale applications…</p> : data && <>
      <Threshold key={data.days} days={data.days} disabled={busy} onBusy={setBusy} onSaved={async () => {setSelected([]); setReview(false); await queryClient.invalidateQueries({queryKey: ["stale-applications"]});}} />
      <p>{applicationCount(data.total)} eligible after {data.days} days without a change{data.total > data.candidates.length ? `; showing the oldest ${data.candidates.length}` : ""}.</p>
      {!!data.candidates.length && <>
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => {setSelected(data.candidates.map((candidate) => candidate.id)); setReview(false);}}>Select all shown</Button><Button size="sm" variant="outline" disabled={busy || !selected.length} onClick={() => {setSelected([]); setReview(false);}}>Clear selection</Button></div>
        <ul className="max-h-96 space-y-3 overflow-y-auto">{data.candidates.map((candidate) => <li key={candidate.id} className="rounded border p-3 space-y-1"><label className="flex items-start gap-2"><input type="checkbox" disabled={busy} checked={selected.includes(candidate.id)} onChange={(event) => {setSelected(event.target.checked ? [...selected, candidate.id] : selected.filter((id) => id !== candidate.id)); setReview(false);}} /><span>{candidate.jobTitle} · {candidate.company}</span></label><p className="text-xs text-muted-foreground">{candidate.quietDays} days without a change · {candidate.lastStage} · last activity {new Date(candidate.lastActivity).toLocaleDateString()}</p><Link className="text-sm underline" href={`/applications/${candidate.id}`}>Review application timeline</Link></li>)}</ul>
        {!review ? <Button disabled={busy || !chosen.length} onClick={() => setReview(true)}>Review selected closures ({chosen.length})</Button> : <div className="rounded border p-3 space-y-3">
          <p className="font-medium">Close {applicationCount(chosen.length)} as No response?</p><ul className="text-sm list-disc pl-5">{chosen.map((candidate) => <li key={candidate.id}>{candidate.jobTitle} · {candidate.company}</li>)}</ul><p className="text-sm">They will count as ghosted rather than awaiting a reply. The server checks again and skips anything that has changed or is no longer eligible.</p><div className="flex gap-2"><Button disabled={busy || !chosen.length} onClick={close}>Confirm close as No response</Button><Button variant="outline" disabled={busy} onClick={() => setReview(false)}>Cancel</Button></div>
        </div>}
      </>}
    </>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {message && <p role="status">{message}</p>}
  </Card>;
}
function Threshold({days, disabled, onSaved, onBusy}: {days: number; disabled: boolean; onSaved: () => Promise<void>; onBusy: (busy: boolean) => void}) {
  const [value, setValue] = useState(String(days)), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <form className="space-y-2" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); onBusy(true); setError("");
    try {const response = await fetch("/api/stale-applications", {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({days: Number(value)})}); const data = await response.json(); if (!response.ok) throw new Error(data.message); await onSaved();}
    catch (err) {setError(err instanceof Error ? err.message : "Could not save the threshold.");} finally {setBusy(false); onBusy(false);}
  }}><Label htmlFor="stale-days">Days without a change</Label><div className="flex flex-wrap gap-2"><Input id="stale-days" className="w-32" type="number" min={1} max={3650} step={1} value={value} disabled={disabled || busy} onChange={(event) => setValue(event.target.value)} /><Button variant="outline" type="submit" disabled={disabled || busy || Number(value) === days}>Save threshold</Button></div><p className="text-xs text-muted-foreground">Default 60 days. Saving this setting only changes the preview; it never closes applications.</p>{error && <p role="alert">{error}</p>}</form>;
}
