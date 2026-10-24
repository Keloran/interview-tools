"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ChevronLeft, ChevronRight, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import DurationSelect from "@/components/DurationSelect";
import {GAP_BETWEEN_MINUTES, suggestSlots} from "@/lib/availability";
import {addDays, getBusy} from "@/lib/busy";
import {cn, toISODate} from "@/lib/utils";
import {reportClientError} from "@/lib/reportClientError";
import AvailabilityLinks from "@/components/AvailabilityLinks";

type Stage = { id: number; stage: string };

const timeFmt = new Intl.DateTimeFormat(undefined, {hour: "numeric", minute: "2-digit"});
const slotFmt = new Intl.DateTimeFormat(undefined, {weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit"});

export default function ShareAvailability({interviewId}: { interviewId: string }) {
  const queryClient = useQueryClient();
  const {data: stages} = useQuery<Stage[]>({
    queryKey: ["stages"],
    queryFn: async () => (await fetch("/api/stages")).json(),
  });

  const [stage, setStage] = useState("");
  const [duration, setDuration] = useState(60);
  const [meetingLink, setMeetingLink] = useState("");
  const [day, setDay] = useState(() => addDays(toISODate(new Date()), 1));
  const [slots, setSlots] = useState<string[]>([]); // ISO times picked from the suggestions
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {data: busy, isLoading: loadingBusy} = useQuery({queryKey: ["busy", day], queryFn: () => getBusy(day)});
  const suggestions = busy ? suggestSlots(new Date(`${day}T00:00`), duration, busy) : [];
  const toggle = (iso: string) => setSlots(slots.includes(iso) ? slots.filter((s) => s !== iso) : [...slots, iso].sort());

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
          durationMinutes: duration,
          meetingLink: meetingLink || undefined,
          slots,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Couldn't create the link");
        return;
      }
      await queryClient.invalidateQueries({queryKey: ["availability-links", interviewId]});
      setCreatedId(json.id);
    } catch (e) {
      reportClientError("Failed to create availability link", e);
      setError("Couldn't create the link");
    } finally {
      setSubmitting(false);
    }
  };

  if (createdId) {
    return <AvailabilityLinks interviewId={interviewId} justCreated={createdId} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <AvailabilityLinks interviewId={interviewId} />
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
          <DurationSelect id="availability-duration" value={duration} onChange={setDuration} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="availability-link">Meeting link (optional)</Label>
        <Input id="availability-link" placeholder="e.g. https://meet.google.com/…" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="availability-day">Times you&apos;re free</Label>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="cursor-pointer" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>
            <ChevronLeft />
          </Button>
          <Input id="availability-day" type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          <Button variant="ghost" size="sm" className="cursor-pointer" aria-label="Next day" onClick={() => setDay(addDays(day, 1))}>
            <ChevronRight />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Keeps {GAP_BETWEEN_MINUTES} minutes between interviews, so you&apos;re ready and have room for overruns and a break.
        </p>
        {loadingBusy ? (
          <p className="text-sm text-muted-foreground">Checking your interviews…</p>
        ) : suggestions.length ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((d) => {
              const iso = d.toISOString();
              return (
                <Button
                  key={iso}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={slots.includes(iso)}
                  className={cn("cursor-pointer", slots.includes(iso) && "border-primary bg-primary/10")}
                  onClick={() => toggle(iso)}
                >
                  {timeFmt.format(d)}
                </Button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No free times that day.</p>
        )}
        {slots.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {slots.map((iso) => (
              <span key={iso} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
                {slotFmt.format(new Date(iso))}
                <button type="button" className="cursor-pointer" aria-label={`Remove ${slotFmt.format(new Date(iso))}`} onClick={() => toggle(iso)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="cursor-pointer" disabled={!stage || !slots.length || submitting} onClick={create}>
        {submitting ? "Creating…" : "Create link"}
      </Button>
    </div>
  );
}
