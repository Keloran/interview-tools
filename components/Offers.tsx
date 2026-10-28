"use client";

import {OfferComparison, OfferCompensation} from "@/components/Compensation";
import Link from "next/link";
import {useState} from "react";
import {useUser} from "@clerk/nextjs";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import SendMessage from "@/components/SendMessage";
import {offerDaySchema, offerDeadlineState, OfferSummary} from "@/lib/offers";

export function useOffers() {
  const {user} = useUser();
  return useQuery<OfferSummary[]>({queryKey: ["offers", user?.id], enabled: !!user, refetchInterval: 60000, queryFn: async () => {
    const response = await fetch("/api/offers"); if (!response.ok) throw new Error("Could not load offers"); return response.json();
  }});
}
export function OfferReminders() {
  const {user} = useUser();
  const {data, error} = useOffers();
  if (!user) return null;
  if (error) return <Card className="p-4"><p>Could not check offer deadlines. <Link className="underline" href="/offers">Open offers</Link></p></Card>;
  const due = data?.filter((offer) => offerDeadlineState(offer.deadline).remind) ?? [];
  return due.length ? <Card className="p-4 gap-2"><h2 className="font-semibold">Offer replies due</h2><ul className="text-sm space-y-1">{due.map((offer) => <li key={offer.interviewId}><Link className="underline" href={`/offers#offer-${offer.interviewId}`}>{offer.jobTitle} · {offer.company}</Link> · {offerDeadlineState(offer.deadline).label} ({offer.deadline})</li>)}</ul></Card> : null;
}
export function OffersLink({className, onNavigate}: {className?: string; onNavigate?: () => void}) {
  const {data} = useOffers();
  const due = data?.filter((offer) => offerDeadlineState(offer.deadline).remind).length ?? 0;
  return <Button asChild variant="ghost" className={className}><Link href="/offers" onClick={onNavigate}>Offers{due > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground" aria-label={`${due} offer replies due`}>{due}</span>}</Link></Button>;
}
export default function Offers() {
  const {user} = useUser();
  const {data, isPending, error, refetch} = useOffers();
  if (!user) return null;
  return <section className="space-y-4"><h2 className="text-xl font-semibold">Your open offers</h2><p className="text-sm text-muted-foreground">Sorted by respond-by date, including overdue offers. Deadlines are calendar days in your local time. Reminders appear here and on the home page one day before; your calendar feed also includes an all-day deadline and reminder.</p>
    {error ? <div role="alert">Could not load offers. <Button onClick={() => refetch()}>Try again</Button></div> : isPending ? <p role="status">Loading offers…</p> : !data?.length ? <p>No open offers. Add an Offer stage to an application to start.</p> : <><OfferComparison offers={data} /><ul className="space-y-4">{data.map((offer) => <li key={offer.interviewId}><OfferCard offer={offer} /></li>)}</ul></>}
  </section>;
}
function OfferCard({offer}: {offer: OfferSummary}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false), [deadline, setDeadline] = useState(offer.deadline ?? "");
  const [decision, setDecision] = useState<"OFFER_ACCEPTED" | "OFFER_DECLINED" | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const state = offerDeadlineState(offer.deadline);
  async function save(value: {deadline?: string | null; decision?: "OFFER_ACCEPTED" | "OFFER_DECLINED"; confirmDecision?: true}) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/offers/${offer.interviewId}`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(value)});
      const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "Could not update offer.");
      await Promise.all(["offers", "interviews", "companies", "application-timeline", "search-report", "activity-log", "stale-applications"].map((key) => queryClient.invalidateQueries({queryKey: [key]})));
      setEditing(false); setDecision(null);
    } catch (err) {setError(err instanceof Error ? err.message : "Could not update offer. Your edits are still here.");}
    finally {setBusy(false);}
  }
  return <Card id={`offer-${offer.interviewId}`} className="p-4 gap-3 scroll-mt-4">
    <h3 className="font-semibold">{offer.jobTitle} · {offer.company}</h3>{offer.agency && <p className="text-sm">Via {offer.agency}</p>}
    <p className={state.remind ? "font-medium text-amber-600 dark:text-amber-400" : "text-sm"}>{offer.deadline ? `Respond by ${offer.deadline} · ${state.label}` : state.label}</p>
    <Button asChild variant="outline" size="sm" className="self-start"><Link href={`/applications/${offer.applicationId}`}>Application timeline</Link></Button>
    {editing ? <div className="space-y-2"><Label htmlFor={`offer-date-${offer.interviewId}`}>Respond by (optional)</Label><Input id={`offer-date-${offer.interviewId}`} type="date" value={deadline} disabled={busy} onChange={(event) => setDeadline(event.target.value)} /><div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => {if (deadline && !offerDaySchema.safeParse(deadline).success) {setError("Enter a valid respond-by date"); return;} save({deadline: deadline || null});}}>Save deadline</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button></div></div> : <Button size="sm" variant="outline" className="self-start" disabled={busy} onClick={() => {setDeadline(offer.deadline ?? ""); setError(""); setEditing(true);}}>Edit respond-by date</Button>}
    <OfferCompensation offer={offer} />
    <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => {setError(""); setDecision("OFFER_ACCEPTED");}}>Accept offer message</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => {setError(""); setDecision("OFFER_DECLINED");}}>Decline offer message</Button></div>
    {error && !decision && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Dialog open={!!decision} onOpenChange={(open) => {if (!open && !busy) setDecision(null);}}><DialogContent><DialogHeader><DialogTitle>{decision === "OFFER_ACCEPTED" ? "Accept" : "Decline"} offer · {offer.company}</DialogTitle></DialogHeader>{decision && <>
      <p className="text-sm text-muted-foreground">Edit and copy the message, then send it yourself. Copying does not record a decision. Record the outcome when you have decided.</p>
      <SendMessage key={decision} templates={[decision === "OFFER_ACCEPTED" ? "accept-offer" : "decline-offer"]} context={{jobTitle: offer.jobTitle, company: offer.agency || offer.company, clientCompany: offer.agency ? offer.company : null, interviewer: offer.interviewer, stage: "Offer"}} />
      <Button disabled={busy} onClick={() => save({decision, confirmDecision: true})}>{decision === "OFFER_ACCEPTED" ? "Record accepted" : "Record declined"}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </>}</DialogContent></Dialog>
  </Card>;
}
