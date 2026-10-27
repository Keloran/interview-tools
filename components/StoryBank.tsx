"use client";

import {FormEvent, useState} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {useUser} from "@clerk/nextjs";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {STAR_FIELDS, Story, storySchema, suggestedStories} from "@/lib/stories";

export function useStories(enabled = true) {
  const {user} = useUser();
  return useQuery<Story[]>({queryKey: ["stories", user?.id], enabled: enabled && !!user?.id, queryFn: async () => {
    const response = await fetch("/api/stories");
    if (!response.ok) throw new Error("Could not load stories");
    return response.json();
  }});
}

export function StoryAnswer({story}: {story: Story}) {
  return <details className="text-sm"><summary className="cursor-pointer font-medium">{story.title}</summary><dl className="mt-2 space-y-2">{STAR_FIELDS.filter((field) => story[field]).map((field) => <div key={field}><dt className="font-medium capitalize">{field}</dt><dd className="whitespace-pre-wrap text-muted-foreground">{story[field]}</dd></div>)}</dl></details>;
}

function StoryEditor({story, onSaved}: {story?: Story; onSaved: () => void}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({title: story?.title ?? "", situation: story?.situation ?? "", task: story?.task ?? "", action: story?.action ?? "", result: story?.result ?? "", tags: story?.tags.join(", ") ?? ""});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); setError("");
    const parsed = storySchema.safeParse({...form, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean)});
    if (!parsed.success) {setError("Enter a title, up to 12 tags and no more than 8,000 characters per answer field."); return;}
    setBusy(true);
    try {
      const response = await fetch(story ? `/api/stories/${story.id}` : "/api/stories", {method: story ? "PUT" : "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(parsed.data)});
      if (!response.ok) throw new Error();
      await Promise.all([queryClient.invalidateQueries({queryKey: ["stories"]}), queryClient.invalidateQueries({queryKey: ["prep"]})]);
      onSaved();
    } catch {setError("Could not save your story. Your edits are still here; please try again.");}
    finally {setBusy(false);}
  }
  return <form onSubmit={save} className="space-y-3">
    <div className="space-y-1"><Label htmlFor="story-title">Title</Label><Input id="story-title" disabled={busy} value={form.title} maxLength={200} onChange={(e) => setForm({...form, title: e.target.value})} /></div>
    {STAR_FIELDS.map((field) => <div key={field} className="space-y-1"><Label htmlFor={`story-${field}`} className="capitalize">{field}</Label><Textarea id={`story-${field}`} disabled={busy} rows={3} maxLength={8000} value={form[field]} onChange={(e) => setForm({...form, [field]: e.target.value})} /></div>)}
    <div className="space-y-1"><Label htmlFor="story-tags">Tags (comma separated)</Label><Input id="story-tags" disabled={busy} value={form.tags} onChange={(e) => setForm({...form, tags: e.target.value})} placeholder="leadership, conflict, failure, delivery" /></div>
    <p className="text-xs text-muted-foreground">Topic suggestions recognise leadership, conflict, failure, delivery, teamwork and communication. You can also add your own tags.</p>
    {!!story?.usedIn.length && <p className="text-xs text-muted-foreground">Editing this story updates the answer wherever you have selected it.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button disabled={busy}>{busy ? "Saving…" : "Save story"}</Button>
  </form>;
}

export default function StoryBank({initialSearch = ""}: {initialSearch?: string}) {
  const {data, isLoading, error} = useStories();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(initialSearch);
  const [editing, setEditing] = useState<Story | "new" | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busy, setBusy] = useState(false);
  const q = search.trim().toLowerCase();
  const stories = (data ?? []).filter((story) => [story.title, ...STAR_FIELDS.map((field) => story[field]), ...story.tags].some((text) => text.toLowerCase().includes(q)));
  async function remove(id: number) {
    setBusy(true); setDeleteError("");
    try {
      const response = await fetch(`/api/stories/${id}`, {method: "DELETE"});
      if (!response.ok) throw new Error();
      await Promise.all([queryClient.invalidateQueries({queryKey: ["stories"]}), queryClient.invalidateQueries({queryKey: ["prep"]})]);
      setDeleting(null);
    } catch {setDeleteError("Could not delete the story. Please try again.");}
    finally {setBusy(false);}
  }
  return <section className="space-y-4">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Your story bank</h2><p className="text-muted-foreground">Prepare reusable Situation, Task, Action and Result answers.</p></div><Button onClick={() => setEditing("new")}>Add story</Button></div>
    <Label htmlFor="story-search">Search stories and tags</Label><Input id="story-search" value={search} onChange={(e) => setSearch(e.target.value)} />
    {isLoading ? <p role="status">Loading stories…</p> : error ? <p role="alert">Could not load your stories.</p> : !data?.length ? <p>Add your first story, then select it in an interview&apos;s preparation.</p> : !stories.length ? <p>No stories match your search.</p> : stories.map((story) => <Card key={story.id} className="p-4 gap-2">
      <StoryAnswer story={story} />
      {story.tags.length > 0 && <p className="text-sm text-muted-foreground">Tags: {story.tags.join(", ")}</p>}
      {story.usedIn.length > 0 && <p className="text-xs text-muted-foreground">Selected for: {story.usedIn.map((use) => `${use.company} · ${use.stage}`).join("; ")}</p>}
      <div className="flex gap-2"><Button variant="outline" onClick={() => setEditing(story)}>Edit {story.title}</Button><Button variant="ghost" onClick={() => {setDeleting(story.id); setDeleteError("");}}>Delete {story.title}</Button></div>
      {deleting === story.id && <div className="space-y-2"><p>Delete this story and remove it from all interview stages? Your prep notes will remain.</p><div className="flex gap-2"><Button variant="destructive" disabled={busy} onClick={() => remove(story.id)}>Confirm delete</Button><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Cancel</Button></div>{deleteError && <p role="alert">{deleteError}</p>}</div>}
    </Card>)}
    <Dialog open={editing !== null} onOpenChange={(open) => {if (!open) setEditing(null);}}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing === "new" ? "Add story" : "Edit story"}</DialogTitle></DialogHeader>{editing && <StoryEditor key={editing === "new" ? "new" : editing.id} story={editing === "new" ? undefined : editing} onSaved={() => setEditing(null)} />}</DialogContent></Dialog>
  </section>;
}

export function StorySuggestions({topics}: {topics: string[]}) {
  const {data} = useStories(topics.length > 0);
  const matches = suggestedStories(data ?? [], topics).slice(0, 5);
  if (!matches.length) return null;
  return <div className="text-sm"><p className="font-medium">Stories to consider for {topics.join(", ")}</p><ul className="list-disc pl-5">{matches.map((story) => <li key={story.id}><Link href={`/stories?q=${encodeURIComponent(story.title)}`} className="underline underline-offset-4">{story.title}</Link></li>)}</ul></div>;
}
