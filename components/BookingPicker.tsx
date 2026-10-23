"use client";

import {useState, useSyncExternalStore} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {cn} from "@/lib/utils";

// Rendered client-side so times show in the viewer's own timezone
const dayFmt = new Intl.DateTimeFormat(undefined, {weekday: "long", day: "numeric", month: "long"});
const timeFmt = new Intl.DateTimeFormat(undefined, {hour: "numeric", minute: "2-digit", timeZoneName: "short"});

const noop = () => () => {};

export default function BookingPicker({linkId, slots, bookedSlot}: { linkId: string; slots: string[]; bookedSlot: string | null }) {
  // false during SSR, so the server (UTC) never renders times the browser would disagree with
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [booked, setBooked] = useState(bookedSlot);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isClient) return null;

  if (booked) {
    const d = new Date(booked);
    return <p className="text-center py-6">Booked for <strong>{dayFmt.format(d)}, {timeFmt.format(d)}</strong>. Thanks!</p>;
  }

  if (!slots.length) {
    return <p className="text-muted-foreground text-center py-6">None of the offered times are available any more.</p>;
  }

  const byDay = new Map<string, string[]>();
  for (const s of slots) {
    const day = dayFmt.format(new Date(s));
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }

  const book = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/availability/${linkId}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({slot: selected, name}),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Couldn't book that time");
        return;
      }
      setBooked(json.bookedSlot);
    } catch {
      setError("Couldn't book that time");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {[...byDay].map(([day, daySlots]) => (
        <div key={day}>
          <p className="text-sm font-medium mb-2">{day}</p>
          <div className="flex flex-wrap gap-2">
            {daySlots.map((s) => (
              <Button
                key={s}
                type="button"
                variant="outline"
                aria-pressed={selected === s}
                className={cn("cursor-pointer", selected === s && "border-primary bg-primary/10")}
                onClick={() => setSelected(s)}
              >
                {timeFmt.format(new Date(s))}
              </Button>
            ))}
          </div>
        </div>
      ))}
      <div className="space-y-2">
        <Label htmlFor="booker-name">Your name (optional)</Label>
        <Input id="booker-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam from Acme" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="cursor-pointer" disabled={!selected || submitting} onClick={book}>
        {submitting ? "Booking…" : "Book this time"}
      </Button>
    </div>
  );
}
