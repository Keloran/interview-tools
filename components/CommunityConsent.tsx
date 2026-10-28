"use client";

import Link from "next/link";
import {useState} from "react";
import {useUser} from "@clerk/nextjs";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription} from "@/components/ui/dialog";
import {COMMUNITY_NOTICE_VERSION} from "@/lib/communityPolicy";

type State = {restricted?: boolean; collectionPaused?: boolean; enabled: boolean; needsReview: boolean; purgePending: boolean; canEnable: boolean; verified: boolean; noticeVersion: string; agreedVersion: string | null; grantedAt: string | null; withdrawnAt: string | null};
export default function CommunityConsent() {
  const {user} = useUser();
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const {data, error, isPending, refetch} = useQuery<State>({queryKey: ["community-consent", user?.id], enabled: !!user, queryFn: async () => {
    const response = await fetch("/api/community/consent"); if (!response.ok) throw new Error("Could not load sharing settings"); return response.json();
  }});
  async function save(enabled: boolean) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/community/consent", {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(enabled ? {enabled: true, noticeVersion: COMMUNITY_NOTICE_VERSION, confirm: true} : {enabled: false})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not update sharing");
      setReviewing(false); setMessage(enabled ? "Community sharing enabled." : "Community sharing is off. Your contributions have been removed.");
    } catch (err) {setMessage(err instanceof Error ? err.message : "Could not update sharing");}
    finally {await Promise.all([queryClient.invalidateQueries({queryKey: ["community-consent"]}), queryClient.resetQueries({queryKey: ["community-summary"]})]); setBusy(false);}
  }
  if (!user) return null;
  return <section className="space-y-4"><h2 className="text-xl font-semibold">Community sharing</h2><Card className="p-4 gap-3">
    <p>Your private tracking works whether sharing is on or off. Contributing is optional.</p>
    <p className="text-sm text-muted-foreground">With your agreement, eligible employer outcomes from the past 24 months can contribute to coarse monthly summaries. Each account contributes at most one application per employer. Scores require at least 20 contributors; small outcome groups stay hidden.</p>
    <p className="text-sm text-muted-foreground">Names of people, job titles, salaries, notes, contact details and individual application dates are excluded from public summaries. Sharing can still carry an inference risk; downloaded copies of past summaries cannot be recalled.</p>
    <Button asChild variant="outline" size="sm" className="self-start"><Link href="/privacy/community">Read the community privacy notice</Link></Button>
    {error ? <div role="alert">Could not load sharing settings. <Button variant="outline" onClick={() => refetch()}>Try again</Button></div> : isPending || !data ? <p role="status">Loading sharing settings…</p> : <>
      <p className="font-medium">{data.purgePending ? "Sharing stopped; removal pending" : data.restricted ? "Sharing paused — contribution review required" : data.needsReview ? "Sharing paused — review the updated notice" : data.enabled ? data.collectionPaused ? "Sharing on — collection paused" : "Sharing on" : "Sharing off"}</p>
      {data.agreedVersion && <p className="text-sm text-muted-foreground">Last agreed notice: {data.agreedVersion}</p>}
      {data.enabled || data.needsReview || data.purgePending ? <Button variant="outline" disabled={busy} onClick={() => save(false)}>{data.purgePending ? "Retry contribution removal" : "Stop sharing"}</Button> : <Button disabled={busy || !data.canEnable} onClick={() => {setMessage(""); setReviewing(true);}}>Review and enable sharing</Button>}
      {data.needsReview && !data.purgePending && !data.restricted && <Button disabled={busy || !data.canEnable} onClick={() => {setMessage(""); setReviewing(true);}}>Review and enable sharing</Button>}
      {!data.canEnable && !data.enabled && !data.purgePending && <p className="text-sm text-muted-foreground">{!data.verified ? "Verify your email address before contributing." : "Community sharing is not open yet. Your data remains private."}</p>}
    </>}
    {message && <p role="status">{message}</p>}
  </Card><Dialog open={reviewing} onOpenChange={(open) => {if (!busy) setReviewing(open);}}><DialogContent><DialogHeader><DialogTitle>Agree to community sharing</DialogTitle><DialogDescription>Notice version {COMMUNITY_NOTICE_VERSION}. This is a separate choice from using private tracking.</DialogDescription></DialogHeader>
    <p className="text-sm">I agree to contribute eligible employer outcomes and known reply times as explained in the <Link className="underline" href="/privacy/community" target="_blank" rel="noopener noreferrer">community privacy notice</Link>. I can stop sharing at any time from this page. Private tracking remains available.</p>
    <Button disabled={busy || !data?.canEnable} onClick={() => save(true)}>I agree — enable sharing</Button><Button variant="outline" disabled={busy} onClick={() => setReviewing(false)}>Cancel</Button>
    {message && <p role="alert">{message}</p>}
  </DialogContent></Dialog></section>;
}
