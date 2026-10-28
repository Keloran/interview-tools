"use client";

import Link from "next/link";
import ActivityPrint from "@/components/ActivityPrint";
import {useState} from "react";
import {useUser} from "@clerk/nextjs";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {ActivityLogData, activityRows, activityCSV, activitySchema, FreeActivity} from "@/lib/activityLog";
import {defaultPeriod, localDay, parseLocalDay, reportPeriod} from "@/lib/searchReport";

const blankEntry = () => ({date: localDay(new Date()), activity: "", employer: "", role: "", how: "", outcome: "", notes: ""});
export default function ActivityLog() {
  const {user} = useUser();
  return user ? <Log key={user.id} userId={user.id} /> : null;
}
function Log({userId}: {userId: string}) {
  const queryClient = useQueryClient();
  const [range, setRange] = useState(() => defaultPeriod());
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState(blankEntry);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const {data, isPending, error: loadError, refetch} = useQuery<ActivityLogData>({queryKey: ["activity-log", userId], queryFn: async () => {
    const response = await fetch("/api/activity-log"); if (!response.ok) throw new Error(); return response.json();
  }});
  const period = reportPeriod(range.from, range.through);
  const rows = data && period ? activityRows(data, period) : [];
  const ready = !!data && !!period && !loadError;
  function edit(entry?: FreeActivity) {setEditing(entry?.id ?? -1); setDraft(entry ? {...entry, date: entry.date.slice(0, 10)} : blankEntry()); setError(""); setMessage("");}
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = activitySchema.safeParse(draft);
    if (!parsed.success) {setError(parsed.error.issues[0].message); return;}
    setBusy(true); setError("");
    try {
      const response = await fetch(editing === -1 ? "/api/activity-log" : `/api/activity-log/${editing}`, {method: editing === -1 ? "POST" : "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(parsed.data)});
      if (!response.ok) {const value = await response.json(); throw new Error(value.message ?? "Could not save your activity.");}
      await queryClient.invalidateQueries({queryKey: ["activity-log"]});
      const date = parseLocalDay(parsed.data.date)!;
      setMessage(period && date >= period.start && date < period.end ? "Activity saved." : "Activity saved outside this period. Change the dates to view it.");
      setEditing(null);
    } catch (err) {setError(err instanceof Error ? err.message : "Could not save your activity. Your edits are still here.");}
    finally {setBusy(false);}
  }
  async function remove(id: number) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/activity-log/${id}`, {method: "DELETE"});
      if (!response.ok) throw new Error();
      await queryClient.invalidateQueries({queryKey: ["activity-log"]}); setDeleting(null); setMessage("Activity deleted.");
    } catch {setError("Could not delete your activity. Please try again.");}
    finally {setBusy(false);}
  }
  function download() {
    setError("");
    try {
      const urlAPI = URL;
      const url = urlAPI.createObjectURL(new Blob([activityCSV(rows, range.from, range.through)], {type: "text/csv;charset=utf-8"}));
      const link = document.createElement("a"); link.href = url; link.download = `job-search-activity-${range.from}-${range.through}.csv`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => urlAPI.revokeObjectURL(url), 1000);
    } catch {setError("Could not download your activity log.");}
  }
  return <section className="activity-log-page space-y-5">
    <div className="no-print space-y-4">
      <Link className="text-sm underline" href="/report">Back to job-search report</Link>
      <p className="text-sm text-muted-foreground">Export your recorded job-search activity for a work coach or your own records. Use Print / save PDF and choose Save as PDF in your browser&apos;s print dialog. Dates follow your local time; outcomes show the current recorded status, rather than a historical snapshot. Unknown channels and send dates are not guessed.</p>
      <div className="flex flex-wrap gap-4"><div><Label htmlFor="activity-from">From</Label><Input id="activity-from" type="date" value={range.from} onChange={(event) => setRange({...range, from: event.target.value})} /></div><div><Label htmlFor="activity-through">Through</Label><Input id="activity-through" type="date" value={range.through} onChange={(event) => setRange({...range, through: event.target.value})} /></div></div>
      {!period && <p role="alert">Choose valid dates, in order, covering at most ten years.</p>}
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!ready || busy} onClick={download}>Download CSV</Button><Button variant="outline" disabled={!ready || busy} onClick={() => window.print()}>Print / save PDF</Button><Button disabled={busy || !!loadError} onClick={() => edit()}>Add other activity</Button></div>
      {loadError && <div role="alert">Could not load your activity log. <Button onClick={() => refetch()}>Try again</Button></div>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {message && <p role="status">{message}</p>}
      {editing !== null && <form onSubmit={save} className="rounded-md border p-4 space-y-3"><h3 className="font-semibold">{editing === -1 ? "Add other activity" : "Edit activity"}</h3><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">{([['date', 'Activity date', 'date'], ['activity', 'Activity', 'text'], ['employer', 'Employer (optional)', 'text'], ['role', 'Role (optional)', 'text'], ['how', 'How (optional)', 'text'], ['outcome', 'Outcome (optional)', 'text']] as const).map(([field, label, type]) => <div key={field}><Label htmlFor={`entry-${field}`}>{label}</Label><Input id={`entry-${field}`} type={type} required={field === "date" || field === "activity"} value={draft[field]} onChange={(event) => setDraft({...draft, [field]: event.target.value})} /></div>)}<div className="sm:col-span-2"><Label htmlFor="entry-notes">Notes (optional)</Label><Textarea id="entry-notes" value={draft.notes} onChange={(event) => setDraft({...draft, notes: event.target.value})} /></div></fieldset><div className="flex gap-2"><Button disabled={busy} type="submit">Save activity</Button><Button disabled={busy} type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button></div></form>}
    </div>
    {isPending ? <p className="no-print" role="status">Loading activity log…</p> : ready && <ActivityPrint rows={rows} from={range.from} through={range.through} renderActions={(row) => {
      const entry = row.kind === "other" ? data.entries.find((entry) => `entry-${entry.id}` === row.id) : undefined;
      return entry ? <div className="flex gap-2">{deleting === entry.id ? <><Button size="sm" variant="destructive" disabled={busy} onClick={() => remove(entry.id)}>Confirm delete {entry.activity}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Cancel</Button></> : <><Button size="sm" variant="outline" disabled={busy} onClick={() => edit(entry)}>Edit {entry.activity}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => setDeleting(entry.id)}>Delete {entry.activity}</Button></>}</div> : null;
    }} />}
  </section>;
}
