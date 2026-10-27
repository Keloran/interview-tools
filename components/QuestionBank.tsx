"use client";

import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {useUser} from "@clerk/nextjs";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Button} from "@/components/ui/button";
import {filterQuestions, previousQuestions, QuestionEntry} from "@/lib/questions";

function useQuestions() {
  const {user} = useUser();
  return useQuery<QuestionEntry[]>({queryKey: ["questions", user?.id], enabled: !!user?.id, queryFn: async () => {
    const res = await fetch("/api/questions");
    if (!res.ok) throw new Error("Could not load questions");
    return res.json();
  }});
}

function Questions({entries}: {entries: QuestionEntry[]}) {
  return <div className="space-y-3">{entries.map((entry) => <Card key={entry.interviewId} className="p-4 gap-2">
    <h3 className="font-medium">{entry.company} · {entry.stage}</h3>
    <p className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString()} · {entry.jobTitle}{entry.recruiter && ` · via ${entry.recruiter}`}</p>
    <ul className="list-disc space-y-1 pl-5">{entry.questions.map((question, index) => <li key={index} className="whitespace-pre-wrap">{question}</li>)}</ul>
    {entry.notes && <div><p className="text-sm font-medium">Your interview notes</p><p className="text-sm whitespace-pre-wrap text-muted-foreground">{entry.notes}</p></div>}
  </Card>)}</div>;
}

export default function QuestionBank() {
  const {data, isLoading, error} = useQuestions();
  const [q, setQ] = useState("");
  const [company, setCompany] = useState("");
  const [stage, setStage] = useState("");
  const [page, setPage] = useState(0);
  const entries = data ?? [];
  const filtered = filterQuestions(entries, {q, company, stage});
  const pageSize = 20;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const options = (field: "company" | "stage") => [...new Set(entries.map((entry) => entry[field]))].sort((a, b) => a.localeCompare(b));
  return <section className="space-y-4">
    <div><h2 className="text-xl font-semibold">Your question bank</h2><p className="text-muted-foreground">Questions and notes from your debriefs, ready for the next interview.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1"><Label htmlFor="question-search">Search questions and notes</Label><Input id="question-search" value={q} onChange={(event) => {setQ(event.target.value); setPage(0);}} /></div>
      <div className="space-y-1"><Label htmlFor="question-company">Company</Label><select id="question-company" className="h-9 w-full rounded-md border bg-background px-2" value={company} onChange={(event) => {setCompany(event.target.value); setPage(0);}}><option value="">All companies</option>{options("company").map((name) => <option key={name}>{name}</option>)}</select></div>
      <div className="space-y-1"><Label htmlFor="question-stage">Stage</Label><select id="question-stage" className="h-9 w-full rounded-md border bg-background px-2" value={stage} onChange={(event) => {setStage(event.target.value); setPage(0);}}><option value="">All stages</option>{options("stage").map((name) => <option key={name}>{name}</option>)}</select></div>
    </div>
    {isLoading ? <p role="status">Loading questions…</p> : error ? <p role="alert">Could not load your questions. Please try again.</p>
      : !entries.length ? <p>Record questions in an interview debrief, one per line, to build your bank.</p>
      : !filtered.length ? <p role="status">No questions match your search.</p>
      : <><p className="text-sm text-muted-foreground">{filtered.length} interview records</p><Questions entries={filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)} />
        <div className="flex items-center gap-3"><Button variant="outline" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>Page {currentPage + 1} of {Math.ceil(filtered.length / pageSize)}</span><Button variant="outline" disabled={(currentPage + 1) * pageSize >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next</Button></div></>}
  </section>;
}

export function PreviousQuestions(props: {interviewId: number; company: string; stage: string; date: string}) {
  const {data, isLoading, error} = useQuestions();
  const entries = previousQuestions(data ?? [], props).slice(0, 3);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading previous questions…</p>;
  if (error) return <p role="alert" className="text-sm">Could not load previous questions.</p>;
  if (!entries.length) return null;
  return <section className="space-y-2"><h3 className="font-medium">Last time {props.company} asked at {props.stage}</h3><Questions entries={entries} /></section>;
}
