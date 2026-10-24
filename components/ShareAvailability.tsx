"use client";

import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Plus, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";

type Stage = { id: number; stage: string };

export default function ShareAvailability({interviewId}: { interviewId: string }) {
  const {data: stages} = useQuery<Stage[]>({
    queryKey: ["stages"],
    queryFn: async () => (await fetch("/api/stages")).json(),
  });

  const [stage, setStage] = useState("");
  const [duration, setDuration] = useState("60");
  const [meetingLink, setMeetingLink] = useState("");
  const [slots, setSlots] = useState<string[]>([""]); // datetime-local values, in the owner's timezone
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filled = slots.filter(Boolean);

  const create = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          interviewId,
          stage,
          durationMinutes: Number(duration),
          meetingLink: meetingLink || undefined,
          slots: filled.map((s) => new Date(s).toISOString()),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Couldn't create the link");
        return;
      }
      setUrl(`${window.location.origin}${json.path}`);
    } catch {
      setError("Couldn't create the link");
    } finally {
      setSubmitting(false);
    }
  };

  if (url) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Send this to whoever asked for your availability. When they pick a time it&apos;s added as a scheduled {stage}.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Availability link" />
          <Button
            className="cursor-pointer"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="availability-stage">Next stage</Label>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger id="availability-stage" className="w-full">
              <SelectValue placeholder={stages ? "Choose…" : "Loading..."} />
            </SelectTrigger>
            <SelectContent>
              {stages?.filter((s) => s.stage !== "Applied").map((s) => (
                <SelectItem key={s.id} value={s.stage}>{s.stage}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="availability-duration">Length</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger id="availability-duration" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[30, 45, 60, 90, 120].map((m) => <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="availability-link">Meeting link (optional)</Label>
        <Input id="availability-link" placeholder="e.g. https://meet.google.com/…" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Times you&apos;re free</Label>
        {slots.map((s, i) => (
          <div key={i} className="flex gap-2">
            <Input
              type="datetime-local"
              aria-label={`Time ${i + 1}`}
              value={s}
              onChange={(e) => setSlots(slots.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer"
              aria-label={`Remove time ${i + 1}`}
              disabled={slots.length === 1}
              onClick={() => setSlots(slots.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setSlots([...slots, ""])}>
          <Plus /> Add time
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="cursor-pointer" disabled={!stage || !filled.length || submitting} onClick={create}>
        {submitting ? "Creating…" : "Create link"}
      </Button>
    </div>
  );
}
