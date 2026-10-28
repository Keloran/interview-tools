"use client";

import {Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {useUser} from "@clerk/nextjs";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Compensation, compensationSchema, offerDetailKeys, offerDetailLabels} from "@/lib/compensation";
import type {OfferSummary} from "@/lib/offers";

export function CompensationEditor({interviewId, value, isOffer, onCancel, onSaved}: {interviewId: number; value: Compensation; isOffer: boolean; onCancel: () => void; onSaved: () => void}) {
  const [draft, setDraft] = useState<Compensation>(value), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const queryClient = useQueryClient();
  const keys = ["advertisedSalary", ...(isOffer ? offerDetailKeys : [])] as (keyof Compensation)[];
  async function save() {
    const input = compensationSchema.safeParse(Object.fromEntries(keys.map((key) => [key, draft[key] || null])));
    if (!input.success) {setError(input.error.issues[0].message); return;}
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/interview/${interviewId}/compensation`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(input.data)});
      if (!response.ok) {const result = await response.json(); throw new Error(result.message || "Could not save salary details");}
      await Promise.all(["offers", "compensation"].map((key) => queryClient.invalidateQueries({queryKey: [key]})));
      onSaved();
    } catch (err) {setError(err instanceof Error ? err.message : "Could not save salary details");}
    finally {setBusy(false);}
  }
  return <div className="space-y-3"><p className="text-sm text-muted-foreground">All fields are optional and private. Include currency, pay period and any conditions. Values are shown as entered.</p>{keys.map((key) => {
    const id = `compensation-${interviewId}-${key}`;
    return <div key={key} className="space-y-1"><Label htmlFor={id}>{key === "advertisedSalary" ? "Advertised salary range" : offerDetailLabels[key]}</Label>{key === "advertisedSalary" ? <Input id={id} maxLength={500} value={draft[key] ?? ""} disabled={busy} onChange={(event) => setDraft({...draft, [key]: event.target.value})} /> : <Textarea id={id} rows={2} maxLength={2000} value={draft[key] ?? ""} disabled={busy} onChange={(event) => setDraft({...draft, [key]: event.target.value})} />}</div>;
  })}{error && <p role="alert">{error}</p>}<div className="flex gap-2"><Button size="sm" disabled={busy} onClick={save}>Save salary details</Button><Button size="sm" variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button></div></div>;
}
export function OfferCompensation({offer}: {offer: OfferSummary}) {
  const [editing, setEditing] = useState(false);
  return editing ? <CompensationEditor interviewId={offer.interviewId} value={offer} isOffer onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} /> : <Button size="sm" variant="outline" className="self-start" onClick={() => setEditing(true)}>Edit salary and offer details</Button>;
}
export function OfferComparison({offers}: {offers: OfferSummary[]}) {
  if (!offers.length) return null;
  const rows: {label: string; key: keyof Compensation | "deadline"}[] = [{label: "Respond by", key: "deadline"}, {label: "Advertised salary range", key: "advertisedSalary"}, ...offerDetailKeys.map((key) => ({key, label: offerDetailLabels[key]}))];
  return <div className="space-y-2"><h3 className="font-semibold">Compare open offers</h3><p className="text-sm text-muted-foreground">Private details, ordered by deadline. Compare currencies, pay periods and conditions as entered.</p><div className="overflow-x-auto rounded-md border" role="region" aria-label="Offer comparison" tabIndex={0}><Table className="w-full text-sm"><TableCaption className="sr-only">Current open offers, sorted by respond-by date</TableCaption><TableHeader><TableRow><TableHead scope="col" className="p-3 text-left">Details</TableHead>{offers.map((offer) => <TableHead key={offer.interviewId} scope="col" className="p-3 text-left min-w-52"><a className="underline" href={`#offer-${offer.interviewId}`}>{offer.jobTitle} · {offer.company}</a>{offer.agency && <p className="font-normal">Via {offer.agency}</p>}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(({label, key}) => <TableRow key={key} className="border-t"><TableHead scope="row" className="p-3 text-left align-top">{label}</TableHead>{offers.map((offer) => <TableCell key={offer.interviewId} className="p-3 align-top whitespace-pre-wrap break-words max-w-sm">{offer[key] || "Not recorded"}</TableCell>)}</TableRow>)}</TableBody></Table></div></div>;
}
export default function ApplicationCompensation({interviewId}: {interviewId: number}) {
  const {user} = useUser();
  const [editing, setEditing] = useState(false);
  const {data, error, isPending, refetch} = useQuery<Compensation & {isOffer: boolean}>({queryKey: ["compensation", user?.id, interviewId], enabled: !!user, queryFn: async () => {
    const response = await fetch(`/api/interview/${interviewId}/compensation`); if (!response.ok) throw new Error("Could not load salary details"); return response.json();
  }});
  if (!user) return null;
  return <section className="space-y-3"><h3 className="font-semibold">Salary and offer details</h3>{error ? <div role="alert">Could not load salary details. <Button onClick={() => refetch()}>Try again</Button></div> : isPending || !data ? <p>Loading salary details…</p> : editing ? <CompensationEditor interviewId={interviewId} value={data} isOffer={data.isOffer} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} /> : <><dl className="text-sm space-y-2"><div><dt>Advertised salary range</dt><dd className="whitespace-pre-wrap">{data.advertisedSalary || "Not recorded"}</dd></div>{data.isOffer && offerDetailKeys.map((key) => <div key={key}><dt>{offerDetailLabels[key]}</dt><dd className="whitespace-pre-wrap">{data[key] || "Not recorded"}</dd></div>)}</dl><Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit salary details</Button></>}</section>;
}
