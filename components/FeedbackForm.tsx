"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {FEEDBACK_LABEL, FEEDBACK_TYPES, FeedbackType} from "@/lib/feedback";
import {reportClientError} from "@/lib/reportClientError";

type Saved = { feedbackType: FeedbackType | null; feedbackText: string | null };

function Form({interviewId, saved, reject, onSuccess}: { interviewId: string; saved: Saved; reject?: boolean; onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<FeedbackType | null>(saved.feedbackType);
  const [text, setText] = useState(saved.feedbackText ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/interview/${interviewId}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({...(reject && {outcome: "REJECTED"}), feedback: {type, text}}),
      });
      if (!res.ok) throw new Error(`Saving feedback failed: ${res.status}`);
      await Promise.all(["interview", "interviews", "companies"].map((key) => queryClient.invalidateQueries({queryKey: [key]})));
      onSuccess?.();
    } catch (e) {
      reportClientError("Failed to save feedback", e);
      setError("Couldn't save that, try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label>Did they give feedback?</Label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Did they give feedback?">
          {FEEDBACK_TYPES.map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={type === t ? "default" : "outline"}
              aria-pressed={type === t}
              className="cursor-pointer"
              onClick={() => setType(type === t ? null : t)}
            >
              {FEEDBACK_LABEL[t]}
            </Button>
          ))}
        </div>
      </div>
      {type && type !== "NONE" && (
        <div className="space-y-2">
          <Label htmlFor="feedback-text">What they said</Label>
          <Textarea id="feedback-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="cursor-pointer" disabled={saving} onClick={save}>
        {saving ? "Saving…" : reject ? "Mark as rejected" : "Save feedback"}
      </Button>
    </div>
  );
}

// reject: this is the rejection itself, so saving also marks the stage rejected (feedback can be left blank)
export default function FeedbackForm({interviewId, reject, onSuccess}: { interviewId: string; reject?: boolean; onSuccess?: () => void }) {
  const {data} = useQuery<Saved>({
    queryKey: ["interview", interviewId],
    queryFn: async () => {
      const res = await fetch(`/api/interview/${interviewId}`);
      if (!res.ok) throw new Error("Failed to fetch interview");
      return res.json();
    },
  });
  if (!data) return <div className="text-center py-4 text-muted-foreground">Loading...</div>;
  return <Form interviewId={interviewId} saved={data} reject={reject} onSuccess={onSuccess} />;
}
