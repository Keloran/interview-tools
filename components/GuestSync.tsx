"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { listGuestInterviews, clearGuestInterviews } from "@/lib/guestStorage";

function inferStageMethodName(locationType?: string | null, interviewLink?: string | null): string {
  if (locationType === "phone") return "Phone";
  if (!interviewLink) return "Link";
  const candidates: { re: RegExp; name: string }[] = [
    { re: /zoom\.us|zoom\.com/i, name: "Zoom" },
    { re: /zoomgov\.com/i, name: "ZoomGov" },
    { re: /teams\.microsoft\.com|microsoft\.teams|live\.com\/meet/i, name: "Teams" },
    { re: /meet\.google\.com|hangouts\.google\.com|google\.com\/hangouts|workspace\.google\.com\/products\/meet/i, name: "Google Meet" },
    { re: /webex\.com|webex/i, name: "Webex" },
    { re: /skype\.com/i, name: "Skype" },
    { re: /bluejeans\.com/i, name: "BlueJeans" },
    { re: /whereby\.com/i, name: "Whereby" },
    { re: /jitsi\.org|meet\.jit\.si/i, name: "Jitsi" },
    { re: /gotomeet|gotowebinar|goto\.com/i, name: "GoToMeeting" },
    { re: /chime\.aws|amazonchime\.com/i, name: "Amazon Chime" },
    { re: /slack\.com/i, name: "Slack" },
    { re: /discord\.(gg|com)/i, name: "Discord" },
    { re: /facetime|apple\.com\/facetime/i, name: "FaceTime" },
    { re: /whatsapp\.com/i, name: "WhatsApp" },
    { re: /(^|\.)8x8\.vc/i, name: "8x8" },
    { re: /telegram\.(me|org)|(^|\/)t\.me\//i, name: "Telegram" },
    { re: /signal\.org/i, name: "Signal" },
  ];
  const raw = String(interviewLink);
  let host = "";
  try { host = new URL(raw).hostname; } catch { try { host = new URL(`https://${raw}`).hostname; } catch { host = ""; } }
  const normalizedHost = host.replace(/^www\./i, "");
  const match = candidates.find((c) => c.re.test(normalizedHost) || c.re.test(raw));
  return match ? match.name : "Link";
}

export default function GuestSync() {
  const { user } = useUser();
  const syncedRef = useRef(false);

  useEffect(() => {
    async function run() {
      if (!user || syncedRef.current) return;
      const locals = listGuestInterviews();
      if (!locals.length) return;
      // Create on server (companies are created implicitly by /api/interviews upsert)
      for (const g of locals) {
        try {
          const dateISO = g.date ?? new Date().toISOString();
          const res = await fetch("/api/interviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stage: g.stage,
              companyName: g.companyName,
              clientCompany: g.clientCompany,
              jobTitle: g.jobTitle,
              jobPostingLink: g.jobPostingLink,
              date: dateISO,
              interviewer: g.interviewer,
              locationType: g.locationType,
              interviewLink: g.interviewLink,
            }),
          });
          if (!res.ok) {
            // Stop on first error to avoid duplicates; try again on next login
            console.error("GuestSync: failed to create interview", await res.text());
            return;
          }
        } catch (e) {
          console.error("GuestSync error", e);
          return;
        }
      }
      clearGuestInterviews();
      syncedRef.current = true;
    }
    run();
  }, [user]);

  return null;
}
