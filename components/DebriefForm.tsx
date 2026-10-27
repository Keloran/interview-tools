"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {reportClientError} from "@/lib/reportClientError";
import {toISODate} from "@/lib/utils";

type DebriefData = {
  interviewer: string | null;
  rating: number | null;
  debriefNotes: string | null;
  peopleMet: string | null;
  questionsAsked: string | null;
  prepNotes: string | null;
  nextStep: string | null;
  replyBy: string | null;
};

const RATINGS = [[1, "Badly"], [2, "Not great"], [3, "OK"], [4, "Well"], [5, "Great"]] as const;

function Form({interviewId, saved, onSuccess}: { interviewId: string; saved: DebriefData; onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    rating: saved.rating,
    debriefNotes: saved.debriefNotes ?? "",
    peopleMet: saved.peopleMet ?? saved.interviewer ?? "",
    questionsAsked: saved.questionsAsked ?? "",
    nextStep: saved.nextStep ?? "",
    replyBy: saved.replyBy ? toISODate(new Date(saved.replyBy)) : "",
    prepNotes: saved.prepNotes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (field: keyof typeof form) => (e: { target: { value: string } }) => setForm({...form, [field]: e.target.value});

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/interview/${interviewId}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          debrief: {...form, replyBy: form.replyBy ? new Date(`${form.replyBy}T00:00`).toISOString() : null},
        }),
      });
      if (!res.ok) throw new Error(`Saving debrief failed: ${res.status}`);
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ["interview", interviewId]}),
        queryClient.invalidateQueries({queryKey: ["interviews"]}),
        queryClient.invalidateQueries({queryKey: ["questions"]}),
        queryClient.invalidateQueries({queryKey: ["prep"]}),
      ]);
      onSuccess?.();
    } catch (e) {
      reportClientError("Failed to save debrief", e);
      setError("Couldn't save the debrief");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label>How did it go?</Label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="How did it go?">
          {RATINGS.map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={form.rating === value ? "default" : "outline"}
              aria-pressed={form.rating === value}
              className="cursor-pointer"
              onClick={() => setForm({...form, rating: form.rating === value ? null : value})}
            >
              {label}
            </Button>
          ))}
        </div>
        <Textarea id="debrief-notes" aria-label="Notes" placeholder="What stood out, good or bad" rows={3} value={form.debriefNotes} onChange={set("debriefNotes")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="debrief-people">Who you met</Label>
        <Input id="debrief-people" placeholder="e.g. Sam Jones (Engineering Manager)" value={form.peopleMet} onChange={set("peopleMet")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="debrief-questions">Questions they asked</Label>
        <Textarea id="debrief-questions" placeholder="One per line" rows={4} value={form.questionsAsked} onChange={set("questionsAsked")} />
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <div className="space-y-2">
          <Label htmlFor="debrief-next">What happens next</Label>
          <Input id="debrief-next" placeholder="e.g. Technical round with the team" value={form.nextStep} onChange={set("nextStep")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="debrief-reply-by">Hear back by</Label>
          <Input id="debrief-reply-by" type="date" value={form.replyBy} onChange={set("replyBy")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="debrief-prep">To prepare for next time</Label>
        <Textarea id="debrief-prep" rows={2} value={form.prepNotes} onChange={set("prepNotes")} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="cursor-pointer" disabled={saving} onClick={save}>
        {saving ? "Saving…" : "Save debrief"}
      </Button>
    </div>
  );
}

// Anything can be left blank and filled in later
export default function DebriefForm({interviewId, onSuccess}: { interviewId: string; onSuccess?: () => void }) {
  const {data} = useQuery<DebriefData>({
    queryKey: ["interview", interviewId],
    queryFn: async () => {
      const res = await fetch(`/api/interview/${interviewId}`);
      if (!res.ok) throw new Error("Failed to fetch interview");
      return res.json();
    },
  });
  if (!data) return <div className="text-center py-4 text-muted-foreground">Loading...</div>;
  return <Form interviewId={interviewId} saved={data} onSuccess={onSuccess} />;
}
