"use client";
import {useState} from "react";
import {useUser} from "@clerk/nextjs";
import {useQuery} from "@tanstack/react-query";
import {Button} from "@/components/ui/button";
import {Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription} from "@/components/ui/dialog";
import {Command, CommandInput, CommandList, CommandItem, CommandEmpty} from "@/components/ui/command";
import {CommunityRecord} from "@/components/CommunityRecord";
type Employer = {id: string; name: string; domain: string | null; jurisdiction: string | null};
export default function CommunityLookup({initialQuery = ""}: {initialQuery?: string}) {
  const {user} = useUser();
  const [open, setOpen] = useState(false), [query, setQuery] = useState(initialQuery), [selected, setSelected] = useState<Employer | null>(null);
  const {data, error, isFetching} = useQuery<Employer[]>({queryKey: ["community-employer-search", user?.id, query], enabled: !!user && open && query.trim().length >= 2, queryFn: async () => {
    const response = await fetch(`/api/community/employers?q=${encodeURIComponent(query.trim())}`); if (!response.ok) throw new Error("Could not search reviewed employers"); return response.json();
  }});
  if (!user) return null;
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline" onClick={() => {setQuery(initialQuery); setSelected(null);}}>Look up community employer record</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Community employer lookup</DialogTitle><DialogDescription>Choose the actual employer, including the end client for agency roles. Looking up a record does not link an application or enable sharing.</DialogDescription></DialogHeader>
    <Command shouldFilter={false}><CommandInput aria-label="Search community employers" placeholder="Employer name or domain" value={query} onValueChange={(value) => {setQuery(value); setSelected(null);}} /><CommandList><CommandEmpty>{query.trim().length < 2 ? "Enter at least two characters." : isFetching ? "Searching…" : "No reviewed employers found."}</CommandEmpty>{data?.map((employer) => <CommandItem key={employer.id} value={employer.id} onSelect={() => setSelected(employer)}>{employer.name} · {employer.domain} · {employer.jurisdiction}</CommandItem>)}</CommandList></Command>
    {error && <p role="alert">Could not search reviewed employers.</p>}
    {selected && <CommunityRecord key={selected.id} employerId={selected.id} name={selected.name} />}
  </DialogContent></Dialog>;
}
