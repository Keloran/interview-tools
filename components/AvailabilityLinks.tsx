"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {LinkState, linkState} from "@/lib/availability";
import {availabilityMessage} from "@/lib/messages";
import {timeAgo} from "@/lib/applications";
import {cn} from "@/lib/utils";

export type SentLink = {
  sentAt?: string | null;
  id: string;
  path: string;
  stage: string;
  slots: string[];
  bookedSlot: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  created_at: string;
};

type LinksResponse = { jobTitle: string; company: string; links: SentLink[] };

const slotFmt = new Intl.DateTimeFormat(undefined, {weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit"});
const shortFmt = new Intl.DateTimeFormat(undefined, {weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit"});
const timeZoneLabel = (d: Date) =>
  new Intl.DateTimeFormat(undefined, {timeZoneName: "short"}).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "";

const stateStyle: Record<LinkState, string> = {
  created: "text-muted-foreground",
  booked: "text-green-500",
  opened: "text-blue-400",
  sent: "text-muted-foreground",
  ignored: "text-amber-500", // never opened after a week: likely ghosting
};

function statusText(link: SentLink): string {
  switch (linkState(link)) {
    case "created": return `Created ${timeAgo(link.created_at)}; sending not recorded`;
    case "booked": return `Booked ${shortFmt.format(new Date(link.bookedSlot!))}`;
    case "opened": return `Opened ${link.viewCount}×, last ${timeAgo(link.lastViewedAt!)}`;
    case "ignored": return `Sent ${timeAgo(link.sentAt ?? link.created_at)}, never opened`;
    case "sent": return `Sent ${timeAgo(link.sentAt ?? link.created_at)}, not opened yet`;
  }
}

export function useAvailabilityLinks(interviewId: string) {
  return useQuery<LinksResponse>({
    queryKey: ["availability-links", interviewId],
    queryFn: async () => {
      const res = await fetch(`/api/availability?interviewId=${interviewId}`);
      if (!res.ok) throw new Error("Failed to load availability links");
      return res.json();
    },
  });
}

export function CopyButton({text, label}: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="cursor-pointer"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

function messageFor(link: SentLink, job: LinksResponse): string {
  const slots = link.slots.map((s) => new Date(s)).filter((d) => d.getTime() > Date.now());
  return availabilityMessage({
    jobTitle: job.jobTitle,
    company: job.company,
    slots,
    url: `${window.location.origin}${link.path}`,
    formatSlot: (d) => slotFmt.format(d),
    timeZoneLabel: slots[0] ? timeZoneLabel(slots[0]) : "",
  });
}

// The links sent for this job and how far each got; `justCreated` shows its message ready to send
export default function AvailabilityLinks({interviewId, justCreated}: { interviewId: string; justCreated?: string }) {
  const {data} = useAvailabilityLinks(interviewId);
  if (!data?.links.length) return null;

  const created = data.links.find((l) => l.id === justCreated);

  return (
    <div className="flex flex-col gap-3">
      {created && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Paste this into your reply. When they pick a time it&apos;s added as a scheduled {created.stage}.
          </p>
          <Textarea readOnly rows={10} value={messageFor(created, data)} aria-label="Message to send" />
          <div className="flex gap-2">
            <CopyButton text={messageFor(created, data)} label="Copy message" />
            <CopyButton text={`${window.location.origin}${created.path}`} label="Copy link" />
          </div>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium">Availability links for this job</p>
        <ul className="space-y-1">
          {data.links.map((link) => (
            <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {link.stage} · <span className={cn(stateStyle[linkState(link)])}>{statusText(link)}</span>
              </span>
              {!link.bookedSlot && <CopyButton text={messageFor(link, data)} label="Copy message" />}
              <SentRecord link={link} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SentRecord({link}: {link: SentLink}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <div className="space-y-1"><Button size="sm" variant="outline" disabled={busy} onClick={async () => {
    setBusy(true); setError(false);
    try {
      const response = await fetch(`/api/availability/${link.id}/sent`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({sent: !link.sentAt})});
      if (!response.ok) throw new Error();
      await Promise.all(["availability-links", "activity-log", "companies", "search-report"].map((key) => queryClient.invalidateQueries({queryKey: [key]})));
    } catch {setError(true);} finally {setBusy(false);}
  }}>{link.sentAt ? "Clear sent record" : "Mark sent now"}</Button>{error && <p role="alert">Could not update the sent record.</p>}</div>;
}
