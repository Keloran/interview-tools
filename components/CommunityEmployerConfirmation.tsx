"use client";
import Link from "next/link";
import {useState} from "react";
import {useUser} from "@clerk/nextjs";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Command, CommandInput, CommandList, CommandItem, CommandEmpty} from "@/components/ui/command";

type Employer = {id: string; name: string; domain: string | null; jurisdiction: string | null};
type Confirmation = {applicationId: number; sourceName: string; employer: Employer | null; confirmed: boolean; requiresClient: boolean};
export default function CommunityEmployerConfirmation({applicationId}: {applicationId: number}) {
  const {user} = useUser(), queryClient = useQueryClient();
  const [query, setQuery] = useState(""), [selected, setSelected] = useState<Employer | null>(null), [searching, setSearching] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const {data, error, isPending, refetch} = useQuery<Confirmation>({queryKey: ["community-employer", user?.id, applicationId], enabled: !!user, queryFn: async () => {
    const response = await fetch(`/api/applications/${applicationId}/community-employer`); if (!response.ok) throw new Error("Could not load employer confirmation"); return response.json();
  }});
  const catalog = useQuery<Employer[]>({queryKey: ["community-employer-search", user?.id, query], enabled: !!user && searching && query.trim().length >= 2, queryFn: async () => {
    const response = await fetch(`/api/community/employers?q=${encodeURIComponent(query.trim())}`); if (!response.ok) throw new Error("Could not search reviewed employers"); return response.json();
  }});
  async function save(employer: Employer | null) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/applications/${applicationId}/community-employer`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(employer ? {employerId: employer.id, confirm: true} : {employerId: null})});
      const result = await response.json(); if (!response.ok) throw new Error(result.message || "Could not update employer confirmation");
      setSearching(false); setSelected(null); setMessage(employer ? "Employer confirmed. Your sharing preference is unchanged." : "Employer confirmation removed.");
      await Promise.all(["community-employer", "companies"].map((key) => queryClient.invalidateQueries({queryKey: [key]})));
      await queryClient.resetQueries({queryKey: ["community-summary"]});
    } catch (err) {setMessage(err instanceof Error ? err.message : "Could not update employer confirmation");}
    finally {setBusy(false);}
  }
  if (!user) return null;
  return <section className="space-y-3"><h3 className="font-semibold">Employer identity for community sharing</h3><p className="text-sm text-muted-foreground">Choose the actual employer, including the end client for agency applications. Confirming an identity does not enable sharing. <Link className="underline" href="/community">Manage your separate opt-in</Link>.</p>
    {error ? <div role="alert">Could not load employer confirmation. <Button variant="outline" onClick={() => refetch()}>Try again</Button></div> : isPending || !data ? <p>Loading employer confirmation…</p> : <>
      <p className="text-sm">Your record: {data.sourceName}</p>
      {data.employer && <p className="text-sm">{data.confirmed ? "Confirmed employer" : "Confirmation needs review"}: {data.employer.name} · {data.employer.domain} · {data.employer.jurisdiction}</p>}
      {data.requiresClient ? <p className="text-sm">Record the end client before choosing an employer.</p> : <Button size="sm" variant="outline" disabled={busy} onClick={() => {setSearching(!searching); setSelected(null); setMessage("");}}>Find reviewed employer</Button>}
      {data.employer && <Button size="sm" variant="outline" disabled={busy} onClick={() => save(null)}>Remove employer confirmation</Button>}
      {searching && <div className="space-y-2"><Command shouldFilter={false}><CommandInput aria-label="Search reviewed employers" placeholder="Employer name or domain" value={query} onValueChange={(value) => {setQuery(value); setSelected(null);}} /><CommandList>
        <CommandEmpty>{query.trim().length < 2 ? "Enter at least two characters." : catalog.isFetching ? "Searching…" : "No reviewed employers found. Private tracking still works."}</CommandEmpty>
        {catalog.data?.map((employer) => <CommandItem key={employer.id} value={employer.id} onSelect={() => setSelected(employer)}>{employer.name} · {employer.domain} · {employer.jurisdiction}</CommandItem>)}
      </CommandList></Command>{catalog.error && <p role="alert">Could not search reviewed employers.</p>}
      {selected && <Card className="p-3 gap-2"><p className="text-sm">Confirm that {selected.name} ({selected.domain}, {selected.jurisdiction}) is the actual employer for {data.sourceName}. Similar names can be different companies.</p><Button size="sm" disabled={busy} onClick={() => save(selected)}>Confirm employer</Button></Card>}</div>}
    </>}{message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
