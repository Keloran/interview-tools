"use client";

import {useEffect, useState} from "react";
import {useUser} from "@clerk/nextjs";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import Link from "next/link";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Prep, Story} from "@/lib/stories";
import {StoryAnswer, useStories} from "@/components/StoryBank";

export default function InterviewPrep({interviewId}: {interviewId: string}) {
  const {user} = useUser();
  const {data: stories, error: storyError} = useStories();
  const {data, isLoading, error} = useQuery<Prep>({queryKey: ["prep", user?.id, interviewId], enabled: !!user?.id, queryFn: async () => {
    const response = await fetch(`/api/interview/${interviewId}/prep`);
    if (!response.ok) throw new Error();
    return response.json();
  }});
  if (isLoading) return <p className="text-sm">Loading preparation…</p>;
  if (error) return <p role="alert">Could not load this interview&apos;s preparation.</p>;
  if (!data) return null;
  return <section className="space-y-2 border-t pt-3"><h3 className="font-medium">Preparation</h3>
    {data.notes && <p className="whitespace-pre-wrap text-sm">{data.notes}</p>}
    {stories?.filter((story) => data.storyIds.includes(story.id)).map((story) => <StoryAnswer key={story.id} story={story} />)}
    {storyError && <p role="alert">Could not load your saved stories.</p>}
    {stories && <PrepEditor key={interviewId} interviewId={interviewId} saved={data} stories={stories} />}
  </section>;
}

function PrepEditor({interviewId, saved, stories}: {interviewId: string; saved: Prep; stories: Story[]}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(saved);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {if (!dirty) setForm(saved);}, [saved, dirty]);
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = {...form, storyIds: form.storyIds.filter((id) => stories.some((story) => story.id === id))};
      const response = await fetch(`/api/interview/${interviewId}/prep`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)});
      if (!response.ok) throw new Error();
      await Promise.all([queryClient.invalidateQueries({queryKey: ["prep"]}), queryClient.invalidateQueries({queryKey: ["stories"]}), queryClient.invalidateQueries({queryKey: ["interview", interviewId]})]);
      setDirty(false); setMessage("Preparation saved");
    } catch {setError("Could not save preparation. Your changes are still here; please try again.");}
    finally {setBusy(false);}
  }
  return <details className="text-sm"><summary className="cursor-pointer">Edit preparation</summary><div className="mt-3 space-y-3">
    <div className="space-y-1"><Label htmlFor="stage-prep-notes">Company research, questions to ask and prep notes</Label><Textarea id="stage-prep-notes" disabled={busy} rows={4} maxLength={12000} value={form.notes} onChange={(e) => {setForm({...form, notes: e.target.value}); setDirty(true); setMessage("");}} /></div>
    <fieldset className="space-y-2"><legend className="font-medium">Stories to use for this stage</legend>{stories.map((story) => <label key={story.id} className="flex items-center gap-2"><input type="checkbox" disabled={busy || (!form.storyIds.includes(story.id) && form.storyIds.length >= 30)} checked={form.storyIds.includes(story.id)} onChange={(e) => {setForm({...form, storyIds: e.target.checked ? [...form.storyIds, story.id] : form.storyIds.filter((id) => id !== story.id)}); setDirty(true); setMessage("");}} />{story.title}</label>)}{!stories.length && <p>No stories yet. <Link href="/stories" className="underline">Add a story</Link> to reuse it here.</p>}</fieldset>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <Button type="button" onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : "Save preparation"}</Button>
  </div></details>;
}
