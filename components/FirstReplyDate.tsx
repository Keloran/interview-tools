"use client";

import {useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Button} from "@/components/ui/button";

export default function FirstReplyDate({applicationId, applied, value}: {applicationId: number; applied: string; value?: string | null}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(value?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/applications/${applicationId}/first-response`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({firstResponseAt: date || null})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not save the first-reply date.");
      await Promise.all(["companies", "interviews", "interview", "application-timeline"].map((key) => queryClient.invalidateQueries({queryKey: [key]})));
      setEditing(false);
    } catch (err) {setError(err instanceof Error ? err.message : "Could not save the first-reply date. Your date is still here.");}
    finally {setBusy(false);}
  }
  return <div className="space-y-2 text-sm">
    <p>First reply: {value ? value.slice(0, 10) : "Unknown"}</p>
    {!editing ? <Button size="sm" variant="outline" onClick={() => {setDate(value?.slice(0, 10) ?? ""); setError(""); setEditing(true);}}>Record or correct first reply</Button> : <>
      <Label htmlFor={`reply-${applicationId}`}>First reply date</Label>
      <Input id={`reply-${applicationId}`} type="date" min={applied.slice(0, 10)} max={new Date().toISOString().slice(0, 10)} value={date} disabled={busy} onChange={(event) => setDate(event.target.value)} />
      <p className="text-muted-foreground">The first date the company or recruiter replied about this application. Leave blank if unknown; unknown dates are excluded from response times. Dates use calendar days in UTC.</p>
      <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={save}>Save first-reply date</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button></div>
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </>}
  </div>;
}
