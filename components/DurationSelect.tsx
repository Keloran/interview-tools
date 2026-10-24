"use client";

import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";

const DURATIONS = [30, 45, 60, 90, 120];

const label = (m: number) => (m < 60 ? `${m} minutes` : m === 60 ? "1 hour" : `${m / 60} hours`);

export default function DurationSelect({id, value, onChange}: { id: string; value: number; onChange: (minutes: number) => void }) {
  // keep an unusual saved length selectable rather than silently showing nothing
  const options = DURATIONS.includes(value) ? DURATIONS : [...DURATIONS, value].sort((a, b) => a - b);
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((m) => <SelectItem key={m} value={String(m)}>{label(m)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
